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
import StatCard from '../components/common/StatCard.jsx';
import Badge from '../components/common/Badge.jsx';
import Icon from '../components/common/Icon.jsx';

/**
 * Dashboard Page
 * High-performance developer overview of Resumes, Job Descriptions, and Match Analyses.
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
        return <Badge variant="completed">Completed</Badge>;
      case 'PROCESSING':
        return <Badge variant="processing">Processing</Badge>;
      case 'PENDING':
        return <Badge variant="pending">Pending</Badge>;
      case 'FAILED':
        return <Badge variant="failed">Failed</Badge>;
      default:
        return <Badge variant="neutral">{status || 'Unknown'}</Badge>;
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
            padding: '1.75rem',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'inline-flex', marginBottom: '0.75rem' }}>
            <Icon name="alert" size={28} />
          </div>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Unable to load dashboard
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
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
      {/* Welcome Hero Area */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--success)',
                display: 'inline-block',
                boxShadow: '0 0 8px var(--success)',
              }}
              aria-hidden="true"
            />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              System Active &bull; Offline Deterministic Engine
            </span>
          </div>

          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Welcome back, {user?.name || 'User'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>
            Telemetry overview and quick access to resumes, jobs, and evaluations
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link to="/resumes" className="btn btn-secondary btn-sm">
            <Icon name="upload" size={14} />
            <span>Upload Resume</span>
          </Link>
          <Link to="/jobs" className="btn btn-secondary btn-sm">
            <Icon name="jobs" size={14} />
            <span>Create Job</span>
          </Link>
          <Link to="/analyses/new" className="btn btn-primary btn-sm">
            <Icon name="sparkles" size={14} />
            <span>Run Match Analysis</span>
          </Link>
        </div>
      </div>

      {/* Metrics Summary Grid using StatCard */}
      <div className="grid grid-cols-3 gap-6" data-testid="dashboard-metrics-grid">
        <StatCard
          title="Total Resumes"
          value={metrics.totalResumes}
          icon={<Icon name="resume" size={20} />}
          subtitle="Processed & stored in secure vault"
          linkTo="/resumes"
          linkText="View all resumes"
          valueTestId="metric-total-resumes"
        />

        <StatCard
          title="Job Descriptions"
          value={metrics.totalJobs}
          icon={<Icon name="jobs" size={20} />}
          subtitle="Target roles & competency profiles"
          linkTo="/jobs"
          linkText="Manage job descriptions"
          valueTestId="metric-total-jobs"
        />

        <StatCard
          title="Match Analyses"
          value={metrics.totalAnalyses}
          icon={<Icon name="analyses" size={20} />}
          subtitle="Deterministic evaluation reports"
          linkTo="/analyses"
          linkText="View match evaluations"
          valueTestId="metric-total-analyses"
        />
      </div>

      {/* Recent Match Analyses Section */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Recent Match Analyses</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Latest candidate-to-job compatibility assessments
            </p>
          </div>
          {recentAnalyses.length > 0 && (
            <Link
              to="/analyses"
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--accent-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>View all ({metrics.totalAnalyses})</span>
              <Icon name="arrow-right" size={12} />
            </Link>
          )}
        </div>

        {recentAnalyses.length === 0 ? (
          <div style={{ padding: '1.5rem' }}>
            <EmptyState
              icon={<Icon name="chart" size={32} />}
              title="No match analyses yet"
              description="Run your first analysis to compare a resume against a job description with deterministic scoring and gap recommendations."
              action={
                <Link to="/analyses/new" className="btn btn-primary btn-sm">
                  Start First Analysis
                </Link>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Candidate Resume</th>
                  <th>Overall Score</th>
                  <th>Skill Breakdown</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalyses.map((a) => {
                  const score = Number(a.overall_score) || 0;
                  return (
                    <tr key={a.analysis_id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link
                          to={`/analyses/${a.analysis_id}`}
                          style={{
                            color: 'var(--text-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                          }}
                        >
                          <span>{a.job_title}</span>
                          <Icon name="arrow-up-right" size={12} style={{ color: 'var(--text-muted)' }} />
                        </Link>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Icon name="file" size={14} style={{ color: 'var(--text-muted)' }} />
                          {a.resume_file_name}
                        </span>
                      </td>
                      <td>
                        <span
                          className="tabular-nums"
                          style={{
                            fontWeight: 700,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-elevated)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {score.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{a.matched_count} matched</span>
                        {' '}&bull;{' '}
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{a.missing_count} missing</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        {formatDate(a.created_at)}
                      </td>
                    </tr>
                  );
                })}
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
              <Link to="/resumes" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                View all
              </Link>
            )}
          </div>

          {recentResumes.length === 0 ? (
            <EmptyState
              icon={<Icon name="resume" size={32} />}
              title="No resumes uploaded"
              description="Upload candidate resumes in PDF or DOCX format to parse skills."
              action={
                <Link to="/resumes" className="btn btn-secondary btn-sm">
                  Upload Resume
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {recentResumes.map((r) => (
                <div
                  key={r.resume_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'border-color var(--transition-fast)',
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
              <Link to="/jobs" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-primary)' }}>
                View all
              </Link>
            )}
          </div>

          {recentJobs.length === 0 ? (
            <EmptyState
              icon={<Icon name="jobs" size={32} />}
              title="No jobs created"
              description="Define job descriptions to identify required competencies."
              action={
                <Link to="/jobs" className="btn btn-secondary btn-sm">
                  Create Job
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {recentJobs.map((j) => {
                const skillCount = j.extracted_data?.skills?.length ?? 0;
                return (
                  <div
                    key={j.job_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      transition: 'border-color var(--transition-fast)',
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
                    <Link
                      to={`/jobs/${j.job_id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.25rem 0.5rem', fontSize: 'var(--text-xs)' }}
                    >
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
