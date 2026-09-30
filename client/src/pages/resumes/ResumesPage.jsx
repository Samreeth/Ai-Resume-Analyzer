import React, { useState, useEffect, useCallback } from 'react';
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
 * Displays user's uploaded resumes with pagination, upload widget, and deletion flow.
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
  const [showUpload, setShowUpload] = useState(false);

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

  const handleUploadSuccess = (newResume) => {
    setShowUpload(false);
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

      // Re-fetch page (if current page becomes empty and page > 1, go to previous)
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

  return (
    <div data-testid="resumes-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Resume Management
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Upload, inspect, and manage candidate resume documents
          </p>
        </div>

        <Button
          type="button"
          variant={showUpload ? 'secondary' : 'primary'}
          onClick={() => setShowUpload((prev) => !prev)}
          data-testid="toggle-upload-btn"
        >
          {showUpload ? 'Close Upload' : 'Upload Resume'}
        </Button>
      </div>

      {/* Upload Widget (Togglable or if empty) */}
      {showUpload && (
        <div style={{ animation: 'slideIn 0.2s ease-out' }}>
          <ResumeUpload
            onUploadSuccess={handleUploadSuccess}
            onError={() => {}}
          />
        </div>
      )}

      {/* Loading State */}
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
          data-testid="resumes-error"
        >
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
            Unable to load resumes
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
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

      {/* Empty State */}
      {!isLoading && !error && resumes.length === 0 && (
        <EmptyState
          icon="📄"
          title="No resumes uploaded yet"
          description="Upload your first resume in PDF or DOCX format to parse and evaluate candidates against job requirements."
          action={
            !showUpload && (
              <Button
                variant="primary"
                onClick={() => setShowUpload(true)}
                data-testid="empty-upload-btn"
              >
                Upload First Resume
              </Button>
            )
          }
        />
      )}

      {/* Resumes Grid */}
      {!isLoading && !error && resumes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            className="grid grid-cols-2 gap-4"
            data-testid="resumes-grid"
            style={{ minHeight: '100px' }}
          >
            {resumes.map((resume) => (
              <ResumeCard
                key={resume.resume_id}
                resume={resume}
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
              data-testid="resumes-pagination"
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
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
