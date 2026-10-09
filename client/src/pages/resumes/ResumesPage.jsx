import React, { useState, useEffect, useCallback, useMemo } from 'react';
import resumeApi from '../../api/resume.api.js';
import { useToast } from '../../hooks/useToast.js';
import ResumeCard from '../../components/resumes/ResumeCard.jsx';
import ResumeUpload from '../../components/resumes/ResumeUpload.jsx';
import DeleteResumeDialog from '../../components/resumes/DeleteResumeDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';

/**
 * Resumes List Page
 * Minimalist, clean card grid view matching Stitch design with status filters and quick search.
 * Includes a permanently visible top upload dropzone.
 */
export const ResumesPage = () => {
  const toast = useToast();

  const [resumes, setResumes] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Client-side filter toolbar states matching Stitch
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'PROCESSING' | 'PENDING' | 'FAILED'
  const [searchQuery, setSearchQuery] = useState('');

  // Deletion modal state
  const [resumeToDelete, setResumeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchResumes = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await resumeApi.listResumes({ page, limit: 10 });
      setResumes(data.resumes || []);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        });
      }
    } catch (err) {
      const msg = err.message || 'Failed to load resumes.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchResumes(pagination.page);
  }, [fetchResumes, pagination.page]);

  const handleUploadSuccess = () => {
    fetchResumes(1);
  };

  const openDeleteDialog = (resume) => {
    setResumeToDelete(resume);
    setDeleteError('');
  };

  const closeDeleteDialog = () => {
    if (!isDeleting) {
      setResumeToDelete(null);
      setDeleteError('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!resumeToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError('');

      await resumeApi.deleteResume(resumeToDelete.resume_id);
      toast.success(`Resume "${resumeToDelete.file_name}" deleted.`);

      setResumeToDelete(null);

      const nextPage =
        resumes.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      fetchResumes(nextPage);
    } catch (err) {
      const msg = err.message || 'Failed to delete resume.';
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered resumes based on status filter & search query
  const filteredResumes = useMemo(() => {
    return resumes.filter((r) => {
      const status = String(r.extraction_status || '').toUpperCase();
      if (statusFilter !== 'ALL' && status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (r.file_name || '').toLowerCase();
        const cand = (r.extracted_data?.candidate?.name || '').toLowerCase();
        return name.includes(q) || cand.includes(q);
      }
      return true;
    });
  }, [resumes, statusFilter, searchQuery]);

  // Counts for pills
  const statusCounts = useMemo(() => {
    const counts = { ALL: resumes.length, COMPLETED: 0, PROCESSING: 0, PENDING: 0, FAILED: 0 };
    resumes.forEach((r) => {
      const s = String(r.extraction_status || '').toUpperCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [resumes]);

  return (
    <div
      data-testid="resumes-page"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}
    >
      {/* 1. Top Action & Header Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
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
            Resumes
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Upload, inspect, and evaluate candidate resume documents.
          </p>
        </div>

        <div className="header-actions-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* View Toggle (Grid / List visual indicator) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem',
              backgroundColor: 'var(--bg-container-low)',
              borderRadius: 'var(--radius-md)',
              gap: '0.125rem',
            }}
          >
            <button
              type="button"
              aria-label="Grid View"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--accent-primary)',
                border: 'none',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                grid_view
              </span>
            </button>
            <button
              type="button"
              aria-label="Table View"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                table_rows
              </span>
            </button>
          </div>

          {/* Quick Browse button that triggers file selector */}
          <Button
            type="button"
            variant="primary"
            onClick={() => document.getElementById('resume-file-input')?.click()}
            id="quick-upload-trigger-btn"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
              add
            </span>
            <span>Upload Resume</span>
          </Button>
        </div>
      </div>

      {/* 2. Fixed, Permanently Visible Upload Dropzone Card */}
      <ResumeUpload
        onUploadSuccess={handleUploadSuccess}
        onError={() => {}}
      />

      {/* 3. Search & Filter Controls Toolbar */}
      {!isLoading && !error && resumes.length > 0 && (
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
              placeholder="Search resumes..."
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

          {/* Filter Pills */}
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
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: statusFilter === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-card)',
                color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all var(--transition-fast)',
              }}
            >
              All ({statusCounts.ALL})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('COMPLETED')}
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
                backgroundColor: statusFilter === 'COMPLETED' ? 'var(--success-bg)' : 'var(--bg-card)',
                color: statusFilter === 'COMPLETED' ? 'var(--success-text)' : 'var(--text-secondary)',
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
              <span>Completed ({statusCounts.COMPLETED})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PROCESSING')}
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
                backgroundColor: statusFilter === 'PROCESSING' ? 'var(--accent-muted)' : 'var(--bg-card)',
                color: statusFilter === 'PROCESSING' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span
                style={{
                  width: '0.45rem',
                  height: '0.45rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-primary)',
                }}
              />
              <span>Processing ({statusCounts.PROCESSING})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PENDING')}
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
                backgroundColor: statusFilter === 'PENDING' ? 'var(--warning-bg)' : 'var(--bg-card)',
                color: statusFilter === 'PENDING' ? 'var(--warning-text)' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow-xs)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span
                style={{
                  width: '0.45rem',
                  height: '0.45rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--warning)',
                }}
              />
              <span>Pending ({statusCounts.PENDING})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('FAILED')}
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
                backgroundColor: statusFilter === 'FAILED' ? 'var(--danger-bg)' : 'var(--bg-card)',
                color: statusFilter === 'FAILED' ? 'var(--danger-text)' : 'var(--text-secondary)',
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
              <span>Failed ({statusCounts.FAILED})</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Loading State */}
      {isLoading && (
        <div
          data-testid="resumes-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading resumes..." />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Loading candidate resumes...
          </p>
        </div>
      )}

      {/* 5. Error State */}
      {!isLoading && error && (
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
          }}
          data-testid="resumes-error"
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
            Unable to load resumes
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
            onClick={() => fetchResumes(pagination.page)}
            data-testid="resumes-retry-btn"
          >
            Retry Loading
          </Button>
        </div>
      )}

      {/* 6. Empty State */}
      {!isLoading && !error && resumes.length === 0 && (
        <EmptyState
          icon={
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }}
            >
              description
            </span>
          }
          title="No resumes uploaded yet"
          description="Upload your first resume in PDF or DOCX format to parse and evaluate candidates against job requirements."
          action={
            <Button
              variant="primary"
              onClick={() => document.getElementById('resume-file-input')?.click()}
              data-testid="empty-upload-btn"
            >
              Upload First Resume
            </Button>
          }
        />
      )}

      {/* 7. Resumes Card Grid (2 Columns) */}
      {!isLoading && !error && resumes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredResumes.length === 0 ? (
            <div
              style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              No candidate resumes match the active search or status filter.
            </div>
          ) : (
            <div
              className="resumes-grid"
              data-testid="resumes-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.25rem',
                minHeight: '100px',
              }}
            >
              {filteredResumes.map((resume) => (
                <ResumeCard
                  key={resume.resume_id}
                  resume={resume}
                  onDeleteClick={openDeleteDialog}
                />
              ))}
            </div>
          )}

          {/* 8. Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-subtle)',
                marginTop: 'auto',
              }}
              data-testid="resumes-pagination"
            >
              <div
                style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}
                className="tabular-nums"
              >
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} resumes
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
                <span
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    padding: '0 0.5rem',
                  }}
                  className="tabular-nums"
                >
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

      {/* 9. Delete Confirmation Modal */}
      <DeleteResumeDialog
        isOpen={Boolean(resumeToDelete)}
        resumeName={resumeToDelete?.file_name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default ResumesPage;
