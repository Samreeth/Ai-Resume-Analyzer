import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import JobsPage from '../pages/jobs/JobsPage.jsx';
import JobDetailPage from '../pages/jobs/JobDetailPage.jsx';
import JobForm from '../components/jobs/JobForm.jsx';
import JobRequirements from '../components/jobs/JobRequirements.jsx';
import DeleteJobDialog from '../components/jobs/DeleteJobDialog.jsx';
import ProtectedRoute from '../layouts/ProtectedRoute.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import jobApi from '../api/job.api.js';

// Mock jobApi
vi.mock('../api/job.api.js', () => ({
  default: {
    listJobs: vi.fn(),
    createJob: vi.fn(),
    getJobById: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    extractJobSkills: vi.fn(),
    extractJob: vi.fn(),
  },
  jobApi: {
    listJobs: vi.fn(),
    createJob: vi.fn(),
    getJobById: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    extractJobSkills: vi.fn(),
    extractJob: vi.fn(),
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

describe('Stage 4: Job Description Management Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Job list loading
  it('1. Job list loading: displays loading indicator during jobs fetch', () => {
    jobApi.listJobs.mockReturnValue(new Promise(() => {}));

    renderWithContext(<JobsPage />, { route: '/jobs' });

    expect(screen.getByTestId('jobs-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading job descriptions/i)).toBeInTheDocument();
  });

  // 2. Job list rendering
  it('2. Job list rendering: renders list of jobs with titles, skill counts, and dates', async () => {
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [
        {
          job_id: 'j-1',
          title: 'Senior Backend Engineer',
          created_at: '2026-09-30T10:00:00.000Z',
          updated_at: '2026-09-30T10:00:00.000Z',
          skill_counts: { required: 3, preferred: 2, total: 5 },
        },
        {
          job_id: 'j-2',
          title: 'DevOps Lead',
          created_at: '2026-09-30T11:00:00.000Z',
          updated_at: '2026-09-30T11:00:00.000Z',
          skill_counts: { required: 2, preferred: 1, total: 3 },
        },
      ],
      pagination: { total: 2, page: 1, limit: 10, totalPages: 1 },
    });

    renderWithContext(<JobsPage />, { route: '/jobs' });

    await waitFor(() => {
      expect(screen.getByText('Senior Backend Engineer')).toBeInTheDocument();
      expect(screen.getByText('DevOps Lead')).toBeInTheDocument();
    });

    expect(screen.getByText('Required: 3')).toBeInTheDocument();
    expect(screen.getByText('Preferred: 2')).toBeInTheDocument();
    expect(screen.getByText('Required: 2')).toBeInTheDocument();
    expect(screen.getByText('Preferred: 1')).toBeInTheDocument();
  });

  // 3. Job empty state
  it('3. Job empty state: renders empty state when zero job descriptions exist', async () => {
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    renderWithContext(<JobsPage />, { route: '/jobs' });

    await waitFor(() => {
      expect(screen.getByText(/no job descriptions created yet/i)).toBeInTheDocument();
      expect(screen.getByTestId('empty-create-job-btn')).toBeInTheDocument();
    });
  });

  // 4. Job list API error + retry
  it('4. Job list API error + retry: displays error state and retries on action', async () => {
    jobApi.listJobs.mockRejectedValueOnce(new Error('Network connectivity issue'));

    renderWithContext(<JobsPage />, { route: '/jobs' });

    await waitFor(() => {
      expect(screen.getByTestId('jobs-error')).toBeInTheDocument();
      expect(within(screen.getByTestId('jobs-error')).getByText('Network connectivity issue')).toBeInTheDocument();
    });

    // Provide recovery data on retry
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [
        {
          job_id: 'j-rec',
          title: 'Site Reliability Engineer',
          created_at: '2026-09-30T10:00:00.000Z',
          updated_at: '2026-09-30T10:00:00.000Z',
          skill_counts: { required: 1, preferred: 1, total: 2 },
        },
      ],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    fireEvent.click(screen.getByTestId('jobs-retry-btn'));

    await waitFor(() => {
      expect(screen.getByText('Site Reliability Engineer')).toBeInTheDocument();
    });
  });

  // 5. Create job form rendering
  it('5. Create job form rendering: toggles new job description form with inputs', async () => {
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    renderWithContext(<JobsPage />, { route: '/jobs' });

    await waitFor(() => {
      expect(screen.getByTestId('toggle-create-job-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-create-job-btn'));

    expect(screen.getByTestId('create-job-card')).toBeInTheDocument();
    expect(screen.getByTestId('job-title-input')).toBeInTheDocument();
    expect(screen.getByTestId('job-description-input')).toBeInTheDocument();
    expect(screen.getByTestId('job-form-submit-btn')).toHaveTextContent(/Create & Extract Skills/i);
  });

  // 6. Create job validation
  it('6. Create job validation: enforces required fields and length constraints', async () => {
    const handleSubmit = vi.fn();
    render(<JobForm onSubmit={handleSubmit} />);

    // Submit empty
    fireEvent.click(screen.getByTestId('job-form-submit-btn'));

    expect(screen.getByText('Job title is required')).toBeInTheDocument();
    expect(screen.getByText('Job description is required')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();

    // Enter short values (title < 3, description < 20)
    fireEvent.change(screen.getByTestId('job-title-input'), { target: { value: 'Go' } });
    fireEvent.change(screen.getByTestId('job-description-input'), { target: { value: 'Too short' } });

    fireEvent.click(screen.getByTestId('job-form-submit-btn'));

    expect(screen.getByText('Job title must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Job description must be at least 20 characters')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  // 7. Successful job creation
  it('7. Successful job creation: creates job and invokes API with trimmed payload', async () => {
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    jobApi.createJob.mockResolvedValueOnce({
      job: {
        job_id: 'j-new',
        title: 'Cloud Infrastructure Lead',
        description: 'Deep AWS, Terraform, and Kubernetes infrastructure knowledge required for scalable cloud deployments.',
        created_at: '2026-09-30T12:00:00.000Z',
        updated_at: '2026-09-30T12:00:00.000Z',
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<div>Job Detail Destination</div>} />
      </Routes>,
      { route: '/jobs' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-create-job-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-create-job-btn'));

    fireEvent.change(screen.getByTestId('job-title-input'), {
      target: { value: '  Cloud Infrastructure Lead  ' },
    });
    fireEvent.change(screen.getByTestId('job-description-input'), {
      target: {
        value: '  Deep AWS, Terraform, and Kubernetes infrastructure knowledge required for scalable cloud deployments.  ',
      },
    });

    fireEvent.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(jobApi.createJob).toHaveBeenCalledWith({
        title: 'Cloud Infrastructure Lead',
        description:
          'Deep AWS, Terraform, and Kubernetes infrastructure knowledge required for scalable cloud deployments.',
      });
      expect(screen.getByText('Job Detail Destination')).toBeInTheDocument();
    });
  });

  // 8. Create job API failure
  it('8. Create job API failure: displays API error message in form', async () => {
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    jobApi.createJob.mockRejectedValueOnce(new Error('Job title already exists for this organization'));

    renderWithContext(<JobsPage />, { route: '/jobs' });

    await waitFor(() => {
      expect(screen.getByTestId('toggle-create-job-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-create-job-btn'));

    fireEvent.change(screen.getByTestId('job-title-input'), {
      target: { value: 'Existing Title' },
    });
    fireEvent.change(screen.getByTestId('job-description-input'), {
      target: { value: 'Valid job description with sufficient length over twenty characters.' },
    });

    fireEvent.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('job-form-server-error')).toHaveTextContent(
        'Job title already exists for this organization'
      );
    });
  });

  // 9. Job detail loading
  it('9. Job detail loading: displays loading indicator during detail fetch', () => {
    jobApi.getJobById.mockReturnValue(new Promise(() => {}));

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    expect(screen.getByTestId('job-detail-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading job details/i)).toBeInTheDocument();
  });

  // 10. Job detail rendering
  it('10. Job detail rendering: renders title, full description, and extracted requirements', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Senior Backend Engineer',
        description: 'Looking for a Senior Backend Engineer proficient in Node.js, PostgreSQL, and distributed architectures.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T11:00:00.000Z',
        extracted_data: {
          required: [
            {
              skillId: 's-1',
              skillName: 'Node.js',
              category: 'Backend',
              requirementType: 'REQUIRED',
              evidence: 'proficient in Node.js',
            },
          ],
          preferred: [
            {
              skillId: 's-2',
              skillName: 'PostgreSQL',
              category: 'Database',
              requirementType: 'PREFERRED',
              evidence: 'and PostgreSQL',
            },
          ],
          metadata: { totalRequired: 1, totalPreferred: 1 },
        },
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('job-detail-title')).toHaveTextContent('Senior Backend Engineer');
      expect(screen.getByTestId('job-full-description')).toHaveTextContent(
        'Looking for a Senior Backend Engineer proficient in Node.js, PostgreSQL, and distributed architectures.'
      );
    });

    expect(screen.getByText('Node.js')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('"proficient in Node.js"')).toBeInTheDocument();
  });

  // 11. Edit form pre-population
  it('11. Edit form pre-population: pre-populates form with current job values', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Original Title',
        description: 'Original full job description containing at least twenty characters of content.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-edit-job-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-edit-job-btn'));

    expect(screen.getByTestId('edit-job-card')).toBeInTheDocument();
    expect(screen.getByTestId('job-title-input')).toHaveValue('Original Title');
    expect(screen.getByTestId('job-description-input')).toHaveValue(
      'Original full job description containing at least twenty characters of content.'
    );
  });

  // 12. Successful job update
  it('12. Successful job update: updates title and description via PUT API', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Initial Title',
        description: 'Initial full description with sufficient character length here.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.updateJob.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Updated Principal Engineer',
        description: 'Updated comprehensive description for the principal engineer position.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T12:00:00.000Z',
        extracted_data: null,
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-edit-job-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-edit-job-btn'));

    fireEvent.change(screen.getByTestId('job-title-input'), {
      target: { value: 'Updated Principal Engineer' },
    });
    fireEvent.change(screen.getByTestId('job-description-input'), {
      target: { value: 'Updated comprehensive description for the principal engineer position.' },
    });

    fireEvent.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(jobApi.updateJob).toHaveBeenCalledWith('j-1', {
        title: 'Updated Principal Engineer',
        description: 'Updated comprehensive description for the principal engineer position.',
      });
      expect(screen.getByTestId('job-detail-title')).toHaveTextContent('Updated Principal Engineer');
      expect(screen.queryByTestId('edit-job-card')).not.toBeInTheDocument();
    });
  });

  // 13. Job update failure
  it('13. Job update failure: renders server error when update is rejected', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Lead Engineer',
        description: 'Valid job description that has more than twenty characters.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.updateJob.mockRejectedValueOnce(new Error('Update failed due to concurrency collision'));

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-edit-job-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('toggle-edit-job-btn'));

    fireEvent.change(screen.getByTestId('job-title-input'), {
      target: { value: 'Modified Engineer' },
    });

    fireEvent.click(screen.getByTestId('job-form-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('job-form-server-error')).toHaveTextContent(
        'Update failed due to concurrency collision'
      );
    });
  });

  // 14. Extract requirements action
  it('14. Extract requirements action: triggers extraction API on button click', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Platform Engineer',
        description: 'Platform engineer with extensive Docker and Kubernetes production experience.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.extractJobSkills.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Platform Engineer',
        description: 'Platform engineer with extensive Docker and Kubernetes production experience.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: {
          required: [{ skillName: 'Docker', category: 'DevOps' }],
          preferred: [],
        },
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('extract-requirements-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('extract-requirements-btn'));

    await waitFor(() => {
      expect(jobApi.extractJobSkills).toHaveBeenCalledWith('j-1');
    });
  });

  // 15. Extraction loading state
  it('15. Extraction loading state: shows extraction progress spinner and disables button', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Platform Engineer',
        description: 'Platform engineer with extensive Docker experience.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.extractJobSkills.mockReturnValue(new Promise(() => {}));

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('extract-requirements-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('extract-requirements-btn'));

    expect(screen.getByTestId('requirements-loading')).toBeInTheDocument();
    expect(screen.getByTestId('extract-requirements-btn')).toBeDisabled();
  });

  // 16. Successful extraction rendering
  it('16. Successful extraction rendering: renders newly extracted required and preferred skills', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Platform Engineer',
        description: 'Platform engineer with extensive Docker and Kubernetes experience.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.extractJobSkills.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Platform Engineer',
        description: 'Platform engineer with extensive Docker and Kubernetes experience.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: {
          required: [
            {
              skillId: 's-10',
              skillName: 'Docker',
              category: 'DevOps',
              requirementType: 'REQUIRED',
              evidence: 'extensive Docker',
            },
          ],
          preferred: [
            {
              skillId: 's-11',
              skillName: 'Kubernetes',
              category: 'DevOps',
              requirementType: 'PREFERRED',
              evidence: 'and Kubernetes',
            },
          ],
        },
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('extract-requirements-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('extract-requirements-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('required-skill-Docker')).toBeInTheDocument();
      expect(screen.getByTestId('preferred-skill-Kubernetes')).toBeInTheDocument();
    });
  });

  // 17. Extraction error state
  it('17. Extraction error state: renders error alert when extraction API fails', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Platform Engineer',
        description: 'Platform engineer with extensive Docker experience.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.extractJobSkills.mockRejectedValueOnce(new Error('Skill extraction engine failure'));

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('extract-requirements-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('extract-requirements-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('requirements-error')).toHaveTextContent(
        'Skill extraction engine failure'
      );
    });
  });

  // 18. Delete confirmation
  it('18. Delete confirmation: opens modal displaying job title before deletion', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Target Delete Role',
        description: 'Full description for target delete role with sufficient characters.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-job-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-job-page-btn'));

    expect(screen.getByTestId('delete-job-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('delete-job-dialog')).toHaveTextContent('Target Delete Role');
  });

  // 19. Delete cancellation
  it('19. Delete cancellation: closes modal without calling delete API', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Safe Role',
        description: 'Full description for safe role with sufficient characters.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-job-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-job-page-btn'));
    expect(screen.getByTestId('delete-job-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-job-cancel-btn'));

    expect(screen.queryByTestId('delete-job-dialog')).not.toBeInTheDocument();
    expect(jobApi.deleteJob).not.toHaveBeenCalled();
  });

  // 20. Successful deletion
  it('20. Successful deletion: calls delete API and navigates back to /jobs', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Doomed Role',
        description: 'Full description for doomed role with sufficient characters.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.deleteJob.mockResolvedValueOnce({});

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/jobs" element={<div>Jobs List Landing</div>} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-job-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-job-page-btn'));
    fireEvent.click(screen.getByTestId('delete-job-confirm-btn'));

    await waitFor(() => {
      expect(jobApi.deleteJob).toHaveBeenCalledWith('j-1');
      expect(screen.getByText('Jobs List Landing')).toBeInTheDocument();
    });
  });

  // 21. Delete API failure
  it('21. Delete API failure: displays deletion error inside modal', async () => {
    jobApi.getJobById.mockResolvedValueOnce({
      job: {
        job_id: 'j-1',
        title: 'Active Referenced Role',
        description: 'Full description for active referenced role with sufficient characters.',
        created_at: '2026-09-30T10:00:00.000Z',
        updated_at: '2026-09-30T10:00:00.000Z',
        extracted_data: null,
      },
    });

    jobApi.deleteJob.mockRejectedValueOnce(
      new Error('Cannot delete job description referenced in historical analyses')
    );

    renderWithContext(
      <Routes>
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
      </Routes>,
      { route: '/jobs/j-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-job-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-job-page-btn'));
    fireEvent.click(screen.getByTestId('delete-job-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-job-dialog-error')).toHaveTextContent(
        'Cannot delete job description referenced in historical analyses'
      );
    });
  });

  // 22. Protected job routes
  it('22. Protected job routes: redirects unauthenticated visitors to /login', async () => {
    renderWithContext(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        </Route>
        <Route path="/login" element={<div>Login Page Guard Target</div>} />
      </Routes>,
      { route: '/jobs', isAuthenticated: false }
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page Guard Target')).toBeInTheDocument();
    });
  });
});
