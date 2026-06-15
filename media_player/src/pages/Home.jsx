import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import MediaCard from '../components/MediaCard';

/**
 * Home page
 * Displays a list of media items for authenticated users.
 */
const Home = () => {
    const { isAuthenticated, user, logout, isLoading, backendBaseUrl } = useAuth();
    const [mediaItems, setMediaItems] = useState([]);
    const [fetchError, setFetchError] = useState(null);
    const [fetchLoading, setFetchLoading] = useState(false);
    const [hasFetchedMedia, setHasFetchedMedia] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate('/login');
        }
    }, [isLoading, isAuthenticated, navigate]);

    const fetchMedia = useCallback(async () => {
        setFetchLoading(true);
        setFetchError(null);
        try {
            const response = await axios.get(`${backendBaseUrl}/api/media/list`, { withCredentials: true });
            setMediaItems(response.data);
            setHasFetchedMedia(true);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response && (error.response.status === 401 || error.response.status === 403)) {
                await logout();
                navigate('/login');
            } else {
                setFetchError(error.response?.data?.message || error.message || 'Failed to fetch media items.');
            }
        } finally {
            setFetchLoading(false);
        }
    }, [backendBaseUrl, logout, navigate]);

    useEffect(() => {
        if (isAuthenticated && !isLoading && !fetchLoading && !hasFetchedMedia) {
            fetchMedia();
        }
    }, [isAuthenticated, isLoading, fetchLoading, hasFetchedMedia, fetchMedia]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
        setHasFetchedMedia(false);
    };

    const handleScanMedia = async () => {
        if (!user ) {
            alert('You must be an authenticated to perform this action.');
            return;
        }
        setFetchLoading(true);
        try {
            const response = await axios.post(`${backendBaseUrl}/api/media/scan`, {}, { withCredentials: true });
            alert(response.data.message);
            setHasFetchedMedia(false);
        } catch (error) {
            alert(`Error: ${error.response?.data?.message || error.message || 'Failed to trigger scan.'}`);
        } finally {
            setFetchLoading(false);
        }
    };

    const renderLoadingState = () => (
        <div className="flex justify-center items-center min-h-screen bg-slate-950 text-slate-400 text-xl font-medium">
            Loading...
        </div>
    );

    const renderErrorState = () => (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-600 text-xl p-4">
            <p className="mb-4 text-center">Error: {fetchError}</p>
            <button onClick={handleLogout} className="px-6 py-3 bg-slate-800 hover:bg-slate-600 rounded-lg text-white font-semibold transition-colors duration-200">
                Logout
            </button>
        </div>
    );

    const renderEmptyState = () => (
        <div className="flex justify-center items-center h-64 bg-slate-800 rounded-xl p-6">
            <p className="text-slate-600 text-lg font-medium">No media items found. The library is empty.</p>
        </div>
    );

    if (isLoading) return renderLoadingState();
    if (!isAuthenticated) return null;
    if (fetchError) return renderErrorState();

    const featuredItem = mediaItems.length > 0 ? mediaItems[0] : null;
    const otherMedia = mediaItems.slice(1);

    return (
        <div className="min-h-screen bg-gray-950 text-slate-400 px-4 sm:px-8 py-6">
            <header className="flex flex-col sm:flex-row justify-between items-center mb-10">
                <Link to="/" className="text-4xl sm:text-5xl font-extrabold text-slate-400 mb-4 sm:mb-0">
                    LANStream
                </Link>
                <div className="flex items-center space-x-3 sm:space-x-4 text-sm sm:text-base">
                    {user && (
                        <span className="text-slate-600">
                            Logged in as: <span className="font-semibold text-slate-400">{user.username}</span>
                        </span>
                    )}
                    {user && (
                        <button
                            onClick={handleScanMedia}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors duration-200 font-medium"
                            disabled={fetchLoading}
                        >
                            {fetchLoading ? 'Scanning...' : 'Scan Media'}
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-600 cursor-pointer rounded-md transition-colors duration-200 font-medium"
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main>
                {featuredItem && (
                    <div className="relative mb-12 rounded-xl overflow-hidden shadow-2xl">
                        <img
                            src={import.meta.env.VITE_BACKEND_BASE_URL + "/api/" +featuredItem.thumbnail}
                            alt={featuredItem.title}
                            className="w-full h-auto object-cover max-h-[70vh] min-h-[50vh] rounded-xl"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent flex items-end p-8 sm:p-16">
                            <div className="max-w-2xl">
                                <h2 className="text-4xl sm:text-6xl font-bold mb-2 text-slate-300 drop-shadow-lg py-4">
                                    {featuredItem.title}
                                </h2>
                                <Link
                                    to={`/watch/${featuredItem.id}`}
                                    className="px-8 py-4 text-lg font-bold bg-slate-400 text-slate-950 rounded-full hover:bg-slate-300 transition-colors duration-300 shadow-xl"
                                >
                                    Watch Now
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                <section className="mb-12">
                    <h3 className="text-2xl font-bold text-slate-400 mb-6">Recently Watched & All Media</h3>
                    {otherMedia.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                            {otherMedia.map(media => (
                                <Link key={media.id} to={`/watch/${media.id}`}>
                                    <MediaCard media={media} />
                                </Link>
                            ))}
                        </div>
                    ) : (
                        renderEmptyState()
                    )}
                </section>
            </main>
        </div>
    );
};

export default Home;
