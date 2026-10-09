import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import analysisApi from '../../api/analysis.api.js';
import { useToast } from '../../hooks/useToast.js';
import AnalysisCard from '../../components/analysis/AnalysisCard.jsx';
import DeleteAnalysisDialog from '../../components/analysis/DeleteAnalysisDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';

/**
 * Historical Analyses List Page
 * Displays candidate-to-job matching reports with search/filters, pagination, and deletion flow.
 * Clean, minimalist SaaS interface inspired by Stitch & Linear design.
 */
export const AnalysesPage = () => {
  const toast = useToast();

  const [analyses, setAnalyses] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreFilter, setScoreFilter] = useState('ALL'); // 'ALL' | 'HIGH' (> 80%) | 'LOW' (< 60%)
  const [sortBy, setSortBy] = useState('NEWEST'); // 'NEWEST' | 'SCORE_DESC'

  // Deletion modal state
  const [analysisToDelete, setAnalysisToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchAnalyses = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await analysisApi.listAnalyses({ page, limit: 10 });
      setAnalyses(data.analyses || []);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        });
      }
    } catch (err) {
      const msg = err.message || 'Failed to load analyses.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAnalyses(pagination.page);
  }, [fetchAnalyses, pagination.page]);

  const openDeleteDialog = (analysis) => {
    setAnalysisToDelete(analysis);
    setDeleteError('');
  };

  const closeDeleteDialog = () => {
    if (!isDeleting) {
      setAnalysisToDelete(null);
      setDeleteError('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!analysisToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError('');

      await analysisApi.deleteAnalysis(analysisToDelete.analysis_id);
      toast.success('Analysis report deleted.');

      setAnalysisToDelete(null);

      // Re-fetch page (if current page becomes empty and page > 1, go to previous)
      const nextPage =
        analyses.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      fetchAnalyses(nextPage);
    } catch (err) {
      const msg = err.message || 'Failed to delete analysis report.';
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Client-side search and filtering over the currently loaded analyses
  const filteredAnalyses = useMemo(() => {
    let result = [...analyses];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          (a.job_title || '').toLowerCase().includes(q) ||
          (a.resume_file_name || '').toLowerCase().includes(q)
      );
    }

    if (scoreFilter === 'HIGH') {
      result = result.filter((a) => (Number(a.overall_score) || 0) >= 80);
    } else if (scoreFilter === 'LOW') {
      result = result.filter((a) => (Number(a.overall_score) || 0) < 60);
    }

    return result;
  }, [analyses, searchQuery, scoreFilter]);

  // Counts for pills
  const scoreCounts = useMemo(() => {
    let high = 0;
    let low = 0;
    analyses.forEach((a) => {
      const sc = Number(a.overall_score) || 0;
      if (sc >= 80) high++;
      if (sc < 60) low++;
    });
    return { all: analyses.length, high, low };
  }, [analyses]);

  return (
    <div
      data-testid="analyses-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* 1. Page Header & Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Match Analyses
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Historical compatibility evaluations, skill alignments, and actionable recommendation reports
          </p>
        </div>

        <div className="header-actions-group">
          <Link
            to="/analyses/new"
            className="btn btn-primary"
            data-testid="new-analysis-cta"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            <Icon name="sparkles" size={16} />
            <span>New Analysis</span>
          </Link>
        </div>
      </div>

      {/* 2. Loading State */}
      {isLoading && (
        <div
          data-testid="analyses-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading historical analyses..." />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Loading match analysis history...
          </p>
        </div>
      )}

      {/* 3. Error State */}
      {!isLoading && error && (
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
          data-testid="analyses-error"
        >
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Unable to load analyses
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
            {error}
          </p>
          <Button
            variant="secondary"
            onClick={() => fetchAnalyses(pagination.page)}
            data-testid="analyses-retry-btn"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            Retry Loading
          </Button>
        </div>
      )}

      {/* 4. Empty State (Zero analyses exist) */}
      {!isLoading && !error && analyses.length === 0 && (
        <EmptyState
          icon={<Icon name="analyses" size={32} />}
          title="No compatibility analyses yet"
          description="Evaluate a candidate resume against target job description criteria to generate match scores, detect skill gaps, and view actionable recommendations."
          action={
            <Link
              to="/analyses/new"
              className="btn btn-primary"
              data-testid="empty-create-analysis-btn"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              Run First Analysis
            </Link>
          }
        />
      )}

      {/* 5. Analyses Loaded: Search/Filter Bar & Grid */}
      {!isLoading && !error && analyses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Search & Filter Controls Toolbar matching Resumes/Jobs */}
          <div
            className="responsive-toolbar"
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Search Input */}
            <div className="responsive-toolbar-search" style={{ position: 'relative', width: '100%', maxWidth: '20rem' }}>
              <span
                className="material-symbols-outlined"
                style={{
                  position: 'absolute',
                  left: '0.625rem',
                  top: '0.5rem',
                  fontSize: '1rem',
                  color: 'var(--text-muted)',
                }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Search analyses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '2.125rem',
                  paddingLeft: '2.125rem',
                  paddingRight: '0.75rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: 'var(--shadow-xs)',
                }}
              />
            </div>

            {/* Filter Pills matching ResumesPage & JobsPage */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                overflowX: 'auto',
              }}
            >
              <button
                type="button"
                onClick={() => setScoreFilter('ALL')}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: scoreFilter === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-card)',
                  color: scoreFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                All ({scoreCounts.all})
              </button>

              <button
                type="button"
                onClick={() => setScoreFilter('HIGH')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: scoreFilter === 'HIGH' ? 'var(--success-bg)' : 'var(--bg-card)',
                  color: scoreFilter === 'HIGH' ? 'var(--success-text)' : 'var(--text-secondary)',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span
                  style={{
                    width: '0.45rem',
                    height: '0.45rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--success)',
                  }}
                />
                <span>&gt; 80% Match ({scoreCounts.high})</span>
              </button>

              <button
                type="button"
                onClick={() => setScoreFilter('LOW')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: scoreFilter === 'LOW' ? 'var(--danger-bg)' : 'var(--bg-card)',
                  color: scoreFilter === 'LOW' ? 'var(--danger-text)' : 'var(--text-secondary)',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span
                  style={{
                    width: '0.45rem',
                    height: '0.45rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--danger)',
                  }}
                />
                <span>&lt; 60% Match ({scoreCounts.low})</span>
              </button>
            </div>
          </div>

          {/* Analyses Cards Grid */}
          <div
            className="jobs-grid resumes-grid"
            data-testid="analyses-grid"
            style={{ minHeight: '100px' }}
          >
            {filteredAnalyses.map((analysis) => (
              <AnalysisCard
                key={analysis.analysis_id}
                analysis={analysis}
                onDeleteClick={openDeleteDialog}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
              data-testid="analyses-pagination"
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }} className="tabular-nums">
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} analyses
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  data-testid="pagination-prev-btn"
                  style={{ borderRadius: 'var(--radius-full)' }}
                >
                  &larr; Previous
                </Button>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '0 0.5rem' }} className="tabular-nums">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  data-testid="pagination-next-btn"
                  style={{ borderRadius: 'var(--radius-full)' }}
                >
                  Next &rarr;
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteAnalysisDialog
        isOpen={Boolean(analysisToDelete)}
        analysis={analysisToDelete}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default AnalysesPage;
