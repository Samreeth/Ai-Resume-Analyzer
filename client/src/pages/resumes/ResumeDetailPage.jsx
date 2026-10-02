import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import resumeApi from '../../api/resume.api.js';
import { useToast } from '../../hooks/useToast.js';
import ResumeStatusBadge from '../../components/resumes/ResumeStatusBadge.jsx';
import DeleteResumeDialog from '../../components/resumes/DeleteResumeDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';

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
      } catch (_) {
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
            padding: '2rem',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'inline-flex', marginBottom: '0.75rem' }}>
            <Icon name="alert" size={28} />
          </div>
          <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Resume Not Found or Inaccessible
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
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

  // Workflow visual steps:
  // 1: Upload (Complete)
  // 2: Text Extraction (Pending / Processing / Completed / Failed)
  // 3: Available for Analysis (Visual derivation: complete if extraction is COMPLETED)
  const isExtracted = currentStatus === 'COMPLETED';

  return (
    <div data-testid="resume-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
        <Link to="/resumes" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Icon name="resume" size={14} />
          <span>Resumes</span>
        </Link>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          {resume.file_name}
        </span>
      </div>

      {/* Header Banner Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
            <h1
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
                margin: 0,
              }}
              data-testid="resume-filename-heading"
            >
              {resume.file_name}
            </h1>
            <ResumeStatusBadge status={currentStatus} />
          </div>

          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }} className="tabular-nums">
            Uploaded {formatDate(resume.uploaded_at)} &bull; Size: {formatFileSize(resume.file_size)}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canRetry && currentStatus !== 'PROCESSING' && (
            <Button
              type="button"
              variant="primary"
              onClick={handleProcessResume}
              loading={isProcessing}
              disabled={isProcessing}
              data-testid="trigger-process-btn"
            >
              <Icon name="refresh" size={14} />
              <span>{currentStatus === 'FAILED' ? 'Retry Extraction' : 'Extract Skills & Text'}</span>
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
            <Icon name="trash" size={14} />
            <span>Delete Resume</span>
          </Button>
        </div>
      </div>

      {/* Extraction Lifecycle Stepper (Visual workflow derived from real API state) */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
          Extraction Lifecycle
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Step 1: Upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={14} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Document Upload
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Stored in encrypted vault
              </div>
            </div>
          </div>

          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)', minWidth: '30px' }} />

          {/* Step 2: Text Extraction */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isExtracted
                  ? 'var(--success-bg)'
                  : currentStatus === 'FAILED'
                  ? 'var(--danger-bg)'
                  : currentStatus === 'PROCESSING'
                  ? 'var(--info-bg)'
                  : 'var(--warning-bg)',
                border: `1px solid ${
                  isExtracted
                    ? 'var(--success-border)'
                    : currentStatus === 'FAILED'
                    ? 'var(--danger-border)'
                    : currentStatus === 'PROCESSING'
                    ? 'var(--info-border)'
                    : 'var(--warning-border)'
                }`,
                color: isExtracted
                  ? 'var(--success)'
                  : currentStatus === 'FAILED'
                  ? 'var(--danger)'
                  : currentStatus === 'PROCESSING'
                  ? 'var(--info)'
                  : 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isExtracted ? (
                <Icon name="check" size={14} />
              ) : currentStatus === 'PROCESSING' ? (
                <Spinner size="sm" />
              ) : currentStatus === 'FAILED' ? (
                <Icon name="close" size={14} />
              ) : (
                <Icon name="refresh" size={14} />
              )}
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Text Extraction
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {currentStatus}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)', minWidth: '30px' }} />

          {/* Step 3: Available for Analysis */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '2rem',
                height: '2rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isExtracted ? 'var(--accent-muted)' : 'var(--bg-elevated)',
                border: `1px solid ${isExtracted ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                color: isExtracted ? 'var(--border-focus)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="chart" size={14} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: isExtracted ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                Available for Analysis
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {isExtracted ? 'Ready for job matching' : 'Awaiting extraction'}
              </div>
            </div>
          </div>
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
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
          data-testid="process-error-alert"
        >
          <Icon name="alert" size={18} />
          <div>
            <strong>Processing Error:</strong> {processError}
          </div>
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
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: 'var(--text-xs)' }} data-testid="meta-mimetype">
                {resume.mime_type}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>File Size</span>
              <span style={{ color: 'var(--text-primary)' }} className="tabular-nums" data-testid="meta-filesize">
                {formatFileSize(resume.file_size)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>SHA-256 Hash</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }} title={resume.file_hash}>
                {resume.file_hash ? `${resume.file_hash.substring(0, 16)}...` : '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Uploaded At</span>
              <span style={{ color: 'var(--text-primary)' }} className="tabular-nums">
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
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }} className="tabular-nums" data-testid="meta-attempts">
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
              <span style={{ color: 'var(--text-secondary)' }} className="tabular-nums">
                {formatDate(statusInfo?.processingStartedAt)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Completed At</span>
              <span style={{ color: 'var(--text-secondary)' }} className="tabular-nums">
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
            backgroundColor: 'var(--danger-bg)',
          }}
          data-testid="failure-diagnostic-card"
        >
          <div className="card-header">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--danger)', margin: 0 }}>
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
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.5rem' }} className="tabular-nums">
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
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: 'var(--text-xs)',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              fontFamily: 'var(--font-mono)',
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
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.875rem',
          }}
          data-testid="text-disclosure-banner"
        >
          <div
            style={{
              color: 'var(--accent-primary)',
              backgroundColor: 'var(--accent-muted)',
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
            }}
            aria-hidden="true"
          >
            <Icon name="lock" size={20} />
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Private Storage Policy:</strong> Resume text is stored in an encrypted vault outside the public web root. For data privacy and bandwidth security, the backend detail endpoint exposes metadata and extraction status rather than raw document text.
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
