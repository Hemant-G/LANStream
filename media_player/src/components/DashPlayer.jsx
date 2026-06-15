import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as dashjs_lib from 'dashjs';
import { PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/solid';

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

const DashPlayer = ({ manifestUrl, playerRef, initialTime, mediaTitle, onBackClick, playerContainerRef }) => {
    const videoRef = useRef(null);
    const progressBarRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isControlsVisible, setIsControlsVisible] = useState(true);

    const [qualityLevels, setQualityLevels] = useState([]);
    const [selectedQuality, setSelectedQuality] = useState('auto');

    const [seekIndicator, setSeekIndicator] = useState(null);
    const seekIndicatorTimeoutRef = useRef(null);
    const controlsHideTimeoutRef = useRef(null);
    const [triggerFeedback, setTriggerFeedback] = useState({ actionType: null, timestamp: 0 });

    const isMobile = useRef(false);

    // Initial check for mobile device
    useEffect(() => {
        isMobile.current = /Mobi|Android/i.test(navigator.userAgent);
    }, []);

    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            setTriggerFeedback({ actionType: 'PAUSE', timestamp: Date.now() });
        } else {
            videoRef.current.play().catch(error => {
                console.warn("[DashPlayer WARN] Play failed:", error);
            });
            setTriggerFeedback({ actionType: 'PLAY', timestamp: Date.now() });
        }
        setIsControlsVisible(true);
    }, [isPlaying]);

    const handleProgressBarClick = useCallback((e) => {
        if (progressBarRef.current && videoRef.current && duration > 0) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = clickX / rect.width;
            videoRef.current.currentTime = percent * duration;
        }
        setIsControlsVisible(true);
    }, [duration]);

    const handleVolumeChangeSlider = useCallback((e) => {
        const newVolume = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
        setIsControlsVisible(true);
    }, []);

    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
        }
        setIsControlsVisible(true);
    }, [isMuted]);

    // Updated toggleFullScreen logic
    const toggleFullScreen = useCallback(() => {
        if (playerContainerRef.current) {
            if (!document.fullscreenElement) {
                playerContainerRef.current.requestFullscreen?.();
                setIsFullScreen(true);
                // Lock orientation on user gesture (click)
                if (isMobile.current && screen.orientation) {
                    screen.orientation.lock('landscape').catch((err) => console.log('Orientation lock failed:', err));
                }
            } else {
                document.exitFullscreen?.();
                setIsFullScreen(false);
                // Unlock orientation on user gesture (click)
                if (isMobile.current && screen.orientation) {
                    screen.orientation.unlock();
                }
            }
        }
        setIsControlsVisible(true);
    }, [isMobile, playerContainerRef]);


    const handleQualityChange = useCallback((event) => {
        const value = event.target.value;
        if (playerRef.current) {
            if (value === 'auto') {
                playerRef.current.updateSettings({
                    streaming: { abr: { autoSwitchBitrate: { video: true } } }
                });
                setSelectedQuality('auto');
            } else {
                playerRef.current.updateSettings({
                    streaming: { abr: { autoSwitchBitrate: { video: false } } }
                });
                playerRef.current.setRepresentationForTypeById('video', value);
                setSelectedQuality(value);
            }
        }
        setIsControlsVisible(true);
    }, [playerRef]);

    const seekBy = useCallback((seconds) => {
        if (!videoRef.current) return;
        const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
        videoRef.current.currentTime = newTime;

        setSeekIndicator(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
        clearTimeout(seekIndicatorTimeoutRef.current);
        seekIndicatorTimeoutRef.current = setTimeout(() => {
            setSeekIndicator(null);
        }, 800);
        setIsControlsVisible(false);
    }, [duration]);

    const handleDoubleClick = useCallback((e) => {
        if (!videoRef.current) return;
        const rect = videoRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;

        if (clickX < rect.width / 2) {
            seekBy(-10);
        } else {
            seekBy(10);
        }
    }, [seekBy]);

    const handleKeyDown = useCallback((e) => {
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                seekBy(-10);
                break;
            case 'ArrowRight':
                e.preventDefault();
                seekBy(10);
                break;
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'f':
            case 'F':
                toggleFullScreen();
                break;
            case 'm':
            case 'M':
                toggleMute();
                break;
            default:
                break;
        }
    }, [seekBy, togglePlayPause, toggleFullScreen, toggleMute]);

    const showControls = useCallback(() => {
        setIsControlsVisible(true);
        clearTimeout(controlsHideTimeoutRef.current);
        if (isPlaying && !isBuffering) {
            controlsHideTimeoutRef.current = setTimeout(() => {
                setIsControlsVisible(false);
            }, 3000);
        }
    }, [isPlaying, isBuffering, isFullScreen]);

    const hideControls = useCallback(() => {
        if (isPlaying && !isBuffering && isFullScreen) {
            setIsControlsVisible(false);
        }
    }, [isPlaying, isBuffering, isFullScreen]);

    useEffect(() => {
        if (!videoRef.current || !manifestUrl || !dashjs_lib?.MediaPlayer) {
            return;
        }

        const player = dashjs_lib.MediaPlayer().create();
        playerRef.current = player;

        player.updateSettings({
            debug: { logLevel: dashjs_lib.Debug.LOG_LEVEL_INFO },
            streaming: {
                abr: {
                    autoSwitchBitrate: { video: false },
                    rules: {
                        throughputRule: { active: true },
                        bolaRule: { active: true }
                    }
                }
            }
        });

        player.initialize(videoRef.current, manifestUrl, false);

        const handleStreamInitialized = () => {
            if (initialTime > 0) player.seek(initialTime);
            const reps = player.getRepresentationsByType('video');
            if (reps?.length) {
                const mapped = reps.map(rep => ({
                    id: rep.id, width: rep.width, height: rep.height, bitrate: rep.bandwidth
                })).sort((a, b) => b.bitrate - a.bitrate);
                setQualityLevels(mapped);
                const q480 = mapped.find(q => q.height === 480);
                if (q480) {
                    player.setRepresentationForTypeById('video', q480.id);
                    setSelectedQuality(q480.id.toString());
                } else {
                    player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
                    setSelectedQuality('auto');
                }
            }
        };

        player.on(dashjs_lib.MediaPlayer.events.STREAM_INITIALIZED, handleStreamInitialized);
        player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_STARTED, () => setIsPlaying(true));
        player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_PAUSED, () => setIsPlaying(false));
        player.on(dashjs_lib.MediaPlayer.events.BUFFER_EMPTY, () => setIsBuffering(true));
        player.on(dashjs_lib.MediaPlayer.events.BUFFER_LOADED, () => setIsBuffering(false));
        player.on(dashjs_lib.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
            const active = player.getRepresentationsByType('video').find(rep => rep.active);
            setSelectedQuality(active ? active.id.toString() : 'auto');
        });

        videoRef.current.addEventListener('timeupdate', () => setCurrentTime(videoRef.current.currentTime));
        videoRef.current.addEventListener('loadedmetadata', () => setDuration(videoRef.current.duration));
        videoRef.current.addEventListener('volumechange', () => {
            setVolume(videoRef.current.volume);
            setIsMuted(videoRef.current.muted);
        });

        // Removed the handleFullscreenChange callback here to prevent redundant calls
        document.addEventListener('fullscreenchange', () => {
            setIsFullScreen(!!document.fullscreenElement);
        });

        return () => {
            player.reset();
            playerRef.current = null;
        };
    }, [manifestUrl, playerRef, initialTime]);


    useEffect(() => {
        if (!videoRef.current) return;
        videoRef.current.tabIndex = 0;
        videoRef.current.addEventListener('keydown', handleKeyDown);
        return () => {
            videoRef.current?.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    useEffect(() => {
        showControls();
    }, [isPlaying, isBuffering, showControls]);

    return (
        <div
            ref={playerContainerRef}
            className={`relative h-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-slate-950
                ${isFullScreen ? 'fullscreen-player' : ''}`}
            onMouseMove={showControls}
            onMouseLeave={hideControls}
            onDoubleClick={handleDoubleClick}
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain cursor-pointer"
                preload="auto"
                playsInline
                onClick={togglePlayPause}
            ></video>

            {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-slate-400 z-20">
                    Buffering...
                </div>
            )}

            {/* Playback Interaction HUD Overlay */}
            {triggerFeedback.actionType && (
                <div
                    key={triggerFeedback.timestamp}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                >
                    <div className={`bg-slate-900/60 p-5 rounded-full text-slate-400 animate-ping [animation-duration:500ms] [animation-iteration-count:1]
                        ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    transition-all duration-300 ease-in-out z-20`}>
                        {triggerFeedback.actionType === 'PLAY' ? (
                            <PlayIcon className="h-12 w-12" />
                        ) : (
                            <PauseIcon className="h-12 w-12" />
                        )}
                    </div>
                </div>
            )}

            {seekIndicator && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800/80 text-slate-400 px-4 py-2 rounded-full z-30">
                    {seekIndicator}
                </div>
            )}

            <div
                className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent
                    ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    transition-all duration-300 ease-in-out z-20`}
            >
                <button
                    onClick={onBackClick}
                    className="px-4 py-2 bg-slate-800/60 hover:bg-slate-700 rounded-full transition-colors duration-200 font-medium text-slate-400"
                >
                    <ArrowUturnLeftIcon className="h-6 w-6 inline-block mr-2" />
                </button>
            </div>

            <div
                className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent
                    ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    transition-all duration-300 ease-in-out z-20`}
            >
                <h1 className="text-2xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-400 max-w-lg mb-4">
                    {mediaTitle}
                </h1>
                <div className="w-full flex flex-row-reverse text-md font-bold">
                    <div>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>

                <div
                    ref={progressBarRef}
                    className="w-full h-1 bg-slate-700 rounded-full cursor-pointer overflow-hidden group"
                    onClick={handleProgressBarClick}
                >
                    <div
                        className="h-full bg-slate-400 rounded-full transition-all duration-100"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                </div>

                <div className="flex justify-between items-center mt-4 text-slate-400">
                    <div className="flex items-center space-x-4">
                        <button onClick={togglePlayPause} className="hover:text-white transition-colors duration-200">
                            {isPlaying ? <PauseIcon className="h-8 w-8" /> : <PlayIcon className="h-8 w-8" />}
                        </button>
                        <div className="flex items-center space-x-2">
                            <button onClick={toggleMute} className="hover:text-white transition-colors duration-200">
                                {isMuted ? <SpeakerXMarkIcon className="h-6 w-6" /> : <SpeakerWaveIcon className="h-6 w-6" />}
                            </button>
                            <input type="range" min="0" max="1" step="0.01"
                                value={isMuted ? 0 : volume}
                                onChange={handleVolumeChangeSlider}
                                className="w-24 h-1 rounded-lg cursor-pointer accent-slate-400"
                            />
                        </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <select
                                value={selectedQuality}
                                onChange={handleQualityChange}
                                className="appearance-none bg-slate-800 text-slate-400 py-1 pl-3 pr-8 rounded-md cursor-pointer text-md  focus:outline-none focus:ring-2 focus:ring-slate-400 transition-colors duration-200 "
                            >
                                <option value="auto">Auto</option>
                                {qualityLevels.map(q => (
                                    <option key={q.id} value={q.id}>
                                        {q.height}p
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                        </div>

                        <button onClick={toggleFullScreen} className="hover:text-white transition-colors duration-200">
                            {isFullScreen ? <ArrowsPointingInIcon className="h-6 w-6" /> : <ArrowsPointingOutIcon className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashPlayer;