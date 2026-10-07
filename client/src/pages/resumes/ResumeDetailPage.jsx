import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import resumeApi from '../../api/resume.api.js';
import { useToast } from '../../hooks/useToast.js';
import ResumeStatusBadge from '../../components/resumes/ResumeStatusBadge.jsx';
import DeleteResumeDialog from '../../components/resumes/DeleteResumeDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import ResumeAiProfileCard from '../../components/ai/ResumeAiProfileCard.jsx';

/**
 * Resume Detail Page
 * Inspects verified resume metadata, extraction lifecycle diagnostics, and triggers processing.
 * Clean, minimalist dual-theme aesthetic (Light & Dark mode).
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

  // Copy feedback state
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

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

  const handleCopyHash = () => {
    if (resume?.file_hash) {
      navigator.clipboard?.writeText(resume.file_hash);
      setCopiedHash(true);
      toast.success('File SHA-256 hash copied to clipboard');
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleCopyText = () => {
    if (sessionExtractedText) {
      navigator.clipboard?.writeText(sessionExtractedText);
      setCopiedText(true);
      toast.success('Extracted plain text copied to clipboard');
      setTimeout(() => setCopiedText(false), 2000);
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
          minHeight: '60vh',
          gap: '1.25rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: 'var(--accent-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading resume details..." />
        </div>
        <div>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
            Loading resume details...
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Loading resume metadata & status...
          </p>
        </div>
      </div>
    );
  }

  if (error || !resume) {
    return (
      <div data-testid="resume-detail-error" style={{ padding: '3rem 0' }}>
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--danger-border)',
            padding: '2.5rem 2rem',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            maxWidth: '520px',
            margin: '0 auto',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div
            style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <Icon name="alert" size={28} />
          </div>
          <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Resume Not Found or Inaccessible
          </h3>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {error || 'Unable to retrieve resume information.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/resumes" className="btn btn-secondary" style={{ borderRadius: 'var(--radius-full)' }}>
              <Icon name="arrow-left" size={14} />
              <span>Back to Resumes</span>
            </Link>
            <Button variant="primary" onClick={fetchResumeData} style={{ borderRadius: 'var(--radius-full)' }}>
              <Icon name="refresh" size={14} />
              <span>Retry</span>
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

  const isExtracted = currentStatus === 'COMPLETED';

  // Format badge helper
  const isPdf = resume.mime_type?.includes('pdf') || resume.file_name?.toLowerCase().endsWith('.pdf');
  const isDocx = resume.mime_type?.includes('word') || resume.file_name?.toLowerCase().endsWith('.docx') || resume.file_name?.toLowerCase().endsWith('.doc');
  const formatLabel = isPdf ? 'PDF' : isDocx ? 'DOCX' : 'DOCUMENT';

  return (
    <div
      data-testid="resume-detail-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.75rem',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* Top Header Card & Breadcrumb Bar */}
      <div
        className="card"
        style={{
          padding: '1.5rem 1.75rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Navigation Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: 'var(--text-xs)',
            marginBottom: '1rem',
          }}
        >
          <Link
            to="/resumes"
            style={{
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
          >
            <Icon name="arrow-left" size={13} />
            <span>Resumes</span>
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span
            style={{
              color: 'var(--text-primary)',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '320px',
            }}
          >
            {resume.file_name}
          </span>
        </div>

        {/* Title, Badges, and Action Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1.25rem',
          }}
        >
          {/* Left: Document Icon & Metadata */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '3.25rem',
                height: '3.25rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: isPdf ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                border: `1px solid ${isPdf ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                color: isPdf ? '#ef4444' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="file" size={24} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                <h1
                  style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    wordBreak: 'break-word',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                  data-testid="resume-filename-heading"
                >
                  {resume.file_name}
                </h1>

                {/* Format Tag */}
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isPdf ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                    color: isPdf ? '#ef4444' : '#3b82f6',
                    border: `1px solid ${isPdf ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`,
                  }}
                >
                  {formatLabel}
                </span>

                <ResumeStatusBadge status={currentStatus} />
              </div>

              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
                className="tabular-nums"
              >
                <span>Uploaded {formatDate(resume.uploaded_at)}</span>
                <span>&bull;</span>
                <span>Size: {formatFileSize(resume.file_size)}</span>
                {resume.file_hash && (
                  <>
                    <span>&bull;</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      SHA: {resume.file_hash.substring(0, 10)}...
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* If completed, show Match with Job CTA */}
            {isExtracted && (
              <Link
                to={`/analyses/new?resumeId=${resume.resume_id || resumeId}`}
                className="btn btn-primary"
                style={{
                  borderRadius: 'var(--radius-full)',
                  padding: '0.5rem 1.125rem',
                  fontSize: 'var(--text-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <Icon name="sparkles" size={15} />
                <span>Match with a Job</span>
              </Link>
            )}

            {/* Process / Retry Extraction */}
            {canRetry && currentStatus !== 'PROCESSING' && (
              <Button
                type="button"
                variant={isExtracted ? 'secondary' : 'primary'}
                onClick={handleProcessResume}
                loading={isProcessing}
                disabled={isProcessing}
                data-testid="trigger-process-btn"
                style={{ borderRadius: 'var(--radius-full)' }}
              >
                <Icon name="refresh" size={14} />
                <span>{currentStatus === 'FAILED' ? 'Retry Extraction' : 'Extract Skills & Text'}</span>
              </Button>
            )}

            {/* In Progress indicator */}
            {currentStatus === 'PROCESSING' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--info)',
                  padding: '0.45rem 0.875rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--info-bg)',
                  border: '1px solid var(--info-border)',
                }}
              >
                <Spinner size="sm" />
                <span style={{ fontWeight: 500 }}>Processing in progress...</span>
              </div>
            )}

            {/* Delete Resume */}
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeleteDialog(true)}
              data-testid="delete-resume-btn"
              style={{
                borderRadius: 'var(--radius-full)',
                color: 'var(--danger)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Icon name="trash" size={14} />
              <span>Delete Resume</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Extraction Lifecycle Stepper (High-tech minimal pipeline) */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.75rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '1rem',
          }}
        >
          Extraction Pipeline
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            position: 'relative',
          }}
        >
          {/* Step 1: Secure Ingestion */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="check" size={15} />
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

          {/* Step 2: Text Extraction */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-surface)',
              border: `1px solid ${
                isExtracted
                  ? 'var(--border-subtle)'
                  : currentStatus === 'FAILED'
                  ? 'var(--danger-border)'
                  : currentStatus === 'PROCESSING'
                  ? 'var(--info-border)'
                  : 'var(--border-subtle)'
              }`,
            }}
          >
            <div
              style={{
                width: '2.25rem',
                height: '2.25rem',
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
                flexShrink: 0,
              }}
            >
              {isExtracted ? (
                <Icon name="check" size={15} />
              ) : currentStatus === 'PROCESSING' ? (
                <Spinner size="sm" />
              ) : currentStatus === 'FAILED' ? (
                <Icon name="close" size={15} />
              ) : (
                <Icon name="refresh" size={15} />
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

          {/* Step 3: Available for Analysis */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{
                width: '2.25rem',
                height: '2.25rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isExtracted ? 'var(--accent-muted)' : 'var(--bg-elevated)',
                border: `1px solid ${isExtracted ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)'}`,
                color: isExtracted ? 'var(--accent-primary)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="chart" size={15} />
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
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
          data-testid="process-error-alert"
        >
          <Icon name="alert" size={20} />
          <div>
            <strong>Processing Error:</strong> {processError}
          </div>
        </div>
      )}

      {/* Failure Diagnostic Card (if FAILED) */}
      {currentStatus === 'FAILED' && statusInfo?.processingErrorMessage && (
        <div
          className="card"
          style={{
            borderColor: 'var(--danger-border)',
            backgroundColor: 'var(--danger-bg)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.5rem',
          }}
          data-testid="failure-diagnostic-card"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--danger)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon name="alert" size={18} />
              <span>Failure Diagnostics</span>
            </h3>
            {statusInfo.processingErrorCode && (
              <span
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger-border)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {statusInfo.processingErrorCode}
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', lineHeight: 1.5 }}>
            {statusInfo.processingErrorMessage}
          </p>
          {canRetry && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }} className="tabular-nums">
              You may retry extraction using the button above. (Remaining attempts:{' '}
              {3 - (statusInfo.processingAttempts || 0)})
            </p>
          )}
        </div>
      )}

      {/* Main 2-Column Content Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '1.75rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column (8 cols on desktop): AI Understanding Profile & Raw Text Preview */}
        <div
          style={{
            gridColumn: 'span 12',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.75rem',
          }}
          className="lg:col-span-8"
        >
          {/* AI Resume Understanding Profile Card */}
          <ResumeAiProfileCard
            resumeId={resumeId}
            extractionStatus={currentStatus}
          />

          {/* Processed Text Preview (Only when present in session from processing response) */}
          {sessionExtractedText && (
            <div
              className="card"
              data-testid="extracted-text-preview"
              style={{
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                padding: '1.5rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '0.875rem',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: 'var(--text-base)',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    Processed Text Preview
                  </h2>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                    Extracted during the active processing session
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-surface)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    className="tabular-nums"
                  >
                    {sessionExtractedText.length} characters
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 500,
                      color: copiedText ? 'var(--success)' : 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.3rem 0.625rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon name={copiedText ? 'check' : 'edit'} size={12} />
                    <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.125rem',
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

          {/* Privacy & Security Disclosure Banner */}
          {!sessionExtractedText && (
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
              }}
              data-testid="text-disclosure-banner"
            >
              <div
                style={{
                  color: 'var(--accent-primary)',
                  backgroundColor: 'var(--accent-muted)',
                  padding: '0.625rem',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                <Icon name="lock" size={20} />
              </div>
              <div style={{ lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.15rem' }}>
                  Private Storage Policy
                </strong>
                Resume text is stored in an encrypted vault outside the public web root. For data privacy and bandwidth security, the backend detail endpoint exposes metadata and extraction status rather than raw document text.
              </div>
            </div>
          )}
        </div>

        {/* Right Column (4 cols on desktop): Metadata & Diagnostics Sidebar */}
        <div
          style={{
            gridColumn: 'span 12',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
          className="lg:col-span-4"
        >
          {/* Document Specifications Card */}
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Icon name="file" size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>Document Metadata</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Filename</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    wordBreak: 'break-all',
                    maxWidth: '180px',
                    textAlign: 'right',
                  }}
                  data-testid="meta-filename"
                >
                  {resume.file_name}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>MIME Type</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-surface)',
                    padding: '0.15rem 0.4rem',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  data-testid="meta-mimetype"
                >
                  {resume.mime_type}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>File Size</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }} className="tabular-nums" data-testid="meta-filesize">
                  {formatFileSize(resume.file_size)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>SHA-256 Hash</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span
                    style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}
                    title={resume.file_hash}
                  >
                    {resume.file_hash ? `${resume.file_hash.substring(0, 10)}...` : '—'}
                  </span>
                  {resume.file_hash && (
                    <button
                      type="button"
                      onClick={handleCopyHash}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedHash ? 'var(--success)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.15rem',
                      }}
                      title="Copy full hash"
                      aria-label="Copy SHA-256 hash"
                    >
                      <Icon name={copiedHash ? 'check' : 'edit'} size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Uploaded At</span>
                <span style={{ color: 'var(--text-secondary)' }} className="tabular-nums">
                  {formatDate(resume.uploaded_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Processing Diagnostics Card */}
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '0.75rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Icon name="chart" size={16} style={{ color: 'var(--accent-primary)' }} />
              <span>Extraction Diagnostics</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: 'var(--text-xs)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <ResumeStatusBadge status={currentStatus} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Processing Attempts</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }} className="tabular-nums" data-testid="meta-attempts">
                  {statusInfo?.processingAttempts ?? 0} / 3 allowed
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Text Availability</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: statusInfo?.hasExtractedText ? 'var(--success)' : 'var(--text-muted)',
                    backgroundColor: statusInfo?.hasExtractedText ? 'var(--success-bg)' : 'var(--bg-surface)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                  }}
                  data-testid="meta-text-availability"
                >
                  {statusInfo?.hasExtractedText ? 'Available in Vault' : 'Not Extracted'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.625rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Started At</span>
                <span style={{ color: 'var(--text-secondary)' }} className="tabular-nums">
                  {formatDate(statusInfo?.processingStartedAt)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Completed At</span>
                <span style={{ color: 'var(--text-secondary)' }} className="tabular-nums">
                  {formatDate(statusInfo?.processingCompletedAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action / Next Step Card */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--accent-muted)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="sparkles" size={14} />
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Target Job Matching
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Compare candidate credentials against any job posting to evaluate score match, gaps, and tailored suggestions.
            </p>
            <Link
              to={`/analyses/new?resumeId=${resume.resume_id || resumeId}`}
              className="btn btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: 'var(--text-xs)',
                borderRadius: 'var(--radius-lg)',
                marginTop: '0.25rem',
                textDecoration: 'none',
              }}
            >
              <span>Analyze Against a Job</span>
              <Icon name="arrow-right" size={12} />
            </Link>
          </div>
        </div>
      </div>

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
