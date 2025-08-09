import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Login from './pages/Login';
import Register from './pages/Register'; // NEW: Import Register component
import { useAuth } from './context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white text-xl">
        Loading authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> {/* NEW: Register Route */}

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/watch/:mediaId"
          element={
            <PrivateRoute>
              <Watch />
            </PrivateRoute>
          }
        />

        {/* Add more protected or public routes here */}

      </Routes>
    </Router>
  );
}

export default App;