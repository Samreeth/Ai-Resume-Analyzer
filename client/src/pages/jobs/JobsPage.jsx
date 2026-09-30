import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jobApi from '../../api/job.api.js';
import { useToast } from '../../hooks/useToast.js';
import JobCard from '../../components/jobs/JobCard.jsx';
import JobForm from '../../components/jobs/JobForm.jsx';
import DeleteJobDialog from '../../components/jobs/DeleteJobDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';

/**
 * Jobs List Page
 * Displays user's job descriptions with pagination, creation form, and deletion flow.
 */
export const JobsPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Deletion modal state
  const [jobToDelete, setJobToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchJobs = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await jobApi.listJobs({ page, limit: 10 });
      setJobs(data.jobs || []);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          limit: data.pagination.limit,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages,
        });
      }
    } catch (err) {
      const msg = err.message || 'Failed to load job descriptions.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs(pagination.page);
  }, [fetchJobs, pagination.page]);

  const handleCreateJob = async ({ title, description }) => {
    try {
      setIsCreating(true);
      setCreateError('');

      const data = await jobApi.createJob({ title, description });
      const createdJob = data.job || data;

      toast.success(`Job "${createdJob.title || title}" created successfully.`);
      setShowCreate(false);

      if (createdJob.job_id) {
        navigate(`/jobs/${createdJob.job_id}`);
      } else {
        fetchJobs(1);
      }
    } catch (err) {
      const msg = err.message || 'Failed to create job description.';
      setCreateError(msg);
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const openDeleteDialog = (job) => {
    setJobToDelete(job);
    setDeleteError('');
  };

  const closeDeleteDialog = () => {
    if (!isDeleting) {
      setJobToDelete(null);
      setDeleteError('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;

    try {
      setIsDeleting(true);
      setDeleteError('');

      await jobApi.deleteJob(jobToDelete.job_id);
      toast.success(`Job "${jobToDelete.title}" deleted.`);

      setJobToDelete(null);

      // Re-fetch page (if current page becomes empty and page > 1, go to previous)
      const nextPage =
        jobs.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      fetchJobs(nextPage);
    } catch (err) {
      const msg = err.message || 'Failed to delete job description.';
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div data-testid="jobs-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Job Descriptions
          </h1>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Manage target roles, job requirements, and extracted skill criteria
          </p>
        </div>

        <Button
          type="button"
          variant={showCreate ? 'secondary' : 'primary'}
          onClick={() => {
            setShowCreate((prev) => !prev);
            setCreateError('');
          }}
          data-testid="toggle-create-job-btn"
        >
          {showCreate ? 'Cancel' : 'Create Job Description'}
        </Button>
      </div>

      {/* Create Job Form Card */}
      {showCreate && (
        <div className="card" style={{ animation: 'slideIn 0.2s ease-out' }} data-testid="create-job-card">
          <div
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              New Job Description
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Add a role overview. Required and preferred skills will be automatically extracted upon creation.
            </p>
          </div>

          <JobForm
            onSubmit={handleCreateJob}
            onCancel={() => {
              setShowCreate(false);
              setCreateError('');
            }}
            submitLabel="Create & Extract Skills"
            isSubmitting={isCreating}
            error={createError}
          />
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div
          data-testid="jobs-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading job descriptions..." />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Loading job descriptions...
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
          data-testid="jobs-error"
        >
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
            Unable to load job descriptions
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
            {error}
          </p>
          <Button
            variant="secondary"
            onClick={() => fetchJobs(pagination.page)}
            data-testid="jobs-retry-btn"
          >
            Retry Loading
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && jobs.length === 0 && (
        <EmptyState
          icon="💼"
          title="No job descriptions created yet"
          description="Create your first job description to extract structured requirements and evaluate candidate resumes against role criteria."
          action={
            !showCreate && (
              <Button
                variant="primary"
                onClick={() => setShowCreate(true)}
                data-testid="empty-create-job-btn"
              >
                Create First Job Description
              </Button>
            )
          }
        />
      )}

      {/* Jobs Grid */}
      {!isLoading && !error && jobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div
            className="grid grid-cols-2 gap-4"
            data-testid="jobs-grid"
            style={{ minHeight: '100px' }}
          >
            {jobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
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
              data-testid="jobs-pagination"
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} job descriptions
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
      <DeleteJobDialog
        isOpen={Boolean(jobToDelete)}
        jobTitle={jobToDelete?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default JobsPage;
