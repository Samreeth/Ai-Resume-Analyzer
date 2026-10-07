import React, { useState, useRef } from 'react';
import resumeApi from '../../api/resume.api.js';
import { useToast } from '../../hooks/useToast.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Reusable Resume Upload dropzone component
 * Styled exactly to match the user's reference mockup with centered cloud-pill icon,
 * clean typography, "Cancel" text action, and purple pill "Select Files" button.
 *
 * @param {object} props
 * @param {function} props.onUploadSuccess - Callback with created resume record
 * @param {function} [props.onError] - Optional error callback
 * @param {function} [props.onCancel] - Optional cancel callback
 * @param {string} [props.className='']
 */
export const ResumeUpload = ({
  onUploadSuccess,
  onError,
  onCancel,
  className = '',
}) => {
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const validateFile = (file) => {
    if (!file) {
      return 'Please select a file to upload.';
    }

    const name = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
    const hasValidMime =
      !file.type || ALLOWED_MIME_TYPES.includes(file.type.toLowerCase());

    if (!hasValidExt || !hasValidMime) {
      return 'Unsupported file type. Please upload a PDF or DOCX file.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File size exceeds 5 MB limit. Please select a smaller file.';
    }

    if (file.size === 0) {
      return 'File is empty (0 bytes). Please upload a valid document.';
    }

    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setValidationError('');

    if (file) {
      const errorMsg = validateFile(file);
      if (errorMsg) {
        setValidationError(errorMsg);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setSelectedFile(file);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = e.dataTransfer?.files?.[0];
    setValidationError('');

    if (file) {
      const errorMsg = validateFile(file);
      if (errorMsg) {
        setValidationError(errorMsg);
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
      }
    }
  };

  const handleUpload = async (e) => {
    e?.preventDefault();

    if (!selectedFile) {
      setValidationError('Please select a file to upload.');
      return;
    }

    const errorMsg = validateFile(selectedFile);
    if (errorMsg) {
      setValidationError(errorMsg);
      return;
    }

    try {
      setIsUploading(true);
      setValidationError('');

      const result = await resumeApi.uploadResume(selectedFile);
      toast.success(`Resume "${selectedFile.name}" uploaded successfully.`);

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onUploadSuccess && result?.resume) {
        onUploadSuccess(result.resume);
      }
    } catch (err) {
      const msg = err.message || 'Failed to upload resume. Please try again.';
      setValidationError(msg);
      toast.error(msg);
      if (onError) {
        onError(err);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelectedFile = (e) => {
    e?.stopPropagation();
    setSelectedFile(null);
    setValidationError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onCancel) {
      onCancel();
    }
  };

  const handleCardClick = () => {
    if (!isUploading && !selectedFile) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className={`card ${className}`.trim()}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '1rem',
        padding: '2.25rem 1.5rem',
        border: isDragActive
          ? '3px dotted var(--accent-primary)'
          : '1.5px dotted var(--border-default)',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        position: 'relative',
        cursor: selectedFile ? 'default' : 'pointer',
        transition: 'all var(--transition-fast)',
      }}
      onClick={handleCardClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="resume-upload-card"
    >
      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        id="resume-file-input"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileChange}
        disabled={isUploading}
        style={{ display: 'none' }}
        data-testid="resume-file-input"
        aria-label="Select resume document"
      />

      {/* Dropzone container target for accessibility & tests */}
      <div
        data-testid="upload-dropzone"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {/* Centered Cloud Icon in Pill */}
        <div
          style={{
            width: '2.875rem',
            height: '2.875rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.875rem',
            transition: 'transform var(--transition-fast)',
          }}
          aria-hidden="true"
        >
          {/* Custom Cloud Upload SVG matching the reference design */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
            <path d="M12 12v9" />
            <path d="m8 16 4-4 4 4" />
          </svg>
        </div>

        {/* Selected File Details or Default Title */}
        {selectedFile ? (
          <div style={{ marginBottom: '0.35rem' }}>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                wordBreak: 'break-all',
                maxWidth: '460px',
              }}
            >
              {selectedFile.name}
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginTop: '0.2rem',
              }}
              className="tabular-nums"
            >
              {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready to upload
            </div>
          </div>
        ) : (
          <>
            {/* Primary Headline */}
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                marginBottom: '0.35rem',
              }}
            >
              Drag and drop resume here, or click to browse
            </div>

            {/* Subtitle */}
            <div
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              PDF or DOCX up to 15MB
            </div>
          </>
        )}

        {/* Validation Error Alert */}
        {validationError && (
          <div
            role="alert"
            style={{
              backgroundColor: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              color: 'var(--danger-text)',
              padding: '0.5rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8125rem',
              marginBottom: '1rem',
              maxWidth: '460px',
              textAlign: 'center',
            }}
            data-testid="upload-error-alert"
          >
            {validationError}
          </div>
        )}

        {/* Actions Row matching the reference layout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.25rem',
            marginTop: selectedFile ? '0.75rem' : '0.125rem',
          }}
        >
          {/* Cancel Action */}
          <button
            type="button"
            onClick={clearSelectedFile}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '0.4rem 0.5rem',
              transition: 'color var(--transition-fast)',
            }}
            data-testid="upload-clear-btn"
          >
            Cancel
          </button>

          {/* Primary Action Button ("Select Files" or "Process Resume") */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (selectedFile) {
                handleUpload(e);
              } else {
                fileInputRef.current?.click();
              }
            }}
            disabled={isUploading}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              padding: '0.5rem 1.35rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)',
              transition: 'all var(--transition-fast)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            data-testid="upload-submit-btn"
          >
            {isUploading ? (
              <>
                <span
                  className="material-symbols-outlined animate-spin"
                  style={{ fontSize: '1rem' }}
                >
                  progress_activity
                </span>
                <span>Uploading...</span>
              </>
            ) : selectedFile ? (
              <span>Process Resume</span>
            ) : (
              <span>Select Files</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeUpload;
