import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

/**
 * Register page
 * Allows a new user to create an account.
 * Handles form state, validation, and registration API call.
 */
const Register = () => {
    // Form state
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { backendBaseUrl } = useAuth(); 

    /**
     * Handles form submission for registration.
     * Validates passwords and sends registration request to backend.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            // Send registration request to backend
            const response = await axios.post(`${backendBaseUrl}/api/auth/register`, {
                username,
                password,
                role: 'user',
            }, {
                withCredentials: true,
            });

            setMessage(response.data.message + '. You can now login.');
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            console.error('Registration error:', err);
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.message || err.message || 'Registration failed');
            } else {
                setError('Network error during registration');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-gray-100">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-3xl font-bold text-teal-400 text-center mb-6">Register for LANStream</h2>
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
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-white"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 rounded-md text-white font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Registering...' : 'Register'}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-gray-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-teal-400 hover:underline">
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;