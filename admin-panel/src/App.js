import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';

import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import UsersPage from './pages/UsersPage';
import UserDetailPage from './pages/UserDetailPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import PurchasesPage from './pages/PurchasesPage';
import SecurityPage from './pages/SecurityPage';
import NotificationsPage from './pages/NotificationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import GalleryPage from './pages/GalleryPage';
import ReviewsPage from './pages/ReviewsPage';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuthStore();
  if (loading) return <SplashLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const SplashLoader = () => (
  <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shadow-brand">
          <span className="text-white font-black text-base tracking-tight">DS</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {[0,1,2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-brand-500 animate-bounce"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <p className="text-[13px] text-[#6a6f73] font-medium">Loading Dr. Sallah Admin...</p>
    </div>
  </div>
);

export default function App() {
  const { init } = useAuthStore();
  useEffect(() => { init(); }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1c1d1f',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.20)',
          },
          success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index                 element={<Dashboard />} />
          <Route path="courses"        element={<CoursesPage />} />
          <Route path="courses/:id"    element={<CourseDetailPage />} />
          <Route path="users"          element={<UsersPage />} />
          <Route path="users/:id"      element={<UserDetailPage />} />
          <Route path="subscriptions"  element={<SubscriptionsPage />} />
          <Route path="purchases"      element={<PurchasesPage />} />
          <Route path="security"       element={<SecurityPage />} />
          <Route path="notifications"  element={<NotificationsPage />} />
          <Route path="analytics"      element={<AnalyticsPage />} />
          <Route path="settings"       element={<SettingsPage />} />
          <Route path="reviews"        element={<ReviewsPage />} />
          <Route path="gallery"        element={<GalleryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
