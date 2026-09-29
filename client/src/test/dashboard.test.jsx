import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import resumeApi from '../api/resume.api.js';
import jobApi from '../api/job.api.js';
import analysisApi from '../api/analysis.api.js';

vi.mock('../api/resume.api.js', () => ({
  default: {
    listResumes: vi.fn(),
  },
}));

vi.mock('../api/job.api.js', () => ({
  default: {
    listJobs: vi.fn(),
  },
}));

vi.mock('../api/analysis.api.js', () => ({
  default: {
    listAnalyses: vi.fn(),
  },
}));

const mockAuthUser = {
  user_id: 'u1',
  name: 'Samreeth',
  email: 'samreeth@example.com',
};

const renderDashboard = () => {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          user: mockAuthUser,
          isAuthenticated: true,
          isLoading: false,
        }}
      >
        <ToastProvider>
          <DashboardPage />
        </ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('Dashboard Page Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 11. Dashboard loading state
  it('11. Dashboard loading state: renders spinner and loading message during fetch', () => {
    resumeApi.listResumes.mockReturnValue(new Promise(() => {}));
    jobApi.listJobs.mockReturnValue(new Promise(() => {}));
    analysisApi.listAnalyses.mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading dashboard summary/i)).toBeInTheDocument();
  });

  // 12. Dashboard metric rendering using actual API response shapes
  it('12. Dashboard metric rendering: correctly parses total counts and recent items from backend response shapes', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [
        {
          resume_id: 'r-101',
          file_name: 'backend_developer_resume.pdf',
          file_size: 20480,
          mime_type: 'application/pdf',
          extraction_status: 'COMPLETED',
          uploaded_at: '2026-09-29T10:00:00.000Z',
        },
      ],
      pagination: { total: 4, page: 1, limit: 5, totalPages: 1 },
    });

    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [
        {
          job_id: 'j-201',
          title: 'Staff Platform Engineer',
          description: 'Looking for Node.js and Postgres experience',
          extracted_data: { skills: ['Node.js', 'PostgreSQL', 'Docker'] },
          created_at: '2026-09-29T11:00:00.000Z',
        },
      ],
      pagination: { total: 7, page: 1, limit: 5, totalPages: 2 },
    });

    analysisApi.listAnalyses.mockResolvedValueOnce({
      analyses: [
        {
          analysis_id: 'a-301',
          resume_id: 'r-101',
          job_id: 'j-201',
          resume_file_name: 'fullstack_resume.pdf',
          job_title: 'Senior Node.js Architect',
          overall_score: 87.5,
          skill_score: 87.5,
          matched_count: 5,
          missing_count: 1,
          created_at: '2026-09-29T12:00:00.000Z',
        },
      ],
      pagination: { total: 12, page: 1, limit: 5, totalPages: 3 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    // Check Metrics Cards
    expect(screen.getByTestId('metric-total-resumes')).toHaveTextContent('4');
    expect(screen.getByTestId('metric-total-jobs')).toHaveTextContent('7');
    expect(screen.getByTestId('metric-total-analyses')).toHaveTextContent('12');

    // Check Recent Items Rendered
    expect(screen.getByText('Senior Node.js Architect')).toBeInTheDocument();
    expect(screen.getByText('Staff Platform Engineer')).toBeInTheDocument();
    expect(screen.getByText('fullstack_resume.pdf')).toBeInTheDocument();
    expect(screen.getByText('backend_developer_resume.pdf')).toBeInTheDocument();
    expect(screen.getByText('87.5%')).toBeInTheDocument();
    expect(screen.getByText(/5 matched/i)).toBeInTheDocument();
    expect(screen.getByText(/1 missing/i)).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText(/3 extracted skills/i)).toBeInTheDocument();
  });

  // 13. Dashboard empty states
  it('13. Dashboard empty states: displays informative empty cards when collections have 0 items', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [],
      pagination: { total: 0, page: 1, limit: 5, totalPages: 0 },
    });

    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [],
      pagination: { total: 0, page: 1, limit: 5, totalPages: 0 },
    });

    analysisApi.listAnalyses.mockResolvedValueOnce({
      analyses: [],
      pagination: { total: 0, page: 1, limit: 5, totalPages: 0 },
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    // Metrics should display 0
    expect(screen.getByTestId('metric-total-resumes')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-total-jobs')).toHaveTextContent('0');
    expect(screen.getByTestId('metric-total-analyses')).toHaveTextContent('0');

    // Empty States
    expect(screen.getByText(/no match analyses yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no resumes uploaded/i)).toBeInTheDocument();
    expect(screen.getByText(/no jobs created/i)).toBeInTheDocument();
  });

  // 14. Dashboard API failure handling
  it('14. Dashboard API failure handling: displays error banner and allows retry', async () => {
    resumeApi.listResumes.mockRejectedValueOnce(new Error('Database gateway unavailable'));
    jobApi.listJobs.mockResolvedValueOnce({ jobs: [], pagination: { total: 0 } });
    analysisApi.listAnalyses.mockResolvedValueOnce({ analyses: [], pagination: { total: 0 } });

    renderDashboard();

    await waitFor(() => {
      const errorBanner = screen.getByTestId('dashboard-error');
      expect(errorBanner).toBeInTheDocument();
      expect(within(errorBanner).getByText(/database gateway unavailable/i)).toBeInTheDocument();
    });

    // Mock successful recovery on retry
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [],
      pagination: { total: 2, page: 1, limit: 5, totalPages: 1 },
    });
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });
    analysisApi.listAnalyses.mockResolvedValueOnce({
      analyses: [],
      pagination: { total: 0, page: 1, limit: 5, totalPages: 0 },
    });

    fireEvent.click(screen.getByTestId('dashboard-retry-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      expect(screen.getByTestId('metric-total-resumes')).toHaveTextContent('2');
    });
  });
});
