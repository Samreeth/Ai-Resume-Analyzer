import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ResumesPage from '../pages/resumes/ResumesPage.jsx';
import ResumeDetailPage from '../pages/resumes/ResumeDetailPage.jsx';
import ResumeUpload from '../components/resumes/ResumeUpload.jsx';
import DeleteResumeDialog from '../components/resumes/DeleteResumeDialog.jsx';
import ProtectedRoute from '../layouts/ProtectedRoute.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import resumeApi from '../api/resume.api.js';

// Mock resumeApi
vi.mock('../api/resume.api.js', () => ({
  default: {
    listResumes: vi.fn(),
    getResumeById: vi.fn(),
    uploadResume: vi.fn(),
    deleteResume: vi.fn(),
    processResume: vi.fn(),
    getResumeStatus: vi.fn(),
  },
}));

const mockUser = {
  user_id: 'u-1',
  name: 'Samreeth',
  email: 'samreeth@example.com',
};

const renderWithContext = (ui, { route = '/', isAuthenticated = true } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthContext.Provider
        value={{
          user: isAuthenticated ? mockUser : null,
          isAuthenticated,
          isLoading: false,
        }}
      >
        <ToastProvider>{ui}</ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('Stage 3: Resume Management & Detail Views Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Resume list loading
  it('1. Resume list loading: renders loading indicator during fetch', () => {
    resumeApi.listResumes.mockReturnValue(new Promise(() => {}));

    renderWithContext(<ResumesPage />, { route: '/resumes' });

    expect(screen.getByTestId('resumes-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading candidate resumes/i)).toBeInTheDocument();
  });

  // 2. Resume list rendering
  it('2. Resume list rendering: renders list of resumes with verified metadata and badges', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [
        {
          resume_id: 'r-1',
          file_name: 'backend_developer_resume.pdf',
          file_size: 45000,
          mime_type: 'application/pdf',
          extraction_status: 'COMPLETED',
          uploaded_at: '2026-09-30T10:00:00.000Z',
        },
        {
          resume_id: 'r-2',
          file_name: 'lead_engineer_cv.docx',
          file_size: 68000,
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extraction_status: 'PENDING',
          uploaded_at: '2026-09-30T11:00:00.000Z',
        },
      ],
      pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
    });

    renderWithContext(<ResumesPage />, { route: '/resumes' });

    await waitFor(() => {
      expect(screen.getByText('backend_developer_resume.pdf')).toBeInTheDocument();
      expect(screen.getByText('lead_engineer_cv.docx')).toBeInTheDocument();
    });

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();
    expect(screen.getByText('43.9 KB')).toBeInTheDocument();
  });

  // 3. Resume empty state
  it('3. Resume empty state: displays empty state card when 0 resumes exist', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    renderWithContext(<ResumesPage />, { route: '/resumes' });

    await waitFor(() => {
      expect(screen.getByText(/no resumes uploaded yet/i)).toBeInTheDocument();
      expect(screen.getByTestId('empty-upload-btn')).toBeInTheDocument();
    });
  });

  // 4. Resume list API error + retry
  it('4. Resume list API error + retry: displays error alert and re-fetches upon retry click', async () => {
    resumeApi.listResumes.mockRejectedValueOnce(new Error('Database network timeout'));

    renderWithContext(<ResumesPage />, { route: '/resumes' });

    await waitFor(() => {
      const errorBox = screen.getByTestId('resumes-error');
      expect(errorBox).toBeInTheDocument();
      expect(within(errorBox).getByText(/database network timeout/i)).toBeInTheDocument();
    });

    // Mock successful recovery on retry
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [
        {
          resume_id: 'r-1',
          file_name: 'recovered_resume.pdf',
          file_size: 25000,
          mime_type: 'application/pdf',
          extraction_status: 'COMPLETED',
          uploaded_at: '2026-09-30T10:00:00.000Z',
        },
      ],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    fireEvent.click(screen.getByTestId('resumes-retry-btn'));

    await waitFor(() => {
      expect(screen.getByText('recovered_resume.pdf')).toBeInTheDocument();
    });
  });

  // 5. File validation rejects unsupported file
  it('5. File validation rejects unsupported file: displays error without invoking API', async () => {
    const handleSuccess = vi.fn();
    renderWithContext(<ResumeUpload onUploadSuccess={handleSuccess} />);

    const fileInput = screen.getByTestId('resume-file-input');
    const invalidFile = new File(['dummy content'], 'document.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    expect(
      await screen.findByText(/unsupported file type\. please upload a pdf or docx file/i)
    ).toBeInTheDocument();
    expect(resumeApi.uploadResume).not.toHaveBeenCalled();
    expect(handleSuccess).not.toHaveBeenCalled();
  });

  // 6. File validation rejects >5 MB file
  it('6. File validation rejects >5 MB file: blocks upload and displays size error', async () => {
    const handleSuccess = vi.fn();
    renderWithContext(<ResumeUpload onUploadSuccess={handleSuccess} />);

    const fileInput = screen.getByTestId('resume-file-input');
    // 6 MB file
    const largeFile = new File(['a'.repeat(100)], 'oversized_resume.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(
      await screen.findByText(/file size exceeds 5 mb limit/i)
    ).toBeInTheDocument();
    expect(resumeApi.uploadResume).not.toHaveBeenCalled();
  });

  // 7. Successful upload
  it('7. Successful upload: uploads valid PDF file and triggers success callback', async () => {
    const handleSuccess = vi.fn();
    const createdResume = {
      resume_id: 'r-new',
      file_name: 'candidate_profile.pdf',
      file_size: 10240,
      mime_type: 'application/pdf',
      extraction_status: 'PENDING',
    };

    resumeApi.uploadResume.mockResolvedValueOnce({ resume: createdResume });

    renderWithContext(<ResumeUpload onUploadSuccess={handleSuccess} />);

    const fileInput = screen.getByTestId('resume-file-input');
    const validFile = new File(['pdf-content'], 'candidate_profile.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(validFile, 'size', { value: 10240 });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(await screen.findByText('candidate_profile.pdf')).toBeInTheDocument();

    const uploadBtn = screen.getByTestId('upload-submit-btn');
    expect(uploadBtn).not.toBeDisabled();

    fireEvent.click(uploadBtn);

    await waitFor(() => {
      expect(resumeApi.uploadResume).toHaveBeenCalledWith(validFile);
      expect(handleSuccess).toHaveBeenCalledWith(createdResume);
    });
  });

  // 8. Upload API failure
  it('8. Upload API failure: displays backend error message cleanly', async () => {
    resumeApi.uploadResume.mockRejectedValueOnce(
      new Error('Corrupted or encrypted PDF stream detected.')
    );

    renderWithContext(<ResumeUpload onUploadSuccess={vi.fn()} />);

    const fileInput = screen.getByTestId('resume-file-input');
    const validFile = new File(['corrupt-bytes'], 'corrupt.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });
    fireEvent.click(screen.getByTestId('upload-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-error-alert')).toHaveTextContent(
        /corrupted or encrypted pdf stream detected/i
      );
    });
  });

  // 9. Resume detail loading
  it('9. Resume detail loading: shows spinner while fetching detail', () => {
    resumeApi.getResumeById.mockReturnValue(new Promise(() => {}));
    resumeApi.getResumeStatus.mockReturnValue(new Promise(() => {}));

    renderWithContext(
      <Routes>
        <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
      </Routes>,
      { route: '/resumes/r-101' }
    );

    expect(screen.getByTestId('resume-detail-loading')).toBeInTheDocument();
  });

  // 10. Resume detail rendering
  it('10. Resume detail rendering: renders verified metadata and diagnostics', async () => {
    resumeApi.getResumeById.mockResolvedValueOnce({
      resume_id: 'r-101',
      file_name: 'samreeth_engineer_resume.pdf',
      file_size: 51200,
      mime_type: 'application/pdf',
      file_hash: 'abc123def45678901234567890',
      extraction_status: 'COMPLETED',
      uploaded_at: '2026-09-30T10:00:00.000Z',
    });

    resumeApi.getResumeStatus.mockResolvedValueOnce({
      resumeId: 'r-101',
      extractionStatus: 'COMPLETED',
      processingAttempts: 1,
      processingStartedAt: '2026-09-30T10:01:00.000Z',
      processingCompletedAt: '2026-09-30T10:01:02.000Z',
      hasExtractedText: true,
      canRetry: false,
    });

    renderWithContext(
      <Routes>
        <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
      </Routes>,
      { route: '/resumes/r-101' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('resume-filename-heading')).toHaveTextContent(
        'samreeth_engineer_resume.pdf'
      );
    });

    expect(screen.getByTestId('meta-filename')).toHaveTextContent('samreeth_engineer_resume.pdf');
    expect(screen.getByTestId('meta-mimetype')).toHaveTextContent('application/pdf');
    expect(screen.getByTestId('meta-filesize')).toHaveTextContent('50.0 KB');
    expect(screen.getByTestId('meta-attempts')).toHaveTextContent('1 / 3 allowed');
    expect(screen.getByTestId('meta-text-availability')).toHaveTextContent('Available in Vault');
    expect(screen.getByTestId('text-disclosure-banner')).toBeInTheDocument();
  });

  // 11. Processing action
  it('11. Processing action: triggers extraction and renders returned text preview in session state', async () => {
    resumeApi.getResumeById.mockResolvedValueOnce({
      resume_id: 'r-101',
      file_name: 'pending_resume.pdf',
      file_size: 30000,
      mime_type: 'application/pdf',
      extraction_status: 'PENDING',
      uploaded_at: '2026-09-30T10:00:00.000Z',
    });

    resumeApi.getResumeStatus.mockResolvedValueOnce({
      resumeId: 'r-101',
      extractionStatus: 'PENDING',
      processingAttempts: 0,
      hasExtractedText: false,
      canRetry: true,
    });

    resumeApi.processResume.mockResolvedValueOnce({
      resumeId: 'r-101',
      extractionStatus: 'COMPLETED',
      extractedText: 'SKILLS:\nReact, Node.js, PostgreSQL, Docker\nEXPERIENCE:\nSenior Developer',
      characterCount: 65,
      wordCount: 8,
      processingAttempts: 1,
      processingCompletedAt: '2026-09-30T10:05:00.000Z',
    });

    renderWithContext(
      <Routes>
        <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
      </Routes>,
      { route: '/resumes/r-101' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('trigger-process-btn')).toHaveTextContent('Extract Skills & Text');
    });

    fireEvent.click(screen.getByTestId('trigger-process-btn'));

    await waitFor(() => {
      expect(resumeApi.processResume).toHaveBeenCalledWith('r-101');
      expect(screen.getByTestId('extracted-text-preview')).toBeInTheDocument();
      expect(screen.getByText(/React, Node\.js, PostgreSQL, Docker/i)).toBeInTheDocument();
    });
  });

  // 12. Processing status handling
  it('12. Processing status handling: renders active processing indicator when status is PROCESSING', async () => {
    resumeApi.getResumeById.mockResolvedValueOnce({
      resume_id: 'r-101',
      file_name: 'active_processing.pdf',
      file_size: 40000,
      mime_type: 'application/pdf',
      extraction_status: 'PROCESSING',
      uploaded_at: '2026-09-30T10:00:00.000Z',
    });

    resumeApi.getResumeStatus.mockResolvedValueOnce({
      resumeId: 'r-101',
      extractionStatus: 'PROCESSING',
      processingAttempts: 1,
      hasExtractedText: false,
      canRetry: false,
    });

    renderWithContext(
      <Routes>
        <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
      </Routes>,
      { route: '/resumes/r-101' }
    );

    await waitFor(() => {
      expect(screen.getByText(/processing in progress\.\.\./i)).toBeInTheDocument();
    });
  });

  // 13. Failed processing + retry
  it('13. Failed processing + retry: displays failure diagnostics and allows retry', async () => {
    resumeApi.getResumeById.mockResolvedValueOnce({
      resume_id: 'r-101',
      file_name: 'failed_resume.pdf',
      file_size: 35000,
      mime_type: 'application/pdf',
      extraction_status: 'FAILED',
      uploaded_at: '2026-09-30T10:00:00.000Z',
    });

    resumeApi.getResumeStatus.mockResolvedValueOnce({
      resumeId: 'r-101',
      extractionStatus: 'FAILED',
      processingAttempts: 1,
      processingErrorCode: 'EXTRACTION_TIMEOUT',
      processingErrorMessage: 'Document parsing timed out after 30000ms.',
      hasExtractedText: false,
      canRetry: true,
    });

    resumeApi.processResume.mockResolvedValueOnce({
      resumeId: 'r-101',
      extractionStatus: 'COMPLETED',
      extractedText: 'Parsed content on retry',
      processingAttempts: 2,
    });

    renderWithContext(
      <Routes>
        <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
      </Routes>,
      { route: '/resumes/r-101' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('failure-diagnostic-card')).toBeInTheDocument();
      expect(screen.getByText('EXTRACTION_TIMEOUT')).toBeInTheDocument();
      expect(screen.getByText(/document parsing timed out after 30000ms/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByTestId('trigger-process-btn');
    expect(retryBtn).toHaveTextContent('Retry Extraction');

    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(resumeApi.processResume).toHaveBeenCalledWith('r-101');
    });
  });

  // 14. Delete confirmation
  it('14. Delete confirmation: opens modal with filename and warning', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <DeleteResumeDialog
        isOpen={true}
        resumeName="senior_engineer_resume.pdf"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByText('senior_engineer_resume.pdf')).toBeInTheDocument();
    expect(
      screen.getByText(/this will permanently remove the stored resume file/i)
    ).toBeInTheDocument();
  });

  // 15. Delete cancellation
  it('15. Delete cancellation: closes modal when cancel button is clicked', () => {
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <DeleteResumeDialog
        isOpen={true}
        resumeName="senior_engineer_resume.pdf"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    fireEvent.click(screen.getByTestId('delete-dialog-cancel-btn'));
    expect(handleCancel).toHaveBeenCalledTimes(1);
    expect(handleConfirm).not.toHaveBeenCalled();
  });

  // 16. Successful deletion
  it('16. Successful deletion: calls delete API and navigates to /resumes', async () => {
    resumeApi.getResumeById.mockResolvedValueOnce({
      resume_id: 'r-to-delete',
      file_name: 'delete_me.pdf',
      file_size: 20000,
      mime_type: 'application/pdf',
      extraction_status: 'COMPLETED',
      uploaded_at: '2026-09-30T10:00:00.000Z',
    });
    resumeApi.getResumeStatus.mockResolvedValueOnce({
      resumeId: 'r-to-delete',
      extractionStatus: 'COMPLETED',
    });
    resumeApi.deleteResume.mockResolvedValueOnce({});

    renderWithContext(
      <Routes>
        <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
        <Route path="/resumes" element={<div>Resumes List Target</div>} />
      </Routes>,
      { route: '/resumes/r-to-delete' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-resume-btn')).toBeInTheDocument();
    });

    // Click Delete Resume button to open confirmation dialog
    fireEvent.click(screen.getByTestId('delete-resume-btn'));

    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();

    // Confirm deletion
    fireEvent.click(screen.getByTestId('delete-dialog-confirm-btn'));

    await waitFor(() => {
      expect(resumeApi.deleteResume).toHaveBeenCalledWith('r-to-delete');
      expect(screen.getByText('Resumes List Target')).toBeInTheDocument();
    });
  });

  // 17. Delete API failure
  it('17. Delete API failure: displays deletion error inside dialog without closing', async () => {
    resumeApi.getResumeById.mockResolvedValueOnce({
      resume_id: 'r-fail',
      file_name: 'cannot_delete.pdf',
      file_size: 20000,
      mime_type: 'application/pdf',
      extraction_status: 'COMPLETED',
      uploaded_at: '2026-09-30T10:00:00.000Z',
    });
    resumeApi.getResumeStatus.mockResolvedValueOnce({
      resumeId: 'r-fail',
      extractionStatus: 'COMPLETED',
    });
    resumeApi.deleteResume.mockRejectedValueOnce(
      new Error('Cannot delete resume currently referenced in active analyses.')
    );

    renderWithContext(
      <Routes>
        <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
      </Routes>,
      { route: '/resumes/r-fail' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-resume-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-resume-btn'));
    fireEvent.click(screen.getByTestId('delete-dialog-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-dialog-error')).toHaveTextContent(
        /cannot delete resume currently referenced/i
      );
    });
  });

  // 18. Protected resume routes
  it('18. Protected resume routes: unauthenticated guest is redirected to /login', async () => {
    renderWithContext(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/resumes" element={<ResumesPage />} />
          <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
        </Route>
        <Route path="/login" element={<div>Login Page Guard Target</div>} />
      </Routes>,
      { route: '/resumes', isAuthenticated: false }
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page Guard Target')).toBeInTheDocument();
    });
  });
});
