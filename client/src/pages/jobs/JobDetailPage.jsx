import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import jobApi from '../../api/job.api.js';
import { useToast } from '../../hooks/useToast.js';
import JobForm from '../../components/jobs/JobForm.jsx';
import JobRequirements from '../../components/jobs/JobRequirements.jsx';
import DeleteJobDialog from '../../components/jobs/DeleteJobDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Button from '../../components/common/Button.jsx';

/**
 * Job Detail Page
 * Inspects job description details, full role overview, extracted requirements,
 * and provides inline editing and re-extraction actions.
 */
export const JobDetailPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [job, setJob] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');

  // Delete modal state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchJob = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await jobApi.getJobById(jobId);
      setJob(data.job || data);
    } catch (err) {
      const msg = err.message || 'Failed to load job description details.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, toast]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Handle job update
  const handleUpdate = async ({ title, description }) => {
    try {
      setIsUpdating(true);
      setUpdateError('');

      const data = await jobApi.updateJob(jobId, { title, description });
      const updatedJob = data.job || data;

      setJob(updatedJob);
      setIsEditing(false);
      toast.success('Job description updated successfully.');
    } catch (err) {
      const msg = err.message || 'Failed to update job description.';
      setUpdateError(msg);
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle re-extraction of requirements
  const handleExtract = async () => {
    try {
      setIsExtracting(true);
      setExtractError('');

      const data = await jobApi.extractJobSkills(jobId);
      const updatedJob = data.job || data;

      setJob(updatedJob);
      toast.success('Structured requirements extracted successfully.');
    } catch (err) {
      const msg = err.message || 'Failed to extract requirements.';
      setExtractError(msg);
      toast.error(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');

      await jobApi.deleteJob(jobId);
      toast.success(`Job description "${job.title}" deleted.`);
      setShowDeleteDialog(false);
      navigate('/jobs');
    } catch (err) {
      const msg = err.message || 'Failed to delete job description.';
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return String(dateStr);
    }
  };

  return (
    <div data-testid="job-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/jobs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
          }}
          data-testid="back-to-jobs-link"
        >
          <span>&larr;</span> Back to Job Descriptions
        </Link>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          data-testid="job-detail-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading job description..." />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Loading job details...
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
            padding: '2rem',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
          data-testid="job-detail-error"
        >
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: '0.5rem' }}>
            Job Description Not Found or Unavailable
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {error}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Button variant="secondary" onClick={fetchJob} data-testid="job-retry-btn">
              Retry
            </Button>
            <Link to="/jobs" className="btn btn-primary" data-testid="job-error-back-btn">
              Return to Jobs
            </Link>
          </div>
        </div>
      )}

      {/* Job Details Content */}
      {!isLoading && !error && job && (
        <>
          {/* Header Card */}
          <div className="card" data-testid="job-header-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <h1
                  style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                  data-testid="job-detail-title"
                >
                  {job.title}
                </h1>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    flexWrap: 'wrap',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginTop: '0.5rem',
                  }}
                >
                  <span>Created {formatDate(job.created_at)}</span>
                  {job.updated_at && job.updated_at !== job.created_at && (
                    <span>Last updated {formatDate(job.updated_at)}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button
                  type="button"
                  variant={isEditing ? 'secondary' : 'secondary'}
                  onClick={() => {
                    setIsEditing((prev) => !prev);
                    setUpdateError('');
                  }}
                  data-testid="toggle-edit-job-btn"
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Job'}
                </Button>

                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="delete-job-page-btn"
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>

          {/* Edit Form or Description Display */}
          {isEditing ? (
            <div className="card" data-testid="edit-job-card">
              <div
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.75rem',
                  marginBottom: '1.25rem',
                }}
              >
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Edit Job Description
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Update the title or description text for this role.
                </p>
              </div>

              <JobForm
                initialValues={{ title: job.title, description: job.description }}
                onSubmit={handleUpdate}
                onCancel={() => {
                  setIsEditing(false);
                  setUpdateError('');
                }}
                submitLabel="Update Job Description"
                isSubmitting={isUpdating}
                error={updateError}
              />
            </div>
          ) : (
            <div className="card" data-testid="job-description-card">
              <div
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <h3 className="card-title" style={{ margin: 0 }}>
                  Role Description
                </h3>
              </div>

              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                data-testid="job-full-description"
              >
                {job.description}
              </div>
            </div>
          )}

          {/* Structured Requirements Section */}
          <JobRequirements
            extractedData={job.extracted_data}
            onExtract={handleExtract}
            isExtracting={isExtracting}
            error={extractError}
          />
        </>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteJobDialog
        isOpen={showDeleteDialog}
        jobTitle={job?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setShowDeleteDialog(false)}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default JobDetailPage;
