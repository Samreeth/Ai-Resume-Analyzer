import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import analysisApi from '../../api/analysis.api.js';
import { useToast } from '../../hooks/useToast.js';
import AnalysisCard from '../../components/analysis/AnalysisCard.jsx';
import DeleteAnalysisDialog from '../../components/analysis/DeleteAnalysisDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';

/**
 * Historical Analyses List Page
 * Displays candidate-to-job matching reports with pagination and deletion flow.
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

  return (
    <div data-testid="analyses-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Page Header */}
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
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Match Analyses
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Historical compatibility evaluations, skill alignments, and actionable recommendation reports
          </p>
        </div>

        <Link to="/analyses/new" className="btn btn-primary" data-testid="new-analysis-cta">
          New Analysis
        </Link>
      </div>

      {/* Loading State */}
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

      {/* Error State */}
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
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
            Unable to load analyses
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
            {error}
          </p>
          <Button
            variant="secondary"
            onClick={() => fetchAnalyses(pagination.page)}
            data-testid="analyses-retry-btn"
          >
            Retry Loading
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && analyses.length === 0 && (
        <EmptyState
          icon="📊"
          title="No compatibility analyses yet"
          description="Evaluate a candidate resume against target job description criteria to generate match scores, detect skill gaps, and view actionable recommendations."
          action={
            <Link to="/analyses/new" className="btn btn-primary" data-testid="empty-create-analysis-btn">
              Run First Analysis
            </Link>
          }
        />
      )}

      {/* Analyses Grid */}
      {!isLoading && !error && analyses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            className="grid grid-cols-2 gap-4"
            data-testid="analyses-grid"
            style={{ minHeight: '100px' }}
          >
            {analyses.map((analysis) => (
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
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
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
                >
                  &larr; Previous
                </Button>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  data-testid="pagination-next-btn"
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
