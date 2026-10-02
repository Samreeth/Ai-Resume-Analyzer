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

  return (
    <div data-testid="create-analysis-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Breadcrumb Navigation */}
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
          }}
          data-testid="back-to-analyses-link"
        >
          <Icon name="arrow-left" size={14} />
          <span>Back to Analyses</span>
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          New Compatibility Match
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Evaluate a candidate resume against role criteria to uncover skill alignment, gaps, and recommendations.
        </p>
      </div>

      {/* Loading Options State */}
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

      {/* Options Load Error */}
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
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1rem', color: 'var(--text-secondary)' }}>{optionsError}</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}

      {/* Selection Form */}
      {!isLoadingOptions && !optionsError && (
        <div className="card" style={{ maxWidth: '680px' }}>
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

            {/* Resume Selection */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="resume-select" className="form-label">
                Candidate Resume <span style={{ color: 'var(--danger)' }}>*</span>
              </label>

              {resumes.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
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
                >
                  <option value="">Select a candidate resume...</option>
                  {resumes.map((res) => (
                    <option key={res.resume_id} value={res.resume_id}>
                      {res.file_name} {res.extraction_status === 'COMPLETED' ? '(Ready)' : `(${res.extraction_status})`}
                    </option>
                  ))}
                </select>
              )}
              <span className="form-helper">
                Ensure the selected resume has completed text extraction.
              </span>
            </div>

            {/* Job Description Selection */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="job-select" className="form-label">
                Target Job Description <span style={{ color: 'var(--danger)' }}>*</span>
              </label>

              {jobs.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
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
                >
                  <option value="">Select a target role...</option>
                  {jobs.map((job) => (
                    <option key={job.job_id} value={job.job_id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              )}
              <span className="form-helper">
                Skills must be extracted for the job description to run matching.
              </span>
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Link to="/analyses" className="btn btn-secondary">
                Cancel
              </Link>
              <Button
                type="submit"
                variant="primary"
                loading={isSubmitting}
                disabled={isSubmitting || resumes.length === 0 || jobs.length === 0}
                data-testid="start-analysis-btn"
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
