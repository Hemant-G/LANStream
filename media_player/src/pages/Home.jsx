import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import MediaCard from '../components/MediaCard';

/**
 * Home page
 * Displays a list of media items for authenticated users.
 * Handles authentication, media fetching, error handling, and admin actions.
 */
const Home = () => {
    // Auth and navigation context
    const { isAuthenticated, user, logout, isLoading, backendBaseUrl } = useAuth();

    // State for media items, fetch status, and errors
    const [mediaItems, setMediaItems] = useState([]);
    const [fetchError, setFetchError] = useState(null);
    const [fetchLoading, setFetchLoading] = useState(false);
    const [hasFetchedMedia, setHasFetchedMedia] = useState(false); // Track if media has been fetched
    const navigate = useNavigate();

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isLoading, isAuthenticated, navigate]);

    /**
     * Fetch media list from backend.
     * Handles authentication errors and sets state.
     */
    const fetchMedia = useCallback(async () => {
        setFetchLoading(true);
        setFetchError(null);
        try {
            const response = await axios.get(`${backendBaseUrl}/api/media/list`, {
                withCredentials: true,
            });
            setMediaItems(response.data);
            setFetchError(null);
            setHasFetchedMedia(true);
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    await logout();
                    navigate('/login');
                } else {
                    const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch media items.';
                    setFetchError(errorMessage);
                }
            } else {
                setFetchError('Network error. Please check your connection.');
            }
        } finally {
            setFetchLoading(false);
        }
    }, [isAuthenticated, backendBaseUrl, logout, navigate]);

    /**
     * Effect to trigger media fetching.
     * Only fetches if authenticated and not already fetched.
     */
    useEffect(() => {
        if (isAuthenticated && !isLoading && !fetchLoading && !hasFetchedMedia) {
            fetchMedia();
        }
        // Reset fetch state if authentication is lost
        if (!isAuthenticated && hasFetchedMedia) {
            setHasFetchedMedia(false);
        }
    }, [isAuthenticated, isLoading, fetchLoading, hasFetchedMedia, fetchMedia]);

    /**
     * Handles user logout.
     * Resets media fetch state on logout.
     */
    const handleLogout = async () => {
        const result = await logout();
        if (result.success) {
            navigate('/login');
            setHasFetchedMedia(false);
        } else {
            alert(result.message);
        }
    };

    /**
     * Admin-only: Triggers a media scan on the backend.
     * Refreshes the media list after scanning.
     */
    const handleScanMedia = async () => {
        if (!user || user.role !== 'admin') {
            alert('You must be an admin to perform this action.');
            return;
        }
        setFetchLoading(true);
        try {
            const response = await axios.post(`${backendBaseUrl}/api/media/scan`, {}, {
                withCredentials: true,
            });
            alert(response.data.message);
            setHasFetchedMedia(false); // Trigger re-fetch
        } catch (error) {
            if (axios.isAxiosError(error)) {
                alert(`Error: ${error.response?.data?.message || error.message || 'Failed to trigger scan.'}`);
            } else {
                alert('Network error during media scan.');
            }
        } finally {
            setFetchLoading(false);
        }
    };

    // --- Render Logic ---
    if (isLoading || fetchLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white text-xl">
                Loading...
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-900 text-red-500 text-xl">
                Error: {fetchError}
                <button
                    onClick={handleLogout}
                    className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
                >
                    Logout
                </button>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white text-xl">
                Please <Link to="/login" className="text-teal-400 hover:underline ml-2">log in</Link> to view content.
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-teal-400">LANStream</h1>
                <div className="flex items-center space-x-4">
                    {user && (
                        <span className="text-lg">Logged in as: <span className="font-semibold">{user.username}</span> ({user.role})</span>
                    )}
                    {user && user.role === 'admin' && (
                        <button
                            onClick={handleScanMedia}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                            disabled={fetchLoading}
                        >
                            {fetchLoading ? 'Scanning...' : 'Scan Media'}
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <h2 className="text-2xl font-bold text-gray-200 mb-6">Recently Watched & All Media</h2>

            {mediaItems.length === 0 && (
                <div className="flex justify-center items-center h-48 bg-gray-800 rounded-lg">
                    <p className="text-gray-400 text-lg">No media items found.</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {mediaItems.map((media) => (
                    <MediaCard key={media.id} media={media} />
                ))}
            </div>
        </div>
    );
};

export default Home;