import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import AuthLayout from './layouts/AuthLayout.jsx';
import ProtectedRoute from './layouts/ProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';

// Stage 1 Route Mount Placeholders (full pages implemented in Stages 2-5)
const PlaceholderPage = ({ title, stage }) => (
  <div className="card">
    <div className="card-header">
      <h2 className="card-title">{title}</h2>
      <span className="badge badge-processing">Stage {stage} Planned</span>
    </div>
    <p style={{ color: 'var(--text-secondary)' }}>
      Stage 1 Client Foundation & Centralized API Layer active. This view will be fully implemented in Stage {stage}.
    </p>
  </div>
);

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public Guest Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<PlaceholderPage title="Login" stage="2" />} />
              <Route path="/register" element={<PlaceholderPage title="Register" stage="2" />} />
            </Route>

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<PlaceholderPage title="Dashboard Overview" stage="2" />} />
                <Route path="/resumes" element={<PlaceholderPage title="Resume Management" stage="3" />} />
                <Route path="/resumes/:resumeId" element={<PlaceholderPage title="Resume Details" stage="3" />} />
                <Route path="/jobs" element={<PlaceholderPage title="Job Description Management" stage="4" />} />
                <Route path="/jobs/:jobId" element={<PlaceholderPage title="Job Details" stage="4" />} />
                <Route path="/analyses" element={<PlaceholderPage title="Historical Analyses" stage="5" />} />
                <Route path="/analyses/new" element={<PlaceholderPage title="New Compatibility Match" stage="5" />} />
                <Route path="/analyses/:analysisId" element={<PlaceholderPage title="Analysis & Recommendations Report" stage="5" />} />
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
