import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Login from './components/Login';
import Setup from './components/Setup';
import { authApi } from './api/api';
import { DashboardLayout } from './components/layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';

const OverviewPage = lazy(() => import('./pages/OverviewPage').then(m => ({ default: m.OverviewPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));

const pageFallback = (
    <div style={{ height: '60vh', display: 'grid', placeItems: 'center' }}>Loading…</div>
);

function AuthGate() {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [showSetup, setShowSetup] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        const controller = new AbortController();
        authApi.getProfile({ signal: controller.signal })
            .then(() => setIsAuthenticated(true))
            .catch((err) => {
                if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
                    setIsAuthenticated(false);
                }
            });
        return () => controller.abort();
    }, []);

    const handleLoginSuccess = () => setIsAuthenticated(true);
    const handleSetupComplete = () => setIsAuthenticated(true);

    const handleLogout = useCallback(async () => {
        try { await authApi.logout(); } catch { }
        queryClient.clear();
        setIsAuthenticated(false);
        setShowSetup(false);
    }, [queryClient]);

    useEffect(() => {
        if (isAuthenticated !== true) return;
        const handle401 = () => {
            queryClient.clear();
            setIsAuthenticated(false);
        };
        window.addEventListener('auth:unauthorized', handle401);
        return () => window.removeEventListener('auth:unauthorized', handle401);
    }, [isAuthenticated, queryClient]);

    if (isAuthenticated === null) {
        return (
            <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
                Checking authentication…
            </div>
        );
    }

    if (!isAuthenticated) {
        if (showSetup) {
            return (
                <Setup
                    onSetupComplete={handleSetupComplete}
                    onBackToLogin={() => setShowSetup(false)}
                />
            );
        }
        return <Login onLoginSuccess={handleLoginSuccess} onShowSetup={() => setShowSetup(true)} />;
    }

    return (
        <DashboardLayout onLogout={handleLogout}>
            <Suspense fallback={pageFallback}>
                <Routes>
                    <Route path="/" element={<OverviewPage />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </DashboardLayout>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <ToastProvider>
                    <BrowserRouter>
                        <AuthGate />
                    </BrowserRouter>
                </ToastProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
}

export default App;
