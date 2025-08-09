import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import DashPlayer from '../components/DashPlayer';
import axios from 'axios';

const WATCH_PROGRESS_INTERVAL_SECONDS = 30;

/**
 * Watch page
 * Handles authentication, fetches media details, manages playback progress, and renders the DashPlayer.
 */
const Watch = () => {
    const { mediaId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, logout, backendBaseUrl } = useAuth();

    // State for media details, user progress, loading, and error
    const [mediaDetails, setMediaDetails] = useState(null);
    const [userProgress, setUserProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Ref for DashPlayer instance and progress interval
    const playerRef = useRef(null);
    const progressIntervalRef = useRef(null);

    // Ref to store the last known video position for robust progress saving
    const lastKnownPositionRef = useRef(0);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isLoading, isAuthenticated, navigate]);

    // Fetch media details and user progress from backend
    useEffect(() => {
        if (isLoading || !isAuthenticated || !mediaId || !backendBaseUrl) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const mediaResponse = await axios.get(`${backendBaseUrl}/api/media/${mediaId}`, { withCredentials: true });
                setMediaDetails(mediaResponse.data);

                const progressResponse = await axios.get(`${backendBaseUrl}/api/media/${mediaId}/progress`, { withCredentials: true });
                setUserProgress(progressResponse.data.current_progress_seconds || 0);

            } catch (err) {
                if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
                    await logout();
                    navigate('/login');
                } else if (axios.isAxiosError(err) && err.response?.status === 404) {
                    setError('Media item not found. Please check the media ID.');
                } else {
                    setError('An unexpected error occurred during fetch.');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [mediaId, isAuthenticated, backendBaseUrl, logout, navigate, isLoading]);

    /**
     * Save playback progress to backend.
     * Saves the current position, or marks as finished if near the end.
     */
    const saveProgress = useCallback(async (currentPosition) => {
        if (!isAuthenticated || !mediaId || currentPosition === null || isNaN(currentPosition) || !backendBaseUrl || !mediaDetails) {
            return;
        }

        let positionToSave = Math.floor(currentPosition);

        // If near the end, mark as finished
        if (mediaDetails.duration_seconds && mediaDetails.duration_seconds > 0 && (mediaDetails.duration_seconds - currentPosition < 5)) {
            positionToSave = mediaDetails.duration_seconds;
        }

        try {
            await axios.post(`${backendBaseUrl}/api/media/${mediaId}/progress`, {
                progress_seconds: positionToSave
            }, { withCredentials: true });
            lastKnownPositionRef.current = positionToSave;
        } catch (error) {
            console.error('[Watch.jsx SaveProgress] Error saving progress:', error);
        }
    }, [isAuthenticated, mediaId, backendBaseUrl, mediaDetails]);

    /**
     * Initialize player actions and periodic progress saving.
     * Seeks to last watched position and sets up interval for saving progress.
     * Cleans up interval and saves progress on unmount.
     */
    useEffect(() => {
        const isReady = mediaDetails && playerRef.current;
        if (isReady) {
            const player = playerRef.current;
            lastKnownPositionRef.current = userProgress;

            // Seek to last watched position or start
            if (userProgress > 0 && userProgress < mediaDetails.duration_seconds) {
                player.seek(userProgress);
            } else if (userProgress === mediaDetails.duration_seconds) {
                player.seek(0);
            } else {
                player.seek(0);
            }

            // Periodically save progress
            progressIntervalRef.current = setInterval(() => {
                const currentPosition = player.time();
                saveProgress(currentPosition);
            }, WATCH_PROGRESS_INTERVAL_SECONDS * 1000);
        }

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            // Final save on unmount
            const player = playerRef.current;
            if (player && player.time) {
                saveProgress(player.time());
            } else {
                saveProgress(lastKnownPositionRef.current);
            }
        };
    }, [mediaDetails, userProgress, saveProgress]);

    // --- Conditional Rendering for User Feedback ---
    if (isLoading || loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white text-xl">
                {isLoading ? 'Authenticating...' : 'Loading media details...'}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-900 text-red-500 text-xl flex-col">
                <p>Error: {error}</p>
            </div>
        );
    }

    if (!mediaDetails) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-900 text-gray-400 text-xl">
                Media item not found.
            </div>
        );
    }

    // Construct DASH manifest URL for the player
    const manifestUrl = `${backendBaseUrl}/api/media/dash/${mediaDetails.id}/manifest.mpd`;

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center">
            <header className="w-full max-w-4xl flex justify-between items-center mb-6">
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                >
                    &larr; Back to Home
                </button>
                <h1 className="text-3xl font-bold text-teal-400 truncate max-w-xs sm:max-w-md">
                    {mediaDetails.title}
                </h1>
            </header>

            <main className="w-full max-w-4xl bg-black rounded-lg shadow-xl overflow-hidden">
                <DashPlayer
                    manifestUrl={manifestUrl}
                    playerRef={playerRef}
                    initialTime={userProgress}
                />
            </main>

            <footer className="mt-8 text-center text-gray-500 text-sm">
                <p>Streaming: {mediaDetails.title} (ID: {mediaDetails.id})</p>
                <p className="mt-2">
                    <a href="https://dash.js.org/" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Powered by dash.js</a>
                </p>
            </footer>
        </div>
    );
};

export default Watch;