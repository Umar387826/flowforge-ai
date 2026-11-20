import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { AcceptInvitePage } from './pages/auth/AcceptInvitePage';
import { OAuthCallbackPage } from './pages/auth/OAuthCallbackPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PublicWidgetPage } from './pages/widget/PublicWidgetPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ff-bg-canvas)] text-sm font-medium text-[var(--ff-text-secondary)]">
        Verifying workspace session...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ForgotPasswordPage />} />
    <Route path="/accept-invite" element={<AcceptInvitePage />} />
    <Route path="/widget/:embedKey" element={<PublicWidgetPage />} />
    <Route
      path="/integrations/google/callback"
      element={
        <ProtectedRoute>
          <OAuthCallbackPage provider="google_oauth" />
        </ProtectedRoute>
      }
    />
    <Route
      path="/integrations/hubspot/callback"
      element={
        <ProtectedRoute>
          <OAuthCallbackPage provider="hubspot" />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/billing"
      element={
        <ProtectedRoute>
          <DashboardPage initialSection="billing" />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
