import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import resumeApi from '../api/resume.api.js';
import jobApi from '../api/job.api.js';
import analysisApi from '../api/analysis.api.js';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Button from '../components/common/Button.jsx';

/**
 * Dashboard Page
 * Renders verified metrics and recent activity for Resumes, Job Descriptions, and Match Analyses.
 */
export const DashboardPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [metrics, setMetrics] = useState({
    totalResumes: 0,
    totalJobs: 0,
    totalAnalyses: 0,
  });

  const [recentResumes, setRecentResumes] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentAnalyses, setRecentAnalyses] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Concurrent fetch of all dashboard datasets using verified limit=5
      const [resumesRes, jobsRes, analysesRes] = await Promise.all([
        resumeApi.listResumes({ page: 1, limit: 5 }),
        jobApi.listJobs({ page: 1, limit: 5 }),
        analysisApi.listAnalyses({ page: 1, limit: 5 }),
      ]);

      setMetrics({
        totalResumes: resumesRes?.pagination?.total ?? 0,
        totalJobs: jobsRes?.pagination?.total ?? 0,
        totalAnalyses: analysesRes?.pagination?.total ?? 0,
      });

      setRecentResumes(resumesRes?.resumes ?? []);
      setRecentJobs(jobsRes?.jobs ?? []);
      setRecentAnalyses(analysesRes?.analyses ?? []);
    } catch (err) {
      const msg = err.message || 'Failed to load dashboard data. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return String(dateStr);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
        return <span className="badge badge-completed">Completed</span>;
      case 'PROCESSING':
        return <span className="badge badge-processing">Processing</span>;
      case 'PENDING':
        return <span className="badge badge-pending">Pending</span>;
      case 'FAILED':
        return <span className="badge badge-failed">Failed</span>;
      default:
        return <span className="badge">{status || 'Unknown'}</span>;
    }
  };

  if (loading) {
    return (
      <div
        data-testid="dashboard-loading"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: '1rem',
        }}
      >
        <Spinner size="lg" ariaLabel="Loading dashboard metrics..." />
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Loading dashboard summary...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="dashboard-error" style={{ padding: '2rem 0' }}>
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
            Unable to load dashboard
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
            {error}
          </p>
          <Button variant="secondary" onClick={fetchDashboardData} data-testid="dashboard-retry-btn">
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Welcome & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Welcome back, {user?.name || 'User'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>
            System overview and quick access to resumes, jobs, and evaluations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/resumes" className="btn btn-secondary btn-sm">
            Upload Resume
          </Link>
          <Link to="/jobs" className="btn btn-secondary btn-sm">
            Post Job
          </Link>
          <Link to="/analyses" className="btn btn-primary btn-sm">
            Run Analysis
          </Link>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-3 gap-6" data-testid="dashboard-metrics-grid">
        {/* Total Resumes */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Resumes
            </span>
            <span style={{ color: 'var(--accent-primary)', fontSize: '1.25rem' }} aria-hidden="true">📄</span>
          </div>
          <div
            style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}
            data-testid="metric-total-resumes"
          >
            {metrics.totalResumes}
          </div>
          <Link
            to="/resumes"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 500, marginTop: 'auto' }}
          >
            View all resumes &rarr;
          </Link>
        </div>

        {/* Total Jobs */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Job Descriptions
            </span>
            <span style={{ color: 'var(--accent-primary)', fontSize: '1.25rem' }} aria-hidden="true">💼</span>
          </div>
          <div
            style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}
            data-testid="metric-total-jobs"
          >
            {metrics.totalJobs}
          </div>
          <Link
            to="/jobs"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 500, marginTop: 'auto' }}
          >
            Manage job descriptions &rarr;
          </Link>
        </div>

        {/* Total Analyses */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Match Analyses
            </span>
            <span style={{ color: 'var(--accent-primary)', fontSize: '1.25rem' }} aria-hidden="true">📊</span>
          </div>
          <div
            style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)' }}
            data-testid="metric-total-analyses"
          >
            {metrics.totalAnalyses}
          </div>
          <Link
            to="/analyses"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-primary)', fontWeight: 500, marginTop: 'auto' }}
          >
            View match evaluations &rarr;
          </Link>
        </div>
      </div>

      {/* Recent Match Analyses Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Recent Match Analyses</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Latest candidate-to-job compatibility assessments
            </p>
          </div>
          {recentAnalyses.length > 0 && (
            <Link to="/analyses" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              View all ({metrics.totalAnalyses})
            </Link>
          )}
        </div>

        {recentAnalyses.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No match analyses yet"
            description="Run your first analysis to compare a resume against a job description with deterministic scoring and gap recommendations."
            action={
              <Link to="/analyses" className="btn btn-primary btn-sm">
                Start First Analysis
              </Link>
            }
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Job Title</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Candidate Resume</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Overall Score</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Skill Breakdown</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalyses.map((a) => (
                  <tr
                    key={a.analysis_id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background-color var(--transition-fast)' }}
                  >
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Link to={`/analyses/${a.analysis_id}`} style={{ color: 'var(--text-primary)' }}>
                        {a.job_title}
                      </Link>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>
                      {a.resume_file_name}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: a.overall_score >= 70 ? 'var(--success)' : a.overall_score >= 40 ? 'var(--warning)' : 'var(--danger)',
                        }}
                      >
                        {a.overall_score}%
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 600 }}>{a.matched_count} matched</span>
                      {' '}&bull;{' '}
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{a.missing_count} missing</span>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                      {formatDate(a.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-Column Grid for Recent Resumes & Recent Jobs */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Resumes */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Resumes</h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Uploaded files and extraction statuses
              </p>
            </div>
            {recentResumes.length > 0 && (
              <Link to="/resumes" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                View all
              </Link>
            )}
          </div>

          {recentResumes.length === 0 ? (
            <EmptyState
              icon="📄"
              title="No resumes uploaded"
              description="Upload candidate resumes in PDF or DOCX format to parse skills."
              action={
                <Link to="/resumes" className="btn btn-secondary btn-sm">
                  Upload Resume
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentResumes.map((r) => (
                <div
                  key={r.resume_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, marginRight: '1rem' }}>
                    <Link
                      to={`/resumes/${r.resume_id}`}
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontSize: 'var(--text-sm)',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.file_name}
                    </Link>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                      {formatFileSize(r.file_size)} &bull; {formatDate(r.uploaded_at)}
                    </div>
                  </div>
                  <div>{getStatusBadge(r.extraction_status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Job Descriptions */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Jobs</h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Target roles and competency requirements
              </p>
            </div>
            {recentJobs.length > 0 && (
              <Link to="/jobs" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                View all
              </Link>
            )}
          </div>

          {recentJobs.length === 0 ? (
            <EmptyState
              icon="💼"
              title="No jobs created"
              description="Define job descriptions to identify required competencies."
              action={
                <Link to="/jobs" className="btn btn-secondary btn-sm">
                  Post New Job
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentJobs.map((j) => {
                const skillCount = j.extracted_data?.skills?.length ?? 0;
                return (
                  <div
                    key={j.job_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: '1rem' }}>
                      <Link
                        to={`/jobs/${j.job_id}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          fontSize: 'var(--text-sm)',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {j.title}
                      </Link>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                        {skillCount} extracted skills &bull; {formatDate(j.created_at)}
                      </div>
                    </div>
                    <Link to={`/jobs/${j.job_id}`} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-xs)' }}>
                      Details
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
