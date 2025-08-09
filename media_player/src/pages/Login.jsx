// lanstream/frontend/src/routes/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';

/**
 * Login page
 * Handles user authentication, form state, and navigation after login.
 */
const Login = () => {
    // Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const { login, isAuthenticated, isLoading } = useAuth();

    /**
     * Redirect to home if already authenticated.
     */
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            console.log("Login: Already authenticated, navigating to Home.");
            navigate('/');
        }
    }, [isLoading, isAuthenticated, navigate]);

    /**
     * Handles form submission for login.
     * Calls login from AuthContext and displays result.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        const result = await login(username, password, rememberMe);

        if (result.success) {
            setMessage(result.message);
            // Navigation is handled by useEffect after authentication state updates
        } else {
            setError(result.message);
        }
    };

    // Show loading or redirect message while authentication is being checked
    if (isLoading || isAuthenticated) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white text-xl">
                Loading or already logged in...
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-teal-400 text-center mb-6">Login to LANStream</h2>
                {/* Display error or success messages */}
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                {message && <p className="text-green-500 text-center mb-4">{message}</p>}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-white"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-white"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="rememberMe"
                            className="form-checkbox h-4 w-4 text-teal-500 rounded border-gray-600 focus:ring-teal-500 bg-gray-700"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-300">
                            Remember Me
                        </label>
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 rounded-md text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-teal-400 hover:underline">
                        Register here
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;