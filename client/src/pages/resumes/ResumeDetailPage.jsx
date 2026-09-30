import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import resumeApi from '../../api/resume.api.js';
import { useToast } from '../../hooks/useToast.js';
import ResumeStatusBadge from '../../components/resumes/ResumeStatusBadge.jsx';
import DeleteResumeDialog from '../../components/resumes/DeleteResumeDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Button from '../../components/common/Button.jsx';

/**
 * Resume Detail Page
 * Inspects verified resume metadata, extraction lifecycle diagnostics, and triggers processing.
 */
export const ResumeDetailPage = () => {
  const { resumeId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [resume, setResume] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [sessionExtractedText, setSessionExtractedText] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);

  // Deletion modal state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Polling ref to prevent concurrent intervals
  const pollTimerRef = useRef(null);
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const fetchResumeData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch detail and status concurrently
      const [detailRes, statusRes] = await Promise.all([
        resumeApi.getResumeById(resumeId),
        resumeApi.getResumeStatus(resumeId).catch(() => null),
      ]);

      setResume(detailRes.resume || detailRes);
      if (statusRes) {
        setStatusInfo(statusRes);
      }
    } catch (err) {
      const msg = err.message || 'Failed to load resume details.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [resumeId, toast]);

  // Clean polling implementation
  const startStatusPolling = useCallback(() => {
    stopPolling();
    let pollCount = 0;
    const maxPolls = 15; // 30 seconds maximum (15 * 2s)

    isPollingRef.current = true;

    pollTimerRef.current = setInterval(async () => {
      pollCount += 1;

      try {
        const currentStatus = await resumeApi.getResumeStatus(resumeId);
        setStatusInfo(currentStatus);

        if (
          currentStatus.extractionStatus === 'COMPLETED' ||
          currentStatus.extractionStatus === 'FAILED'
        ) {
          stopPolling();
          setIsProcessing(false);

          // Update main resume state
          setResume((prev) =>
            prev ? { ...prev, extraction_status: currentStatus.extractionStatus } : null
          );

          if (currentStatus.extractionStatus === 'COMPLETED') {
            toast.success('Resume processing completed successfully.');
          } else {
            toast.error(
              currentStatus.processingErrorMessage || 'Resume processing failed.'
            );
          }
        } else if (pollCount >= maxPolls) {
          stopPolling();
          setIsProcessing(false);
          toast.info('Status polling timed out. Please refresh or retry.');
        }
      } catch (err) {
        stopPolling();
        setIsProcessing(false);
      }
    }, 2000);
  }, [resumeId, stopPolling, toast]);

  useEffect(() => {
    fetchResumeData();
    return () => {
      stopPolling();
    };
  }, [fetchResumeData, stopPolling]);

  // Handle explicit processing action
  const handleProcessResume = async () => {
    try {
      setIsProcessing(true);
      setProcessError(null);

      const result = await resumeApi.processResume(resumeId);

      // If backend returns synchronous success with extractedText
      if (result?.extractionStatus === 'COMPLETED') {
        if (result.extractedText) {
          setSessionExtractedText(result.extractedText);
        }
        setResume((prev) => (prev ? { ...prev, extraction_status: 'COMPLETED' } : null));
        setStatusInfo((prev) =>
          prev
            ? {
                ...prev,
                extractionStatus: 'COMPLETED',
                hasExtractedText: true,
                processingAttempts: result.processingAttempts || (prev.processingAttempts + 1),
                processingCompletedAt: result.processingCompletedAt,
              }
            : null
        );
        toast.success('Resume extraction completed successfully.');
        setIsProcessing(false);
      } else if (result?.extractionStatus === 'PROCESSING') {
        // Asynchronous processing: trigger bounded polling
        setResume((prev) => (prev ? { ...prev, extraction_status: 'PROCESSING' } : null));
        startStatusPolling();
      }
    } catch (err) {
      setIsProcessing(false);
      const msg = err.message || 'Processing request failed.';
      setProcessError(msg);
      toast.error(msg);

      // Refresh status info to reflect latest attempt/error
      resumeApi.getResumeStatus(resumeId).then(setStatusInfo).catch(() => {});
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');

      await resumeApi.deleteResume(resumeId);
      toast.success('Resume deleted successfully.');
      navigate('/resumes', { replace: true });
    } catch (err) {
      const msg = err.message || 'Failed to delete resume.';
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
        dateStyle: 'medium',
        timeStyle: 'short',
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

  if (isLoading) {
    return (
      <div
        data-testid="resume-detail-loading"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: '1rem',
        }}
      >
        <Spinner size="lg" ariaLabel="Loading resume details..." />
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Loading resume metadata & status...
        </p>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div data-testid="resume-detail-error" style={{ padding: '2rem 0' }}>
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
        >
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
            Resume Not Found or Inaccessible
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.25rem' }}>
            {error || 'Unable to retrieve resume information.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Link to="/resumes" className="btn btn-secondary">
              Back to Resumes
            </Link>
            <Button variant="primary" onClick={fetchResumeData}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentStatus =
    statusInfo?.extractionStatus || resume.extraction_status || 'PENDING';
  const canRetry =
    statusInfo?.canRetry ??
    (currentStatus !== 'COMPLETED' && (statusInfo?.processingAttempts ?? 0) < 3);

  return (
    <div data-testid="resume-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
        <Link to="/resumes" style={{ color: 'var(--text-secondary)' }}>
          Resumes
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {resume.file_name}
        </span>
      </div>

      {/* Header Banner */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <h1
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
              }}
              data-testid="resume-filename-heading"
            >
              {resume.file_name}
            </h1>
            <ResumeStatusBadge status={currentStatus} />
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Uploaded {formatDate(resume.uploaded_at)} &bull; Size: {formatFileSize(resume.file_size)}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {canRetry && currentStatus !== 'PROCESSING' && (
            <Button
              type="button"
              variant="primary"
              onClick={handleProcessResume}
              loading={isProcessing}
              disabled={isProcessing}
              data-testid="trigger-process-btn"
            >
              {currentStatus === 'FAILED' ? 'Retry Extraction' : 'Extract Skills & Text'}
            </Button>
          )}

          {currentStatus === 'PROCESSING' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--info)' }}>
              <Spinner size="sm" />
              <span>Processing in progress...</span>
            </div>
          )}

          <Button
            type="button"
            variant="danger"
            onClick={() => setShowDeleteDialog(true)}
            data-testid="delete-resume-btn"
          >
            Delete Resume
          </Button>
        </div>
      </div>

      {/* Error alert from processing attempt */}
      {processError && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
          data-testid="process-error-alert"
        >
          <strong>Processing Error:</strong> {processError}
        </div>
      )}

      {/* Metadata & Status Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Document Specifications Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Document Metadata</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Filename</span>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-all' }} data-testid="meta-filename">
                {resume.file_name}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>MIME Type</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: 'var(--text-xs)' }} data-testid="meta-mimetype">
                {resume.mime_type}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>File Size</span>
              <span style={{ color: 'var(--text-primary)' }} data-testid="meta-filesize">
                {formatFileSize(resume.file_size)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>SHA-256 Hash</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }} title={resume.file_hash}>
                {resume.file_hash ? `${resume.file_hash.substring(0, 16)}...` : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Uploaded At</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {formatDate(resume.uploaded_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Processing Diagnostics Card */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Extraction Diagnostics</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: 'var(--text-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Extraction Status</span>
              <div>
                <ResumeStatusBadge status={currentStatus} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Processing Attempts</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }} data-testid="meta-attempts">
                {statusInfo?.processingAttempts ?? 0} / 3 allowed
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Extracted Text Availability</span>
              <span
                style={{
                  fontWeight: 600,
                  color: statusInfo?.hasExtractedText ? 'var(--success)' : 'var(--text-muted)',
                }}
                data-testid="meta-text-availability"
              >
                {statusInfo?.hasExtractedText ? 'Available in Vault' : 'Not Extracted'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Started At</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatDate(statusInfo?.processingStartedAt)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Completed At</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatDate(statusInfo?.processingCompletedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Failure Diagnostic Card (if FAILED) */}
      {currentStatus === 'FAILED' && statusInfo?.processingErrorMessage && (
        <div
          className="card"
          style={{
            borderColor: 'var(--danger-border)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
          }}
          data-testid="failure-diagnostic-card"
        >
          <div className="card-header">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--danger)' }}>
              Failure Diagnostics
            </h3>
            {statusInfo.processingErrorCode && (
              <span className="badge badge-failed">{statusInfo.processingErrorCode}</span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {statusInfo.processingErrorMessage}
          </p>
          {canRetry && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              You may retry extraction using the button above. (Remaining attempts:{' '}
              {3 - (statusInfo.processingAttempts || 0)})
            </p>
          )}
        </div>
      )}

      {/* Extracted Text Section (Only when present in session from processing response) */}
      {sessionExtractedText && (
        <div className="card" data-testid="extracted-text-preview">
          <div className="card-header">
            <div>
              <h2 className="card-title">Processed Text Preview</h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Extracted during the active processing session
              </p>
            </div>
          </div>

          <div
            style={{
              maxHeight: '320px',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
            }}
          >
            {sessionExtractedText}
          </div>
        </div>
      )}

      {/* Information Disclosure Banner regarding raw text availability */}
      {!sessionExtractedText && (
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
          data-testid="text-disclosure-banner"
        >
          <span style={{ fontSize: '1.25rem' }} aria-hidden="true">🔒</span>
          <div>
            <strong>Private Storage Policy:</strong> Resume text is stored in an encrypted vault outside the public web root. For data privacy and bandwidth security, the backend detail endpoint exposes metadata and extraction status rather than raw document text.
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteResumeDialog
        isOpen={showDeleteDialog}
        resumeName={resume.file_name}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setShowDeleteDialog(false)}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default ResumeDetailPage;
