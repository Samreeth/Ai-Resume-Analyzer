import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import ProtectedRoute from './layouts/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ResumesPage from './pages/resumes/ResumesPage.jsx';
import ResumeDetailPage from './pages/resumes/ResumeDetailPage.jsx';
import JobsPage from './pages/jobs/JobsPage.jsx';
import JobDetailPage from './pages/jobs/JobDetailPage.jsx';
import AnalysesPage from './pages/analysis/AnalysesPage.jsx';
import CreateAnalysisPage from './pages/analysis/CreateAnalysisPage.jsx';
import AnalysisDetailPage from './pages/analysis/AnalysisDetailPage.jsx';

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Guest Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected Application Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/resumes" element={<ResumesPage />} />
                <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/:jobId" element={<JobDetailPage />} />
                <Route path="/analyses" element={<AnalysesPage />} />
                <Route path="/analyses/new" element={<CreateAnalysisPage />} />
                <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
              </Route>
            </Route>

            {/* 404 Fallback */}
            <Route
              path="*"
              element={
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="card" style={{ textAlign: 'center', maxWidth: '400px' }}>
                    <h2 style={{ marginBottom: '0.5rem' }}>404 - Page Not Found</h2>
                    <p style={{ marginBottom: '1.5rem' }}>The requested page does not exist.</p>
                    <a href="/dashboard" className="btn btn-primary">
                      Return to Dashboard
                    </a>
                  </div>
                </div>
              }
            />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
