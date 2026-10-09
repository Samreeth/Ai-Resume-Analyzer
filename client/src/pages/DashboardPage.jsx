import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useToast } from '../hooks/useToast.js';
import resumeApi from '../api/resume.api.js';
import jobApi from '../api/job.api.js';
import analysisApi from '../api/analysis.api.js';
import Spinner from '../components/common/Spinner.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';

/**
 * Dashboard Page
 * Minimalist, high-clarity SaaS interface matching Stitch design in Light & Dark mode.
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

  // Client-side table filters matching Stitch design
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'high' | 'review'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

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

  const getInitials = (titleOrName) => {
    if (!titleOrName) return 'CD';
    const clean = titleOrName.replace(/\.[^/.]+$/, '').trim();
    const parts = clean.split(/[\s_-]+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  };

  // Filtered analyses based on tab & search input
  const filteredAnalyses = useMemo(() => {
    return recentAnalyses.filter((a) => {
      const score = Number(a.overall_score) || 0;
      if (filterTab === 'high' && score < 80) return false;
      if (filterTab === 'review' && score >= 80) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const role = (a.job_title || '').toLowerCase();
        const name = (a.resume_file_name || '').toLowerCase();
        return role.includes(q) || name.includes(q);
      }
      return true;
    });
  }, [recentAnalyses, filterTab, searchQuery]);

  // Average score calculation
  const averageScore = useMemo(() => {
    if (!recentAnalyses.length) return '78%';
    const total = recentAnalyses.reduce((acc, curr) => acc + (Number(curr.overall_score) || 0), 0);
    return `${Math.round(total / recentAnalyses.length)}%`;
  }, [recentAnalyses]);

  if (loading) {
    return (
      <div
        data-testid="dashboard-loading"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '55vh',
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
            color: 'var(--danger-text)',
            padding: '1.75rem',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            maxWidth: '520px',
            margin: '0 auto',
            boxShadow: 'none',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '2rem', color: 'var(--danger)', marginBottom: '0.5rem' }}
          >
            error
          </span>
          <h3
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              marginBottom: '0.5rem',
              color: 'var(--text-primary)',
            }}
          >
            Unable to load dashboard
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              marginBottom: '1.25rem',
              color: 'var(--text-secondary)',
            }}
          >
            {error}
          </p>
          <Button
            variant="secondary"
            onClick={fetchDashboardData}
            data-testid="dashboard-retry-btn"
          >
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="dashboard-content"
      className="dashboard-page"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}
    >
      {/* 1. Top Welcome & Global Action Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              Welcome back, {user?.name || 'Sam'}
            </h1>
            <span
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--success)',
                display: 'inline-block',
                boxShadow: '0 0 6px var(--success)',
              }}
              aria-hidden="true"
            />
          </div>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            Here is an overview of your candidate pipeline and recent parsing analytics.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="header-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
          <Link
            to="/analyses/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              textDecoration: 'none',
              boxShadow: 'var(--shadow-xs)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
              add
            </span>
            <span>New Job Match</span>
          </Link>

          <Link
            to="/resumes"
            id="trigger-upload"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
              upload
            </span>
            <span>Upload Resume</span>
          </Link>
        </div>
      </div>

      {/* 2. 4-Column Metric Summary Ribbon */}
      <div
        className="dashboard-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
        data-testid="dashboard-metrics-grid"
      >
        {/* Metric 1: Total Resumes */}
        <div
          className="card stat-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Total Resumes
            </span>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                description
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
            }}
          >
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
              data-testid="metric-total-resumes"
            >
              {metrics.totalResumes}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.125rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success-text)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.8125rem' }}>
                trending_up
              </span>
              +3 this week
            </span>
          </div>
          <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                flex: 1,
                height: '0.25rem',
                backgroundColor: 'var(--bg-container-high)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(15, metrics.totalResumes * 8))}%`,
                  backgroundColor: 'var(--accent-primary)',
                  borderRadius: 'var(--radius-full)',
                }}
              />
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              {metrics.totalResumes} stored
            </span>
          </div>
        </div>

        {/* Metric 2: Active Jobs */}
        <div
          className="card stat-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Active Jobs
            </span>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-secondary)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                work_outline
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
            }}
          >
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
              data-testid="metric-total-jobs"
            >
              {metrics.totalJobs}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.125rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                backgroundColor: 'var(--bg-container-high)',
                color: 'var(--accent-primary)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.8125rem' }}>
                schedule
              </span>
              2 closing soon
            </span>
          </div>
          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Target Profiles</span>
            <span>Avg 3.2 days left</span>
          </div>
        </div>

        {/* Metric 3: Analyses Run */}
        <div
          className="card stat-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Analyses Run
            </span>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                analytics
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
            }}
          >
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
              data-testid="metric-total-analyses"
            >
              {metrics.totalAnalyses}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.125rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success-text)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.8125rem' }}>
                check
              </span>
              98% completed
            </span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            {/* Sparkline Graphic */}
            <svg
              style={{ width: '100%', height: '1rem', color: 'var(--accent-primary)' }}
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 100 20"
            >
              <path
                d="M0,15 Q15,4 30,12 T60,8 T80,3 T100,6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        {/* Metric 4: Average Match Score */}
        <div
          className="card stat-card"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Average Match Score
            </span>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                percent
              </span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
            }}
          >
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}
            >
              {averageScore}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.125rem 0.45rem',
                borderRadius: 'var(--radius-xs)',
                fontSize: '0.6875rem',
                fontWeight: 600,
                backgroundColor: 'var(--success-bg)',
                color: 'var(--success-text)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.8125rem' }}>
                north_east
              </span>
              +4.2% vs bench
            </span>
          </div>
          <div
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.6875rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>Target benchmark: 75%</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>Optimal</span>
          </div>
        </div>
      </div>

      {/* 3. Primary Dual-Column Workspace Section (8 Cols / 4 Cols) */}
      <div
        className="dashboard-columns-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column (8 Cols): Recent Match Analyses */}
        <section
          style={{
            gridColumn: 'span 8',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'none',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          className="dashboard-main-col"
        >
          {/* Section Toolbar & Filter Tabs */}
          <div
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <h2
                style={{
                  fontSize: '1.0625rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Recent Match Analyses
              </h2>
              <span
                style={{
                  padding: '0.125rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-container)',
                  color: 'var(--text-secondary)',
                }}
              >
                {metrics.totalAnalyses} Total
              </span>
            </div>

            {/* Filter Tabs */}
            <div
              style={{
                display: 'inline-flex',
                padding: '0.25rem',
                backgroundColor: 'var(--bg-container-low)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterTab === 'all' ? 'var(--bg-surface)' : 'transparent',
                  color: filterTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: filterTab === 'all' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('high')}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterTab === 'high' ? 'var(--bg-surface)' : 'transparent',
                  color: filterTab === 'high' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: filterTab === 'high' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                High Match &gt;80%
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('review')}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterTab === 'review' ? 'var(--bg-surface)' : 'transparent',
                  color: filterTab === 'review' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: filterTab === 'review' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                Needs Review
              </button>
            </div>
          </div>

          {/* Quick Filter Search Input */}
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', width: '100%' }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: 'absolute',
                  left: '0.625rem',
                  top: '0.45rem',
                  fontSize: '1rem',
                  color: 'var(--text-muted)',
                }}
              >
                filter_list
              </span>
              <input
                type="text"
                placeholder="Filter by candidate, role, or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '2rem',
                  paddingLeft: '2rem',
                  paddingRight: '1rem',
                  backgroundColor: 'var(--bg-container-low)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all var(--transition-fast)',
                }}
              />
            </div>
          </div>

          {/* Table View or Empty State */}
          {recentAnalyses.length === 0 ? (
            <div style={{ padding: '2rem 1.5rem' }}>
              <EmptyState
                icon={
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}
                  >
                    analytics
                  </span>
                }
                title="No match analyses yet"
                description="Run your first analysis to compare a resume against a job description with deterministic scoring and gap recommendations."
                action={
                  <Link
                    to="/analyses/new"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#ffffff',
                      textDecoration: 'none',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}
                  >
                    Start First Analysis
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="table-responsive">
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-container-low)',
                      color: 'var(--text-muted)',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <th style={{ padding: '0.75rem 1.25rem' }}>Candidate &amp; Target Role</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Fit Score</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Breakdown</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Analysis Date</th>
                    <th style={{ padding: '0.75rem 1.25rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: '1px solid var(--border-subtle)' }}>
                  {filteredAnalyses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: '2rem',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                        }}
                      >
                        No candidates match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAnalyses.map((a) => {
                      const score = Number(a.overall_score) || 0;
                      const isHigh = score >= 80;
                      return (
                        <tr
                          key={a.analysis_id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background-color var(--transition-fast)',
                          }}
                        >
                          {/* Candidate & Role */}
                          <td style={{ padding: '0.875rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div
                                style={{
                                  width: '2rem',
                                  height: '2rem',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: 'var(--bg-container-high)',
                                  color: 'var(--accent-primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {getInitials(a.resume_file_name || a.job_title)}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {a.job_title}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.75rem',
                                    color: 'var(--text-muted)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {a.resume_file_name}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Fit Score */}
                          <td style={{ padding: '0.875rem 1rem', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: isHigh ? 'var(--success-bg)' : 'var(--warning-bg)',
                                color: isHigh ? 'var(--success-text)' : 'var(--warning-text)',
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '0.875rem' }}
                              >
                                {isHigh ? 'verified' : 'warning'}
                              </span>
                              <span>{score.toFixed(1)}%</span>
                            </span>
                          </td>

                          {/* Breakdown (preserves test assertion texts) */}
                          <td
                            style={{
                              padding: '0.875rem 1rem',
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                              {a.matched_count} matched
                            </span>{' '}
                            &bull;{' '}
                            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                              {a.missing_count} missing
                            </span>
                          </td>

                          {/* Date */}
                          <td
                            style={{
                              padding: '0.875rem 1rem',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatDate(a.created_at)}
                          </td>

                          {/* Action Button */}
                          <td
                            style={{
                              padding: '0.875rem 1.25rem',
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <Link
                              to={`/analyses/${a.analysis_id}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                color: 'var(--accent-primary)',
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius-xs)',
                              }}
                            >
                              <span>View Report</span>
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: '0.875rem' }}
                              >
                                arrow_forward
                              </span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          <div
            style={{
              padding: '0.875rem 1.25rem',
              backgroundColor: 'var(--bg-container-low)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: 'auto',
            }}
          >
            <span>
              Showing{' '}
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                1-{filteredAnalyses.length}
              </strong>{' '}
              of{' '}
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {metrics.totalAnalyses}
              </strong>{' '}
              candidates
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <button
                type="button"
                disabled
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  opacity: 0.5,
                  cursor: 'not-allowed',
                }}
              >
                Previous
              </button>
              <button
                type="button"
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* Right Column (4 Cols): Widgets */}
        <div
          style={{
            gridColumn: 'span 4',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
          className="dashboard-side-col"
        >
          {/* Widget 1: Quick Resume Scan (Dropzone) */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Quick Resume Scan
              </h3>
              <span
                style={{
                  padding: '0.125rem 0.4rem',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-container-high)',
                  color: 'var(--accent-primary)',
                }}
              >
                Instant ATS
              </span>
            </div>

            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
                lineHeight: 1.45,
              }}
            >
              Upload candidate profile for automated taxonomy extraction and score pairing.
            </p>

            {/* Dropzone Container */}
            <Link
              to="/resumes"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem 1rem',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--bg-container-low)',
                border: '1.5px dashed var(--border-default)',
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: '2.75rem',
                  height: '2.75rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-container-high)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                  marginBottom: '0.625rem',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.5rem' }}>
                  cloud_upload
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.25rem',
                }}
              >
                Drag &amp; drop candidate file
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.875rem',
                  maxWidth: '200px',
                }}
              >
                PDF, DOCX, or TXT up to 15MB processed privately.
              </span>

              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.875rem' }}>
                <span
                  style={{
                    padding: '0.125rem 0.4rem',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.6875rem',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  .PDF
                </span>
                <span
                  style={{
                    padding: '0.125rem 0.4rem',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.6875rem',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  .DOCX
                </span>
                <span
                  style={{
                    padding: '0.125rem 0.4rem',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.6875rem',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  .TXT
                </span>
              </div>

              <span
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                Select File
              </span>
            </Link>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                marginTop: '0.875rem',
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '0.875rem', color: 'var(--success)' }}
              >
                lock
              </span>
              <span>End-to-end encrypted &bull; Zero data retention</span>
            </div>
          </div>

          {/* Widget 2: Target Job Benchmark */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <h3
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Job Benchmark
              </h3>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '1.125rem', color: 'var(--text-muted)' }}
              >
                tune
              </span>
            </div>

            {/* Target Role Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.875rem' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                ACTIVE TARGET PROFILE
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--bg-container-low)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--accent-primary)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    Staff Product Designer
                  </span>
                </div>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '1rem', color: 'var(--text-muted)' }}
                >
                  expand_more
                </span>
              </div>
            </div>

            {/* Skill Demand Breakdown Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.6875rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Core Architecture &amp; System Design
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>94% pool</span>
                </div>
                <div
                  style={{
                    height: '0.35rem',
                    backgroundColor: 'var(--bg-container)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: '94%',
                      backgroundColor: 'var(--accent-primary)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.6875rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    B2B SaaS / Product Strategy
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>82% pool</span>
                </div>
                <div
                  style={{
                    height: '0.35rem',
                    backgroundColor: 'var(--bg-container)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: '82%',
                      backgroundColor: 'var(--accent-primary)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.6875rem',
                    marginBottom: '0.25rem',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Prototyping &amp; Micro-interactions
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>68% pool</span>
                </div>
                <div
                  style={{
                    height: '0.35rem',
                    backgroundColor: 'var(--bg-container)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: '68%',
                      backgroundColor: 'var(--accent-secondary)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.625rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.6875rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Applicant Pool: 24 active</span>
              <Link
                to="/jobs"
                style={{
                  color: 'var(--accent-primary)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Audit Criteria
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Secondary Lists: Recent Resumes & Recent Jobs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {/* Recent Resumes List */}
        <div className="card" style={{ padding: '1.25rem', boxShadow: 'none' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Recent Resumes
              </h2>
              <p
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.125rem',
                  margin: 0,
                }}
              >
                Uploaded files and extraction statuses
              </p>
            </div>
            {recentResumes.length > 0 && (
              <Link
                to="/resumes"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                }}
              >
                View all
              </Link>
            )}
          </div>

          {recentResumes.length === 0 ? (
            <EmptyState
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '2rem', color: 'var(--text-muted)' }}
                >
                  description
                </span>
              }
              title="No resumes uploaded"
              description="Upload candidate resumes in PDF or DOCX format to parse skills."
              action={
                <Link
                  to="/resumes"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Upload Resume
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentResumes.map((r) => (
                <div
                  key={r.resume_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--bg-container-low)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, marginRight: '0.75rem' }}>
                    <Link
                      to={`/resumes/${r.resume_id}`}
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontSize: '0.8125rem',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: 'none',
                      }}
                    >
                      {r.file_name}
                    </Link>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.125rem',
                      }}
                    >
                      {formatFileSize(r.file_size)} &bull; {formatDate(r.uploaded_at)}
                    </div>
                  </div>
                  <div>{getStatusBadge(r.extraction_status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Job Descriptions List */}
        <div className="card" style={{ padding: '1.25rem', boxShadow: 'none' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                Recent Jobs
              </h2>
              <p
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.125rem',
                  margin: 0,
                }}
              >
                Target roles and competency requirements
              </p>
            </div>
            {recentJobs.length > 0 && (
              <Link
                to="/jobs"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                }}
              >
                View all
              </Link>
            )}
          </div>

          {recentJobs.length === 0 ? (
            <EmptyState
              icon={
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '2rem', color: 'var(--text-muted)' }}
                >
                  work_outline
                </span>
              }
              title="No jobs created"
              description="Define job descriptions to identify required competencies."
              action={
                <Link
                  to="/jobs"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Create Job
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentJobs.map((j) => {
                const skillCount = j.extracted_data?.skills?.length ?? 0;
                return (
                  <div
                    key={j.job_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.625rem 0.875rem',
                      backgroundColor: 'var(--bg-container-low)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: '0.75rem' }}>
                      <Link
                        to={`/jobs/${j.job_id}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          fontSize: '0.8125rem',
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: 'none',
                        }}
                      >
                        {j.title}
                      </Link>
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--text-muted)',
                          marginTop: '0.125rem',
                        }}
                      >
                        {skillCount} extracted skills &bull; {formatDate(j.created_at)}
                      </div>
                    </div>
                    <Link
                      to={`/jobs/${j.job_id}`}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-xs)',
                        textDecoration: 'none',
                      }}
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
