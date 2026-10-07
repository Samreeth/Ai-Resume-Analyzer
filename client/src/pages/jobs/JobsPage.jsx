import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import jobApi from '../../api/job.api.js';
import { useToast } from '../../hooks/useToast.js';
import JobCard from '../../components/jobs/JobCard.jsx';
import JobForm from '../../components/jobs/JobForm.jsx';
import DeleteJobDialog from '../../components/jobs/DeleteJobDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import EmptyState from '../../components/common/EmptyState.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';

/**
 * Jobs List Page
 * Displays user's job descriptions with pagination, creation form, search/filters, and deletion flow.
 * Clean, minimalist SaaS interface inspired by Stitch & Linear design.
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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'EXTRACTED' | 'PENDING'

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

  // Filter & Search logic
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Filter type check
      const hasSkills =
        (job.skill_counts?.total ?? 0) > 0 ||
        (Array.isArray(job.extracted_data?.required) && job.extracted_data.required.length > 0) ||
        (Array.isArray(job.extracted_data?.preferred) && job.extracted_data.preferred.length > 0);

      if (filterType === 'EXTRACTED' && !hasSkills) return false;
      if (filterType === 'PENDING' && hasSkills) return false;

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (job.title || '').toLowerCase().includes(q);
        const descMatch = (job.description || '').toLowerCase().includes(q);
        return titleMatch || descMatch;
      }

      return true;
    });
  }, [jobs, filterType, searchQuery]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let extractedCount = 0;
    let pendingCount = 0;

    jobs.forEach((j) => {
      const hasSkills =
        (j.skill_counts?.total ?? 0) > 0 ||
        (Array.isArray(j.extracted_data?.required) && j.extracted_data.required.length > 0) ||
        (Array.isArray(j.extracted_data?.preferred) && j.extracted_data.preferred.length > 0);

      if (hasSkills) extractedCount++;
      else pendingCount++;
    });

    return {
      all: jobs.length,
      extracted: extractedCount,
      pending: pendingCount,
    };
  }, [jobs]);

  return (
    <div
      data-testid="jobs-page"
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
            Job Descriptions
          </h1>
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              margin: 0,
            }}
          >
            Manage target roles, job requirements, and extracted skill criteria
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Create / Cancel Toggle Button */}
          <Button
            type="button"
            variant={showCreate ? 'secondary' : 'primary'}
            onClick={() => {
              setShowCreate((prev) => !prev);
              setCreateError('');
            }}
            data-testid="toggle-create-job-btn"
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            {showCreate ? (
              <>
                <Icon name="close" size={16} />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Icon name="jobs" size={16} />
                <span>Create Job Description</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Create Job Form Card (Collapsible) */}
      {showCreate && (
        <div
          className="card"
          style={{
            animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl, 1rem)',
            boxShadow: 'var(--shadow-md)',
            padding: '1.5rem',
          }}
          data-testid="create-job-card"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-container-low, rgba(99, 102, 241, 0.1))',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              >
                <Icon name="sparkles" size={18} />
              </div>
              <div>
                <h2
                  style={{
                    fontSize: 'var(--text-lg)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    margin: 0,
                  }}
                >
                  New Job Description
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.125rem', margin: 0 }}>
                  Add a role overview. Required and preferred skills will be automatically extracted upon creation.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setCreateError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.25rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close creation form"
            >
              <Icon name="close" size={18} />
            </button>
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

      {/* 3. Loading State */}
      {isLoading && (
        <div
          data-testid="jobs-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '35vh',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading job descriptions..." />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Loading job descriptions...
          </p>
        </div>
      )}

      {/* 4. Error State */}
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
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Unable to load job descriptions
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem', color: 'var(--text-secondary)' }}>
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

      {/* 5. Empty State (Zero Jobs total) */}
      {!isLoading && !error && jobs.length === 0 && (
        <EmptyState
          icon={<Icon name="jobs" size={32} />}
          title="No job descriptions created yet"
          description="Create your first job description to extract structured requirements and evaluate candidate resumes against role criteria."
          action={
            !showCreate && (
              <Button
                variant="primary"
                onClick={() => setShowCreate(true)}
                data-testid="empty-create-job-btn"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                Create First Job Description
              </Button>
            )
          }
        />
      )}

      {/* 6. Jobs List & Controls (When jobs exist) */}
      {!isLoading && !error && jobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Search & Filter Toolbar */}
          <div
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
            <div style={{ position: 'relative', width: '100%', maxWidth: '20rem' }}>
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
                placeholder="Search job titles or keywords..."
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
                  transition: 'border-color var(--transition-fast)',
                }}
              />
            </div>

            {/* Filter Pills & View Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setFilterType('ALL')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: filterType === 'ALL' ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: filterType === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  All ({counts.all})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('EXTRACTED')}
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
                    backgroundColor: filterType === 'EXTRACTED' ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: filterType === 'EXTRACTED' ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Extracted ({counts.extracted})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterType('PENDING')}
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
                    backgroundColor: filterType === 'PENDING' ? 'var(--accent-primary)' : 'var(--bg-card)',
                    color: filterType === 'PENDING' ? '#ffffff' : 'var(--text-secondary)',
                    boxShadow: 'var(--shadow-xs)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  Pending ({counts.pending})
                </button>
              </div>

              {/* View toggle indicator */}
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.35rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--accent-primary)',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                  title="Grid View active"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.125rem' }}>
                    grid_view
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Jobs Grid */}
          <div
            className="grid grid-cols-2 gap-4"
            data-testid="jobs-grid"
            style={{ minHeight: '100px' }}
          >
            {filteredJobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                onDeleteClick={openDeleteDialog}
              />
            ))}
          </div>

          {/* Filtered empty state */}
          {filteredJobs.length === 0 && (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: '3rem',
                  height: '3rem',
                  margin: '0 auto 1rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-container-low)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="search" size={20} />
              </div>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
                No job descriptions found
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                No roles match your current query "{searchQuery || filterType}".
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('ALL');
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

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
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }} className="tabular-nums">
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

      {/* 7. Delete Confirmation Modal */}
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
