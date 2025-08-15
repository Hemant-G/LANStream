import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import DashPlayer from '../components/DashPlayer';
import axios from 'axios';

const WATCH_PROGRESS_INTERVAL_SECONDS = 30;

const Watch = () => {
    const { mediaId } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, logout, backendBaseUrl } = useAuth();

    const [mediaDetails, setMediaDetails] = useState(null);
    const [userProgress, setUserProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const playerRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const lastKnownPositionRef = useRef(0);
    
    // New ref to reference the player's DOM container
    const playerContainerRef = useRef(null); 

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isLoading, isAuthenticated, navigate]);

    // Fetch media details and user progress from backend
    useEffect(() => {
        if (!isLoading && isAuthenticated && mediaId && backendBaseUrl) {
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
        }
    }, [mediaId, isAuthenticated, backendBaseUrl, logout, navigate, isLoading]);

    const saveProgress = useCallback(async (currentPosition) => {
        if (!isAuthenticated || !mediaId || currentPosition === null || isNaN(currentPosition) || !backendBaseUrl || !mediaDetails) {
            return;
        }

        let positionToSave = Math.floor(currentPosition);

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

    // Initial player setup, progress saving, and fullscreen
    useEffect(() => {
        const isReady = mediaDetails && playerRef.current;
        if (isReady) {
            const player = playerRef.current;
            lastKnownPositionRef.current = userProgress;

            if (userProgress > 0 && userProgress < mediaDetails.duration_seconds) {
                player.seek(userProgress);
            } else if (userProgress === mediaDetails.duration_seconds) {
                player.seek(0);
            } else {
                player.seek(0);
            }

            // Removed auto-fullscreen to comply with browser policies.
            // Fullscreen is now handled by a user click event in DashPlayer.
            
            progressIntervalRef.current = setInterval(() => {
                const currentPosition = player.time();
                saveProgress(currentPosition);
            }, WATCH_PROGRESS_INTERVAL_SECONDS * 1000);
        }

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            const player = playerRef.current;
            if (player && player.time) {
                saveProgress(player.time());
            } else {
                saveProgress(lastKnownPositionRef.current);
            }
        };
    }, [mediaDetails, userProgress, saveProgress]);

    if (isLoading || loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-950 text-slate-400 text-xl font-medium">
                {isLoading ? 'Authenticating...' : 'Loading media details...'}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-950 text-red-500 text-xl flex-col p-4">
                <p>Error: {error}</p>
            </div>
        );
    }

    if (!mediaDetails) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-950 text-slate-400 text-xl">
                Media item not found.
            </div>
        );
    }

    const manifestUrl = `${backendBaseUrl}/api/media/dash/${mediaDetails.id}/manifest.mpd`;

    return (
        <div className="h-screen bg-gray-950 text-slate-400 flex flex-col items-center">
            <main className="h-full w-full bg-black flex-grow flex items-center justify-center">
                <DashPlayer
                    manifestUrl={manifestUrl}
                    playerRef={playerRef}
                    initialTime={userProgress}
                    playerContainerRef={playerContainerRef}
                    mediaTitle={mediaDetails.title}
                    onBackClick={() => navigate('/')}
                />
            </main>
        </div>
    );
};

export default Watch;