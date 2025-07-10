import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as dashjs_lib from 'dashjs'; 

const DashPlayer = ({ manifestUrl }) => {
    const videoRef = useRef(null); 
    const playerRef = useRef(null); 
    const progressBarRef = useRef(null); 

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1); 
    const [isMuted, setIsMuted] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true); 
    const [isFullScreen, setIsFullScreen] = useState(false);

    const [qualityLevels, setQualityLevels] = useState([]);
    const [selectedQuality, setSelectedQuality] = useState('auto'); 

    useEffect(() => {
        if (videoRef.current) {
            if (!dashjs_lib || !dashjs_lib.MediaPlayer) {
                console.error("Error: dashjs_lib or dashjs_lib.MediaPlayer is undefined. Ensure dashjs is correctly installed and imported.");
                return;
            }

            const player = dashjs_lib.MediaPlayer().create(); 
            playerRef.current = player; 


            player.initialize(videoRef.current, manifestUrl, true);
            console.log('dash.js player initialized with manifest:', manifestUrl);

            player.on(dashjs_lib.MediaPlayer.events.STREAM_INITIALIZED, function() {
                if (!player) { 
                    console.warn("STREAM_INITIALIZED fired, but the player instance is null.");
                    return; 
                }

                console.log("DASH Stream Initialized.");

                const availableRepresentations = player.getRepresentationsByType('video');
                console.log("Raw representations from getRepresentationsByType:", availableRepresentations); 
                
                if (availableRepresentations && availableRepresentations.length > 0) {
                    const mappedQualities = availableRepresentations.map(rep => ({
                        id: rep.id, 
                        width: rep.width,
                        height: rep.height,
                        bitrate: rep.bandwidth 
                    })).sort((a, b) => b.bitrate - a.bitrate); 

                    console.log("Available video qualities (from getRepresentationsByType):", mappedQualities);
                    setQualityLevels(mappedQualities);
                    setSelectedQuality('auto'); 
                } else {
                    console.warn("No video representations found after stream initialized. Dropdown will only show 'Auto'.");
                    setQualityLevels([]); 
                }
            });

            player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_STARTED, () => {
                console.log("Playback has started.");
                setIsPlaying(true);
                setIsBuffering(false); 
            });

            player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_PAUSED, () => {
                console.log("Playback has paused.");
                setIsPlaying(false);
            });

            player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_ENDED, () => {
                console.log("Playback has ended.");
                setIsPlaying(false);
            });

            player.on(dashjs_lib.MediaPlayer.events.BUFFER_EMPTY, () => {
                console.log("Player is buffering (BUFFER_EMPTY).");
                setIsBuffering(true);
            });

            player.on(dashjs_lib.MediaPlayer.events.BUFFER_LOADED, () => {
                console.log("Player finished buffering (BUFFER_LOADED).");
                setIsBuffering(false);
            });
            
            player.on(dashjs_lib.MediaPlayer.events.QUALITY_CHANGE_RENDERED, function(e) {
                if (e.mediaType === 'video') {
                    const currentRepresentation = player.getRepresentationsByType('video')
                                                        .find(rep => rep.active); 
                    if (currentRepresentation) {
                        setSelectedQuality(currentRepresentation.id.toString());
                    } else {
                        setSelectedQuality('auto'); 
                    }
                }
            });

            const handleTimeUpdate = () => {
                setCurrentTime(videoRef.current.currentTime);
            };

            const handleLoadedMetadata = () => {
                setDuration(videoRef.current.duration);
                setIsBuffering(false); 
            };

            const handleVolumeChange = () => {
                setVolume(videoRef.current.volume);
                setIsMuted(videoRef.current.muted);
            };

            videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
            videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
            videoRef.current.addEventListener('volumechange', handleVolumeChange);

            const handleFullscreenChange = () => {
                setIsFullScreen(document.fullscreenElement != null);
            };
            document.addEventListener('fullscreenchange', handleFullscreenChange);
            document.addEventListener('webkitfullscreenchange', handleFullscreenChange); 
            document.addEventListener('mozfullscreenchange', handleFullscreenChange);   
            document.addEventListener('msfullscreenchange', handleFullscreenChange);    

            return () => {
                if (player) { 
                    console.log('Releasing dash.js player and listeners.');
                    player.reset(); 
                    playerRef.current = null; 
                }
                if (videoRef.current) {
                    videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
                    videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
                    videoRef.current.removeEventListener('volumechange', handleVolumeChange);
                }
                document.removeEventListener('fullscreenchange', handleFullscreenChange);
                document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
                document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
                document.removeEventListener('msfullscreenchange', handleFullscreenChange);
            };
        }
    }, [manifestUrl]); 

    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play().catch(error => {
                console.warn("Play failed (likely autoplay policy):", error);
            });
        }
    }, [isPlaying]);

    const handleProgressBarClick = useCallback((e) => {
        if (progressBarRef.current && videoRef.current && duration > 0) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left; 
            const percent = clickX / rect.width;
            videoRef.current.currentTime = percent * duration; 
        }
    }, [duration]);

    const handleVolumeChangeSlider = useCallback((e) => {
        const newVolume = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
    }, []);

    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
        }
    }, [isMuted]);

    const toggleFullScreen = useCallback(() => {
        if (videoRef.current && document) {
            if (!isFullScreen) {
                if (videoRef.current.parentElement.requestFullscreen) {
                    videoRef.current.parentElement.requestFullscreen();
                } else if (videoRef.current.parentElement.mozRequestFullScreen) {
                    videoRef.current.parentElement.mozRequestFullScreen();
                } else if (videoRef.current.parentElement.webkitRequestFullscreen) {
                    videoRef.current.parentElement.webkitRequestFullscreen();
                } else if (videoRef.current.parentElement.msRequestFullscreen) {
                    videoRef.current.parentElement.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }
    }, [isFullScreen]);

    const handleQualityChange = useCallback((event) => {
        const value = event.target.value; 
        setSelectedQuality(value); 

        if (playerRef.current) {
            if (value === 'auto') {
                console.log("Quality set to Auto (ABR enabled).");
            } else {
                playerRef.current.setRepresentationForTypeById('video', parseInt(value, 10)); 
                console.log(`Quality manually set to Representation ID: ${value}.`);
            }
        } else {
            console.warn("Cannot change quality: playerRef.current is null.");
        }
    }, []);

    const formatTime = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const formattedMinutes = String(minutes).padStart(1, '0'); 
        const formattedSeconds = String(remainingSeconds).padStart(2, '0');
        return `${formattedMinutes}:${formattedSeconds}`;
    };

    return (
        <div 
            className={`relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden shadow-2xl bg-black 
                        ${isFullScreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}
            onClick={togglePlayPause} 
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                preload="auto"
            ></video>

            {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-20">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-teal-500"></div>
                </div>
            )}

            <div 
                className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent flex flex-col space-y-2 z-10 
                            ${isPlaying && !isBuffering && !isFullScreen ? 'opacity-0 hover:opacity-100 transition-opacity duration-300' : 'opacity-100'}`}
                onClick={(e) => e.stopPropagation()} 
            >
                
                <div 
                    ref={progressBarRef} 
                    className="w-full h-2 bg-gray-700 rounded-full cursor-pointer overflow-hidden"
                    onClick={handleProgressBarClick} 
                >
                    <div 
                        className="h-full bg-teal-500 rounded-full" 
                        style={{ width: `${(currentTime / duration) * 100}%` }} 
                    ></div>
                </div>

                <div className="flex items-center justify-between text-white text-sm">
                    <div className="flex items-center space-x-3">
                        <button onClick={togglePlayPause} className="p-1 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full">
                            {isPlaying ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path></svg>
                            )}
                        </button>
                        
                        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>

                        <div className="flex items-center space-x-1">
                            <button onClick={toggleMute} className="p-1 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full">
                                {isMuted || volume === 0 ? (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM10 10.414V14a2 2 0 004 0V5.086L18.707 2.3A1 1 0 0119 3v14a1 1 0 01-1 1h-2.293l-3.707 3.707A1 1 0 0110 19v-3.414a2 2 0 00-4 0v-2.172a1 1 0 01-.707-.707l-.293-.293A1 1 0 014 10a1 1 0 01.293-.707l.293-.293A1 1 0 015 8V6a1 1 0 00-1.707-.707L1 2.586V2a1 1 0 011-1h2.586l3.707-3.707a1 1 0 01.707-.293zM10 10.414V14a2 2 0 004 0V5.086L18.707 2.3A1 1 0 0119 3v14a1 1 0 01-1 1h-2.293l-3.707 3.707A1 1 0 0110 19v-3.414a2 2 0 00-4 0v-2.172a1 1 0 01-.707-.707l-.293-.293A1 1 0 014 10a1 1 0 01.293-.707l.293-.293A1 1 0 015 8V6a1 1 0 00-1.707-.707L1 2.586V2a1 1 0 011-1h2.586l3.707-3.707a1 1 0 01.707-.293z" clipRule="evenodd"></path></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3a1 1 0 00-1 1v12a1 1 0 001.707.707L15 13.414V6.586L10.707 3.293A1 1 0 0010 3zM3 8a1 1 0 011-1h3.414l-2.707-2.707A1 1 0 015 4a1 1 0 011.707.707L10 8.414V6a1 1 0 00-1-1H4a1 1 0 00-1 1zM3 12a1 1 0 011-1h3.414l-2.707 2.707A1 1 0 005 16a1 1 0 001.707-.707L10 11.586V14a1 1 0 001 1h4a1 1 0 001-1V6a1 1 0 00-1-1H9a1 1 0 00-1 1v2.414L3.293 8.707A1 1 0 003 9v2z"></path></svg>
                                )}
                            </button>
                            <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.01" 
                                value={isMuted ? 0 : volume} 
                                onChange={handleVolumeChangeSlider}
                                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500" 
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        <label htmlFor="quality-select" className="sr-only">Video Quality</label> 
                        <select
                            id="quality-select"
                            value={selectedQuality}
                            onChange={handleQualityChange}
                            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 transition-all cursor-pointer"
                            disabled={qualityLevels.length === 0} 
                        >
                            <option value="auto">Auto</option> 
                            {qualityLevels.map((level) => (
                                <option key={level.id} value={level.id}> 
                                    {level.width}x{level.height} ({Math.round(level.bitrate / 1000)} kbps)
                                </option>
                            ))}
                        </select>
                        {qualityLevels.length === 0 && (
                            <span className="text-gray-500 text-xs ml-2">Loading...</span>
                        )}

                        <button onClick={toggleFullScreen} className="p-1 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full">
                            {isFullScreen ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-5.707-8.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L8 10.586l-2.293-2.293a1 1 0 00-1.414 0zM12 7a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V7zm2 2h2V8h-2v1zm-4 4a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 00-1-1h-4zM13 15h2v-1h-2v1z" clipRule="evenodd"></path></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h3a1 1 0 110 2H5v2a1 1 0 11-2 0V5zm0 8a1 1 0 011-1h3a1 1 0 110 2H5v2a1 1 0 11-2 0v-3zm8-8a1 1 0 011-1h3a1 1 0 110 2h-2v2a1 1 0 11-2 0V5zm0 8a1 1 0 011-1h3a1 1 0 110 2h-2v2a1 1 0 11-2 0v-3z" clipRule="evenodd"></path></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashPlayer;