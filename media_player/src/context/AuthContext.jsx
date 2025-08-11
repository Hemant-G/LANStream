import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Import axios

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Initial loading state for auth check

    // Make this configurable, e.g., from environment variables
    const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL;

    // Function to check current authentication status
    const checkAuthStatus = useCallback(async () => {
        setIsLoading(true);
        try {
            // Use axios.get with withCredentials for status check
            const response = await axios.get(`${backendBaseUrl}/api/auth/status`, {
                withCredentials: true, // Important for sending session cookies
            });

            if (response.status === 200 && response.data.is_authenticated) {
                setIsAuthenticated(true);
                setUser(response.data.user);
            } else {
                setIsAuthenticated(false);
                setUser(null);
            }
        } catch (error) {
            console.error('Auth status check error:', error);
            // If the error is 401/403 (unauthorized/forbidden), it means session is invalid
            if (axios.isAxiosError(error) && error.response && (error.response.status === 401 || error.response.status === 403)) {
                 console.log('Session invalid, setting isAuthenticated to false.');
            } else {
                 console.error('Network or unexpected error during auth check:', error);
            }
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, [backendBaseUrl]);

    // Initial check on component mount
    useEffect(() => {
        checkAuthStatus();
    }, [checkAuthStatus]);

    // Login function
    const login = async (username, password, rememberMe) => {
        setIsLoading(true); // Set loading while trying to log in
        try {
            // Use axios.post for login
            const response = await axios.post(`${backendBaseUrl}/api/auth/login`, {
                username,
                password,
                remember_me: rememberMe,
            }, {
                withCredentials: true, // Important for receiving and storing session cookies
            });

            if (response.status === 200) {
                setIsAuthenticated(true);
                setUser(response.data); // Backend should return user data on successful login
                return { success: true, message: 'Login successful!' };
            }
            // Axios will throw for non-2xx status codes, so this else branch might not be hit
            return { success: false, message: 'Login failed: Unexpected response.' };
        } catch (error) {
            console.error('Login error:', error);
            setIsAuthenticated(false);
            setUser(null);
            if (axios.isAxiosError(error) && error.response) {
                return { success: false, message: error.response.data.message || 'Login failed.' };
            }
            return { success: false, message: 'Network error during login.' };
        } finally {
            setIsLoading(false);
        }
    };

    // Logout function
    const logout = async () => {
        setIsLoading(true);
        try {
            // Use axios.post for logout
            const response = await axios.post(`${backendBaseUrl}/api/auth/logout`, {}, { // Empty body for POST logout
                withCredentials: true,
            });

            if (response.status === 200) {
                setIsAuthenticated(false);
                setUser(null);
                return { success: true, message: 'Logout successful!' };
            }
            return { success: false, message: 'Logout failed: Unexpected response.' };
        } catch (error) {
            console.error('Logout error:', error);
            if (axios.isAxiosError(error) && error.response) {
                return { success: false, message: error.response.data.message || 'Logout failed.' };
            }
            return { success: false, message: 'Network error during logout.' };
        } finally {
            setIsLoading(false);
        }
    };

    const authContextValue = {
        isAuthenticated,
        user,
        isLoading,
        login,
        logout,
        backendBaseUrl, // Provide backendBaseUrl via context
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};