import React, { useState, useRef } from 'react';
import resumeApi from '../../api/resume.api.js';
import { useToast } from '../../hooks/useToast.js';
import Button from '../common/Button.jsx';
import Icon from '../common/Icon.jsx';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Reusable Resume Upload component
 * Enforces file constraints, performs validation, and uploads via resumeApi.uploadResume.
 *
 * @param {object} props
 * @param {function} props.onUploadSuccess - Callback with created resume record
 * @param {function} [props.onError] - Optional error callback
 * @param {string} [props.className='']
 */
export const ResumeUpload = ({
  onUploadSuccess,
  onError,
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

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setValidationError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`card ${className}`.trim()} data-testid="resume-upload-card">
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Upload Candidate Resume
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Supports PDF or DOCX format up to 5 MB. Files are stored securely outside the web root.
        </p>
      </div>

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

      {/* Dropzone */}
      <div
        className={`upload-dropzone ${isDragActive ? 'drag-active' : ''}`}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload dropzone. Click or drop a PDF or DOCX file here."
        data-testid="upload-dropzone"
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-muted)',
            color: 'var(--accent-primary)',
            marginBottom: '0.875rem',
          }}
          aria-hidden="true"
        >
          <Icon name="upload" size={26} />
        </div>

        {selectedFile ? (
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {selectedFile.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }} className="tabular-nums">
              {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready to upload
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Choose a file or drag & drop here
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              PDF or DOCX (Max 5 MB)
            </div>
          </div>
        )}
      </div>

      {/* Validation / Server Error Alert */}
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
            marginTop: '1rem',
          }}
          data-testid="upload-error-alert"
        >
          {validationError}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
        {selectedFile && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={clearSelectedFile}
            disabled={isUploading}
            data-testid="upload-clear-btn"
          >
            Clear
          </Button>
        )}

        <Button
          type="button"
          variant="primary"
          onClick={handleUpload}
          loading={isUploading}
          disabled={!selectedFile || isUploading}
          data-testid="upload-submit-btn"
        >
          {isUploading ? 'Uploading...' : 'Upload Resume'}
        </Button>
      </div>
    </div>
  );
};

export default ResumeUpload;
