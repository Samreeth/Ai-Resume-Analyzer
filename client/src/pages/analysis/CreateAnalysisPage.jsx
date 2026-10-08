import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import resumeApi from '../../api/resume.api.js';
import jobApi from '../../api/job.api.js';
import analysisApi from '../../api/analysis.api.js';
import { useToast } from '../../hooks/useToast.js';
import Spinner from '../../components/common/Spinner.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';

/**
 * New Compatibility Analysis Page
 * Allows authenticated candidate/recruiter to select an existing resume and job description
 * to trigger deterministic matching and recommendation generation.
 * Clean, minimalist card interface matching the unified design system.
 */
export const CreateAnalysisPage = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');

  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        setIsLoadingOptions(true);
        setOptionsError(null);

        const [resumesData, jobsData] = await Promise.all([
          resumeApi.listResumes({ page: 1, limit: 50 }),
          jobApi.listJobs({ page: 1, limit: 50 }),
        ]);

        setResumes(resumesData?.resumes || []);
        setJobs(jobsData?.jobs || []);
      } catch (err) {
        const msg = err.message || 'Failed to load resumes or job descriptions.';
        setOptionsError(msg);
        toast.error(msg);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    fetchOptions();
  }, [toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    setSubmitError('');

    if (!selectedResumeId) {
      setValidationError('Please select a resume for analysis.');
      return;
    }

    if (!selectedJobId) {
      setValidationError('Please select a job description for analysis.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await analysisApi.createAnalysis({
        resumeId: selectedResumeId,
        jobId: selectedJobId,
      });

      const analysis = res.analysis || res;
      toast.success('Compatibility analysis completed successfully.');
      navigate(`/analyses/${analysis.analysis_id}`);
    } catch (err) {
      const msg = err.message || 'Failed to run analysis.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find active selected items for preview
  const activeResume = resumes.find((r) => r.resume_id === selectedResumeId);
  const activeJob = jobs.find((j) => j.job_id === selectedJobId);

  return (
    <div
      data-testid="create-analysis-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        maxWidth: '720px',
        margin: '0 auto',
      }}
    >
      {/* 1. Breadcrumb Navigation */}
      <div>
        <Link
          to="/analyses"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
            transition: 'color var(--transition-fast)',
          }}
          data-testid="back-to-analyses-link"
        >
          <Icon name="arrow-left" size={14} />
          <span>Back to Analyses</span>
        </Link>
      </div>

      {/* 2. Header */}
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
          New Compatibility Match
        </h1>
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            marginTop: '0.2rem',
            margin: 0,
          }}
        >
          Evaluate a candidate resume against role criteria to uncover skill alignment, gaps, and recommendations.
        </p>
      </div>

      {/* 3. Loading Options State */}
      {isLoadingOptions && (
        <div
          data-testid="create-analysis-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '30vh',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading available resumes and jobs..." />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Loading candidate resumes and job roles...
          </p>
        </div>
      )}

      {/* 4. Options Load Error */}
      {!isLoadingOptions && optionsError && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            {optionsError}
          </p>
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            Retry
          </Button>
        </div>
      )}

      {/* 5. Selection Form Card */}
      {!isLoadingOptions && !optionsError && (
        <div
          className="card"
          style={{
            padding: '1.75rem',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            {/* Server Error Alert */}
            {submitError && (
              <div
                role="alert"
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                data-testid="create-analysis-error"
              >
                <Icon name="alert" size={16} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Validation Error Alert */}
            {validationError && (
              <div
                role="alert"
                style={{
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
                data-testid="create-analysis-validation-error"
              >
                <Icon name="alert" size={16} />
                <span>{validationError}</span>
              </div>
            )}

            {/* Step 1: Resume Selection */}
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label
                  htmlFor="resume-select"
                  className="form-label"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    margin: 0,
                  }}
                >
                  <Icon name="file" size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span>Candidate Resume</span>
                  <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <Link
                  to="/resumes"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--accent-primary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Manage Resumes &rarr;
                </Link>
              </div>

              {resumes.length === 0 ? (
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                    padding: '0.875rem',
                    backgroundColor: 'var(--bg-container)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-subtle)',
                  }}
                >
                  No resumes available.{' '}
                  <Link to="/resumes" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                    Upload a resume
                  </Link>{' '}
                  first.
                </div>
              ) : (
                <select
                  id="resume-select"
                  value={selectedResumeId}
                  onChange={(e) => {
                    setSelectedResumeId(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  disabled={isSubmitting}
                  className="input-field"
                  data-testid="resume-select"
                  style={{
                    width: '100%',
                    height: '2.5rem',
                    padding: '0 0.75rem',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <option value="">Select a candidate resume...</option>
                  {resumes.map((res) => (
                    <option key={res.resume_id} value={res.resume_id}>
                      {res.file_name} {res.extraction_status === 'COMPLETED' ? '(Ready)' : `(${res.extraction_status})`}
                    </option>
                  ))}
                </select>
              )}

              {activeResume && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-container)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span
                    style={{
                      width: '0.45rem',
                      height: '0.45rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: activeResume.extraction_status === 'COMPLETED' ? 'var(--success)' : 'var(--warning)',
                    }}
                  />
                  <span>
                    Selected: <strong>{activeResume.file_name}</strong> &bull; Status: {activeResume.extraction_status}
                  </span>
                </div>
              )}

              <span
                className="form-helper"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.35rem',
                }}
              >
                Ensure the selected resume has completed text extraction.
              </span>
            </div>

            {/* Step 2: Job Description Selection */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label
                  htmlFor="job-select"
                  className="form-label"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    margin: 0,
                  }}
                >
                  <Icon name="briefcase" size={15} style={{ color: 'var(--accent-primary)' }} />
                  <span>Target Job Description</span>
                  <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <Link
                  to="/jobs"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--accent-primary)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Manage Roles &rarr;
                </Link>
              </div>

              {jobs.length === 0 ? (
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                    padding: '0.875rem',
                    backgroundColor: 'var(--bg-container)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-subtle)',
                  }}
                >
                  No job descriptions available.{' '}
                  <Link to="/jobs" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                    Create a job description
                  </Link>{' '}
                  first.
                </div>
              ) : (
                <select
                  id="job-select"
                  value={selectedJobId}
                  onChange={(e) => {
                    setSelectedJobId(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  disabled={isSubmitting}
                  className="input-field"
                  data-testid="job-select"
                  style={{
                    width: '100%',
                    height: '2.5rem',
                    padding: '0 0.75rem',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <option value="">Select a target role...</option>
                  {jobs.map((job) => (
                    <option key={job.job_id} value={job.job_id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              )}

              {activeJob && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-container)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
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
                  <span>
                    Selected: <strong>{activeJob.title}</strong>
                  </span>
                </div>
              )}

              <span
                className="form-helper"
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.35rem',
                }}
              >
                Skills must be extracted for the job description to run matching.
              </span>
            </div>

            {/* Step 3: Action Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '0.75rem',
                paddingTop: '1.25rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <Link
                to="/analyses"
                className="btn btn-secondary"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                Cancel
              </Link>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting || resumes.length === 0 || jobs.length === 0}
                data-testid="start-analysis-btn"
                style={{
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Icon name="sparkles" size={14} />
                <span>Run Match Analysis</span>
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CreateAnalysisPage;
