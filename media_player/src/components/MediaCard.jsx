import React from 'react';
import { Link } from 'react-router'; // Use 'react-router-dom' if using v6+

/**
 * MediaCard component
 * Displays a media item as a card with thumbnail, title, progress, and last watched info.
 *
 * Props:
 * - media: object containing media details (id, title, thumbnail, user progress, duration, last watched)
 */
const MediaCard = ({ media }) => {
    return (
        <Link to={`/watch/${media.id}`} key={media.id} className="block group">
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden transform transition-transform duration-200 hover:scale-105 hover:shadow-2xl">
                {/* Render thumbnail if available */}
                {media.thumbnail && (
                    <img
                        src={media.thumbnail}
                        alt={media.title}
                        className="w-full h-48 object-cover object-center"
                    />
                )}

                <div className="p-4">
                    {/* Media title */}
                    <h3 className="text-xl font-semibold text-gray-100 mb-2 truncate">
                        {media.title}
                    </h3>
                    {/* User progress bar and watched time */}
                    {media.user_progress_seconds > 0 && (
                        <div className="text-sm text-gray-400">
                            <span>
                                Watched: {Math.floor(media.user_progress_seconds / 60)}m {Math.floor(media.user_progress_seconds % 60)}s
                            </span>
                            {media.duration_seconds && (
                                <span className="ml-2">
                                    / {Math.floor(media.duration_seconds / 60)}m {Math.floor(media.duration_seconds % 60)}s
                                </span>
                            )}
                            <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                                <div
                                    className="bg-teal-500 h-1 rounded-full"
                                    style={{
                                        width: `${(media.user_progress_seconds / media.duration_seconds) * 100}%`
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}
                    {/* Last watched timestamp */}
                    {media.user_last_watched_at && (
                        <p className="text-xs text-gray-500 mt-2">
                            Last watched: {new Date(media.user_last_watched_at).toLocaleDateString()}
                            {' '}
                            {new Date(media.user_last_watched_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default MediaCard;