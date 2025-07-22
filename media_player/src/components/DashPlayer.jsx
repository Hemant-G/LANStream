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
    const [selectedQuality, setSelectedQuality] = useState('auto'); // Stores representation ID (string) or 'auto'

    useEffect(() => {
        if (!videoRef.current) {
            console.error("[DashPlayer DEBUG] Video element ref is not available.");
            return;
        }

        if (!dashjs_lib || !dashjs_lib.MediaPlayer) {
            console.error("[DashPlayer ERROR] dashjs_lib or dashjs_lib.MediaPlayer is undefined. Ensure dashjs is correctly installed and imported.");
            return;
        }

        const player = dashjs_lib.MediaPlayer().create();
        playerRef.current = player;

        // Configure player settings before initialization
        player.updateSettings({
            'debug': {
                'logLevel': dashjs_lib.Debug.LOG_LEVEL_DEBUG // Enable verbose dash.js logging
            },
            'streaming': {
                'abr': {
                    // Disable ABR for video initially. It will be re-enabled only if 'Auto' is selected.
                    'autoSwitchBitrate': {
                        'video': false // KEY CHANGE: Disable ABR for video by default
                    }
                },
                'bufferPruning': {
                    'liveEdge': 0, // Keep more buffer at live edge for stability (useful if live)
                    'longForm': 0 // Keep more buffer for VOD
                },
                'stableBufferTime': 5, // Minimum buffer to reach before switching up
                'bufferTimeAtTopQuality': 10, // Target buffer for top quality
                'bufferTimeAtLowestQuality': 3, // Target buffer for lowest quality
                'fastSwitchEnabled': true // Allow faster quality switching
            }
        });

        player.initialize(videoRef.current, manifestUrl, true); // `true` here enables autoPlay, not ABR
        console.log('[DashPlayer INFO] dash.js player initialized with manifest:', manifestUrl);

        // --- DASH.js Event Listeners ---
        player.on(dashjs_lib.MediaPlayer.events.STREAM_INITIALIZED, function() {
            if (!playerRef.current) {
                console.warn("[DashPlayer WARN] STREAM_INITIALIZED fired, but the player instance is null.");
                return;
            }

            console.log("[DashPlayer INFO] DASH Stream Initialized. Fetching available representations...");

            const availableRepresentations = playerRef.current.getRepresentationsByType('video');

            if (availableRepresentations && availableRepresentations.length > 0) {
                const mappedQualities = availableRepresentations.map(rep => {
                    console.log(`[DashPlayer DEBUG] Found Representation: ID=${rep.id}, Index=${rep.index}, Width=${rep.width}, Height=${rep.height}, Bandwidth=${rep.bandwidth/1000} kbps`);
                    return {
                        id: rep.id, // Store the internal dash.js representation ID (can be string or number)
                        index: rep.index,
                        width: rep.width,
                        height: rep.height,
                        bitrate: rep.bandwidth
                    };
                }).sort((a, b) => b.bitrate - a.bitrate); // Sort from highest to lowest bitrate

                console.log("[DashPlayer INFO] Available video qualities for dropdown (sorted by bitrate):", mappedQualities);
                setQualityLevels(mappedQualities);

                // Dynamically find the 480p quality by its height, not a hardcoded ID
                const target480pQuality = mappedQualities.find(q => q.height === 480);

                if (target480pQuality) {
                    // Use the actual ID found for 480p in the manifest
                    playerRef.current.setRepresentationForTypeById('video', target480pQuality.id);
                    setSelectedQuality(target480pQuality.id.toString()); // Update UI state
                    console.log(`[DashPlayer INFO] Initial video quality set manually to 480p (ID: ${target480pQuality.id}).`);
                } else {
                    console.warn(`[DashPlayer WARN] 480p quality (height 480) not found in manifest. Player will likely start with the highest available quality.`);
                    // Fallback to highest available if 480p not found
                    if (mappedQualities.length > 0) {
                        playerRef.current.setRepresentationForTypeById('video', mappedQualities[0].id);
                        setSelectedQuality(mappedQualities[0].id.toString());
                        console.log(`[DashPlayer INFO] Initial video quality set to highest available: ${mappedQualities[0].id}`);
                    }
                }
            } else {
                console.warn("[DashPlayer WARN] No video representations found after stream initialized. Dropdown will only show 'Auto'.");
                setQualityLevels([]);
            }
        });

        player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_STARTED, () => {
            console.log("[DashPlayer INFO] Playback has started.");
            setIsPlaying(true);
            setIsBuffering(false);
        });

        player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_PAUSED, () => {
            console.log("[DashPlayer INFO] Playback has paused.");
            setIsPlaying(false);
        });

        player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_ENDED, () => {
            console.log("[DashPlayer INFO] Playback has ended.");
            setIsPlaying(false);
        });

        player.on(dashjs_lib.MediaPlayer.events.BUFFER_EMPTY, () => {
            console.log("[DashPlayer INFO] Player is buffering (BUFFER_EMPTY).");
            setIsBuffering(true);
        });

        player.on(dashjs_lib.MediaPlayer.events.BUFFER_LOADED, () => {
            console.log("[DashPlayer INFO] Player finished buffering (BUFFER_LOADED).");
            setIsBuffering(false);
        });

        // This event fires whenever the *rendered* quality changes (either by ABR or manually)
        player.on(dashjs_lib.MediaPlayer.events.QUALITY_CHANGE_RENDERED, function(e) {
            if (e.mediaType === 'video') {
                const currentRepresentation = playerRef.current.getRepresentationsByType('video')
                                                    .find(rep => rep.active);
                if (currentRepresentation) {
                    console.log(`[DashPlayer INFO] QUALITY_CHANGE_RENDERED: Currently active video rep ID: ${currentRepresentation.id}, Resolution: ${currentRepresentation.width}x${currentRepresentation.height}, Bitrate: ${Math.round(currentRepresentation.bandwidth / 1000)} kbps`);
                    // Update the selectedQuality state to reflect the actual playing quality
                    // This handles ABR switches if 'Auto' is selected, or confirms manual selection.
                    setSelectedQuality(currentRepresentation.id.toString());
                } else {
                    console.log("[DashPlayer INFO] QUALITY_CHANGE_RENDERED: No active video representation found. Setting quality to 'auto' in UI.");
                    setSelectedQuality('auto');
                }
            }
        });

        // --- HTML Video Element Event Listeners ---
        const handleTimeUpdate = () => {
            setCurrentTime(videoRef.current.currentTime);
        };

        const handleLoadedMetadata = () => {
            setDuration(videoRef.current.duration);
            setIsBuffering(false);
            console.log(`[DashPlayer INFO] Video Loaded Metadata. Duration: ${videoRef.current.duration}s`);
        };

        const handleVolumeChange = () => {
            setVolume(videoRef.current.volume);
            setIsMuted(videoRef.current.muted);
            console.log(`[DashPlayer DEBUG] Volume changed: ${videoRef.current.volume}, Muted: ${videoRef.current.muted}`);
        };

        videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoRef.current.addEventListener('volumechange', handleVolumeChange);

        // --- Fullscreen Event Listeners ---
        const handleFullscreenChange = () => {
            const isNowFullScreen = document.fullscreenElement != null ||
                                    document.webkitFullscreenElement != null ||
                                    document.mozFullScreenElement != null ||
                                    document.msFullscreenElement != null;
            setIsFullScreen(isNowFullScreen);
            console.log(`[DashPlayer INFO] Fullscreen state changed: ${isNowFullScreen ? 'ON' : 'OFF'}`);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        // --- Cleanup Function ---
        return () => {
            if (playerRef.current) {
                console.log('[DashPlayer INFO] Releasing dash.js player and listeners on component unmount.');
                playerRef.current.reset();
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
            console.log('[DashPlayer INFO] Cleanup complete.');
        };
    }, [manifestUrl]);

    // --- Control Handlers ---
    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            console.log("[DashPlayer INFO] Video paused.");
        } else {
            videoRef.current.play().catch(error => {
                console.warn("[DashPlayer WARN] Play failed (likely autoplay policy or user gesture required):", error);
            });
            console.log("[DashPlayer INFO] Attempting to play video.");
        }
    }, [isPlaying]);

    const handleProgressBarClick = useCallback((e) => {
        if (progressBarRef.current && videoRef.current && duration > 0) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = clickX / rect.width;
            videoRef.current.currentTime = percent * duration;
            console.log(`[DashPlayer INFO] Seeked to ${formatTime(videoRef.current.currentTime)}`);
        }
    }, [duration]);

    const handleVolumeChangeSlider = useCallback((e) => {
        const newVolume = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
            console.log(`[DashPlayer DEBUG] Volume slider changed to: ${newVolume}`);
        }
    }, []);

    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            console.log(`[DashPlayer INFO] Mute toggled: ${!isMuted ? 'Muted' : 'Unmuted'}`);
        }
    }, [isMuted]);

    const toggleFullScreen = useCallback(() => {
        if (videoRef.current && document) {
            const container = videoRef.current.parentElement; // Target the parent container for fullscreen
            if (!isFullScreen) {
                console.log("[DashPlayer INFO] Requesting fullscreen.");
                if (container.requestFullscreen) {
                    container.requestFullscreen();
                } else if (container.mozRequestFullScreen) {
                    container.mozRequestFullScreen();
                } else if (container.webkitRequestFullscreen) {
                    container.webkitRequestFullscreen();
                } else if (container.msRequestFullscreen) {
                    container.msRequestFullscreen();
                }
            } else {
                console.log("[DashPlayer INFO] Exiting fullscreen.");
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
        const value = event.target.value; // This will be the string ID from the <option> value
        console.log(`[DashPlayer DEBUG] handleQualityChange called. Selected dropdown value: '${value}'`);

        if (playerRef.current) {
            if (value === 'auto') {
                // Re-enable ABR for video when 'Auto' is selected
                playerRef.current.updateSettings({
                    'streaming': {
                        'abr': {
                            'autoSwitchBitrate': {
                                'video': true // Explicitly enable ABR for video
                            }
                        }
                    }
                });
                setSelectedQuality('auto');
                console.log("[DashPlayer INFO] Quality set to Auto (ABR re-enabled for video).");
            } else {
                const desiredRepresentationId = value; // Use the value directly as the ID (can be string or number)

                // Disable ABR for video before setting a specific quality
                playerRef.current.updateSettings({
                    'streaming': {
                        'abr': {
                            'autoSwitchBitrate': {
                                'video': false // KEY CHANGE: Explicitly disable ABR for video
                            }
                        }
                    }
                });

                // Set the representation by its internal ID
                playerRef.current.setRepresentationForTypeById('video', desiredRepresentationId);
                setSelectedQuality(value); // Update UI state to reflect user's selection
                console.log(`[DashPlayer INFO] Quality manually set to Representation ID: ${desiredRepresentationId}. ABR disabled for video.`);

                // Find and log the details of the selected quality level for debugging
                const selectedQualityLevel = qualityLevels.find(level => String(level.id) === String(desiredRepresentationId));
                if (selectedQualityLevel) {
                    console.log(`[DashPlayer DEBUG] Attempted to set to: ID=${selectedQualityLevel.id}, Resolution=${selectedQualityLevel.width}x${selectedQualityLevel.height}, Bitrate: ${Math.round(selectedQualityLevel.bitrate / 1000)} kbps`);
                } else {
                    console.warn(`[DashPlayer WARN] Could not find selected quality level with ID: ${desiredRepresentationId} in available list (after selection). This might indicate a mismatch between dropdown values and actual manifest IDs.`);
                }
            }
        } else {
            console.warn("[DashPlayer WARN] Cannot change quality: playerRef.current is null.");
        }
    }, [qualityLevels]); // Added qualityLevels to dependency array, as it's used inside useCallback

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
                playsInline // Important for iOS to play in-line, not automatically fullscreen
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