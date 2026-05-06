/**
 * ProtectedRoute — redirects to /login when the user is not authenticated.
 * Shows a loading spinner while the session is being rehydrated from the cookie.
 */
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-[48px] animate-pulse"
            style={{ fontVariationSettings: "'FILL' 1" }}>
            shield
          </span>
          <p className="text-text-secondary font-body-sm text-body-sm">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
