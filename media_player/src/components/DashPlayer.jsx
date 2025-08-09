import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as dashjs_lib from 'dashjs';

// Helper function for time formatting (e.g., 90 -> "1:30")
const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

/**
 * DashPlayer component
 * A custom DASH.js-based video player with custom controls, quality selection, and keyboard shortcuts.
 *
 * Props:
 * - manifestUrl: string - URL to the DASH manifest (MPD)
 * - playerRef: React ref - Ref to expose the dash.js player instance
 * - initialTime: number - Initial playback time (in seconds)
 * - onPlayerInitialized: function (optional) - Callback after player is initialized
 */
const DashPlayer = ({ manifestUrl, playerRef, initialTime, onPlayerInitialized }) => {
    // --- Refs for DOM elements ---
    const videoRef = useRef(null);                // <video> element reference
    const progressBarRef = useRef(null);          // Progress bar reference
    const playerContainerRef = useRef(null);      // Player container reference

    // --- Player State ---
    const [isPlaying, setIsPlaying] = useState(false);         // Is video playing
    const [currentTime, setCurrentTime] = useState(0);         // Current playback time
    const [duration, setDuration] = useState(0);               // Video duration
    const [volume, setVolume] = useState(1);                   // Volume (0-1)
    const [isMuted, setIsMuted] = useState(false);             // Is muted
    const [isBuffering, setIsBuffering] = useState(true);      // Is buffering
    const [isFullScreen, setIsFullScreen] = useState(false);   // Is fullscreen
    const [isControlsVisible, setIsControlsVisible] = useState(true); // Controls visibility

    // --- Quality Selection ---
    const [qualityLevels, setQualityLevels] = useState([]);    // Available video qualities
    const [selectedQuality, setSelectedQuality] = useState('auto'); // Selected quality

    // --- Seek Indicator ---
    const [seekIndicator, setSeekIndicator] = useState(null);  // Show seek feedback
    const seekIndicatorTimeoutRef = useRef(null);              // Timeout for seek indicator
    const controlsHideTimeoutRef = useRef(null);               // Timeout for hiding controls

    // --- Control Handlers ---

    /**
     * Toggle play/pause state of the video.
     */
    const togglePlayPause = useCallback(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            console.log("[DashPlayer INFO] Video paused.");
        } else {
            videoRef.current.play().catch(error => {
                console.warn("[DashPlayer WARN] Play failed:", error);
            });
            console.log("[DashPlayer INFO] Attempting to play video.");
        }
        setIsControlsVisible(true);
    }, [isPlaying]);

    /**
     * Seek to a position based on progress bar click.
     */
    const handleProgressBarClick = useCallback((e) => {
        if (progressBarRef.current && videoRef.current && duration > 0) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = clickX / rect.width;
            videoRef.current.currentTime = percent * duration;
            console.log(`[DashPlayer INFO] Seeked to ${formatTime(videoRef.current.currentTime)}`);
        }
        setIsControlsVisible(true);
    }, [duration]);

    /**
     * Handle volume slider change.
     */
    const handleVolumeChangeSlider = useCallback((e) => {
        const newVolume = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.volume = newVolume;
        }
        setIsControlsVisible(true);
    }, []);

    /**
     * Toggle mute/unmute.
     */
    const toggleMute = useCallback(() => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
        }
        setIsControlsVisible(true);
    }, [isMuted]);

    /**
     * Toggle fullscreen mode for the player container.
     */
    const toggleFullScreen = useCallback(() => {
        if (playerContainerRef.current) {
            if (!isFullScreen) {
                console.log("[DashPlayer INFO] Requesting fullscreen.");
                playerContainerRef.current.requestFullscreen?.();
                playerContainerRef.current.mozRequestFullScreen?.();
                playerContainerRef.current.webkitRequestFullscreen?.();
            } else {
                console.log("[DashPlayer INFO] Exiting fullscreen.");
                document.exitFullscreen?.();
                document.mozCancelFullScreen?.();
                document.webkitExitFullscreen?.();
            }
        }
        setIsControlsVisible(true);
    }, [isFullScreen]);

    /**
     * Handle quality selection change.
     */
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
    }, []);

    /**
     * Seek forward or backward by a given number of seconds.
     * Shows a seek indicator overlay.
     */
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

    /**
     * Handle double-click on video: left half = rewind, right half = forward.
     */
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

    /**
     * Keyboard shortcuts for player controls.
     * - Left/Right arrows: seek
     * - Space: play/pause
     * - F: fullscreen
     * - M: mute
     */
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
                togglePlayPause();true
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

    /**
     * Show controls and set up auto-hide timer.
     */
    const showControls = useCallback(() => {
        setIsControlsVisible(true);
        clearTimeout(controlsHideTimeoutRef.current);
        if (isPlaying && !isBuffering && !isFullScreen) {
            controlsHideTimeoutRef.current = setTimeout(() => {
                setIsControlsVisible(false);
            }, 3000);
        }
    }, [isPlaying, isBuffering, isFullScreen]);

    /**
     * Hide controls if playing and not buffering/fullscreen.
     */
    const hideControls = useCallback(() => {
        if (isPlaying && !isBuffering && !isFullScreen) {
            setIsControlsVisible(false);
        }
    }, [isPlaying, isBuffering, isFullScreen]);

    // --- Effects ---

    /**
     * Effect: Initialize dash.js player when manifestUrl changes.
     * Sets up event listeners for player state and quality.
     */
    useEffect(() => {
        if (!videoRef.current || !manifestUrl || !dashjs_lib?.MediaPlayer) {
            console.error("[DashPlayer ERROR] Missing refs for initialization.");
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
                        throughputRule: {
                            active: true
                        },
                        bolaRule: {
                            active: true
                        }
                    }
                }
            }
        });

        player.initialize(videoRef.current, manifestUrl, false);

        // Handle stream initialization: set initial time and quality options
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

        // Player event listeners
        player.on(dashjs_lib.MediaPlayer.events.STREAM_INITIALIZED, handleStreamInitialized);
        player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_STARTED, () => setIsPlaying(true));
        player.on(dashjs_lib.MediaPlayer.events.PLAYBACK_PAUSED, () => setIsPlaying(false));
        player.on(dashjs_lib.MediaPlayer.events.BUFFER_EMPTY, () => setIsBuffering(true));
        player.on(dashjs_lib.MediaPlayer.events.BUFFER_LOADED, () => setIsBuffering(false));
        player.on(dashjs_lib.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
            const active = player.getRepresentationsByType('video').find(rep => rep.active);
            setSelectedQuality(active ? active.id.toString() : 'auto');
        });

        // Native video events
        videoRef.current.addEventListener('timeupdate', () => setCurrentTime(videoRef.current.currentTime));
        videoRef.current.addEventListener('loadedmetadata', () => setDuration(videoRef.current.duration));
        videoRef.current.addEventListener('volumechange', () => {
            setVolume(videoRef.current.volume);
            setIsMuted(videoRef.current.muted);
        });

        // Fullscreen change event
        document.addEventListener('fullscreenchange', () => setIsFullScreen(!!document.fullscreenElement));

        // Cleanup on unmount or manifestUrl change
        return () => {
            player.reset();
            playerRef.current = null;
        };
    }, [manifestUrl, playerRef, initialTime]);

    /**
     * Effect: Keyboard shortcuts listener for the video element.
     */
    useEffect(() => {
        if (!videoRef.current) return;
        videoRef.current.tabIndex = 0;
        videoRef.current.addEventListener('keydown', handleKeyDown);
        return () => {
            videoRef.current?.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    /**
     * Effect: Show controls when playback/buffering/fullscreen state changes.
     */
    useEffect(() => {
        showControls();
    }, [isPlaying, isBuffering, showControls]);

    // --- Render ---
    return (
        <div
            ref={playerContainerRef}
            className={`relative w-full max-w-4xl aspect-video rounded-lg overflow-hidden shadow-2xl bg-slate-900
                ${isFullScreen ? 'fixed inset-0 z-[100] rounded-none' : ''}`}
            onMouseMove={showControls}
            onMouseLeave={hideControls}
            onDoubleClick={handleDoubleClick}
        >
            {/* Video Element */}
            <video
                ref={videoRef}
                className="w-full h-full object-contain cursor-pointer"
                preload="auto"
                playsInline
                onClick={togglePlayPause}
            ></video>

            {/* Buffering Overlay */}
            {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white z-20">
                    Buffering...
                </div>
            )}

            {/* Seek Indicator Overlay */}
            {seekIndicator && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white px-4 py-2 rounded-4xl">
                    {seekIndicator}
                </div>
            )}

            {/* Controls Bar */}
            <div
                className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent
                    ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                    transition-all`}
            >
                {/* Progress Bar */}
                <div
                    ref={progressBarRef}
                    className="w-full h-2 bg-slate-700 rounded cursor-pointer overflow-hidden"
                    onClick={handleProgressBarClick}
                >
                    <div
                        className="h-full bg-teal-500"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                </div>

                {/* Control Buttons and Info */}
                <div className="flex justify-between mt-2 text-white">
                    <div className="flex items-center space-x-3">
                        {/* Play/Pause Button */}
                        <button onClick={togglePlayPause}>
                            {isPlaying ? '⏸' : '▶️'}
                        </button>
                        {/* Time Display */}
                        <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                        {/* Mute Button */}
                        <button onClick={toggleMute}>{isMuted ? '🔇' : '🔊'}</button>
                        {/* Volume Slider */}
                        <input type="range" min="0" max="1" step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChangeSlider} />
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* Quality Selector */}
                        <select value={selectedQuality} onChange={handleQualityChange}>
                            <option value="auto">Auto</option>
                            {qualityLevels.map(q => (
                                <option key={q.id} value={q.id}>
                                    {q.width}x{q.height} ({Math.round(q.bitrate / 1000)} kbps)
                                </option>
                            ))}
                        </select>
                        {/* Fullscreen Button */}
                        <button onClick={toggleFullScreen}>{isFullScreen ? '⛶' : '🖵'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashPlayer;
