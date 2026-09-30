import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AnalysesPage from '../pages/analysis/AnalysesPage.jsx';
import CreateAnalysisPage from '../pages/analysis/CreateAnalysisPage.jsx';
import AnalysisDetailPage from '../pages/analysis/AnalysisDetailPage.jsx';
import ProtectedRoute from '../layouts/ProtectedRoute.jsx';
import { AuthContext } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import analysisApi from '../api/analysis.api.js';
import resumeApi from '../api/resume.api.js';
import jobApi from '../api/job.api.js';

// Mock analysisApi, resumeApi, jobApi
vi.mock('../api/analysis.api.js', () => ({
  default: {
    listAnalyses: vi.fn(),
    createAnalysis: vi.fn(),
    getAnalysisById: vi.fn(),
    getRecommendations: vi.fn(),
    deleteAnalysis: vi.fn(),
  },
  analysisApi: {
    listAnalyses: vi.fn(),
    createAnalysis: vi.fn(),
    getAnalysisById: vi.fn(),
    getRecommendations: vi.fn(),
    deleteAnalysis: vi.fn(),
  },
}));

vi.mock('../api/resume.api.js', () => ({
  default: {
    listResumes: vi.fn(),
    getResumeById: vi.fn(),
  },
}));

vi.mock('../api/job.api.js', () => ({
  default: {
    listJobs: vi.fn(),
    getJobById: vi.fn(),
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

const sampleAnalysisData = {
  analysis_id: 'a-1',
  resume_id: 'r-1',
  job_id: 'j-1',
  resume_file_name: 'senior_backend_dev.pdf',
  job_title: 'Lead Distributed Systems Engineer',
  overall_score: 85.0,
  skill_score: 85.0,
  scoring_version: '1.0',
  created_at: '2026-09-30T10:00:00.000Z',
  summary: {
    total_job_skills: 3,
    required_skills_count: 2,
    preferred_skills_count: 1,
    matched_required_count: 2,
    matched_preferred_count: 0,
    missing_required_count: 0,
    missing_preferred_count: 1,
    required_coverage: 1.0,
    preferred_coverage: 0.0,
    average_confidence: 0.9,
  },
  skills: [
    {
      skill_id: 's-1',
      skill_name: 'Node.js',
      category: 'Backend',
      requirement_type: 'REQUIRED',
      status: 'MATCHED',
      similarity_score: 100,
      evidence: "[REQUIRED] Skills section exact match: 'Node.js'",
    },
    {
      skill_id: 's-2',
      skill_name: 'PostgreSQL',
      category: 'Database',
      requirement_type: 'REQUIRED',
      status: 'MATCHED',
      similarity_score: 90,
      evidence: "[REQUIRED] Body context match: 'Postgres'",
    },
    {
      skill_id: 's-3',
      skill_name: 'Kubernetes',
      category: 'DevOps',
      requirement_type: 'PREFERRED',
      status: 'MISSING',
      similarity_score: 0,
      evidence: '[PREFERRED] Skill not detected in candidate resume',
    },
  ],
};

const sampleRecommendationsData = {
  analysis_id: 'a-1',
  overall_score: 85.0,
  skill_score: 85.0,
  created_at: '2026-09-30T10:00:00.000Z',
  skill_gap_analysis: {
    total_job_skills: 3,
    critical_missing_required: [],
    secondary_missing_preferred: [
      {
        skill_name: 'Kubernetes',
        category: 'DevOps',
        requirement_type: 'PREFERRED',
        impact: 'SECONDARY',
        remediation: 'Mentioning project experience with Kubernetes will strengthen your profile.',
      },
    ],
    category_breakdown: {
      Backend: { total: 1, matched: 1, missing: 0, coverage_percentage: 100 },
      Database: { total: 1, matched: 1, missing: 0, coverage_percentage: 100 },
      DevOps: { total: 1, matched: 0, missing: 1, coverage_percentage: 0 },
    },
  },
  resume_quality: {
    status: 'AVAILABLE',
    quality_score: 92.0,
    sections_detected: {
      contact_info: { detected: true, details: 'Email detected' },
      skills_section: { detected: true, details: 'Skills found' },
      experience: { detected: true, details: 'Experience found' },
      education: { detected: true, details: 'Education found' },
      projects: { detected: true, details: 'Projects found' },
    },
    formatting_metrics: {
      word_count: 520,
      word_count_status: 'OPTIMAL',
      bullet_points_count: 14,
      action_verbs_count: 8,
      quantifiable_metrics_count: 4,
    },
    strengths: ['Includes quantifiable metrics (4 detected) demonstrating tangible impact.'],
    deductions: [],
  },
  recommendations: [
    {
      id: 'rec_gap_preferred_kubernetes',
      priority: 'MEDIUM',
      category: 'SKILL_GAP',
      title: 'Highlight Preferred Skill: Kubernetes',
      message: 'Kubernetes is listed as a preferred qualification for this role.',
      action: 'Highlight any familiar tools, coursework, or projects demonstrating Kubernetes.',
    },
    {
      id: 'rec_impact_metrics_sparse',
      priority: 'LOW',
      category: 'IMPACT_METRICS',
      title: 'Expand Quantifiable Results',
      message: 'More numerical outcomes substantiate engineering achievements.',
      action: 'Add percentages and scale markers to your project bullet points.',
    },
  ],
  disclaimer:
    'This analysis is an automated decision-support suggestion generated by deterministic heuristics.',
};

describe('Stage 5: Analysis Creation, Results & Recommendations Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. Analysis list loading
  it('1. Analysis list loading: displays loading indicator during analyses fetch', () => {
    analysisApi.listAnalyses.mockReturnValue(new Promise(() => {}));

    renderWithContext(<AnalysesPage />, { route: '/analyses' });

    expect(screen.getByTestId('analyses-loading')).toBeInTheDocument();
    expect(screen.getByText(/loading match analysis history/i)).toBeInTheDocument();
  });

  // 2. Analysis list rendering
  it('2. Analysis list rendering: renders analyses cards with job titles, scores, and counts', async () => {
    analysisApi.listAnalyses.mockResolvedValueOnce({
      analyses: [
        {
          analysis_id: 'a-1',
          resume_id: 'r-1',
          job_id: 'j-1',
          resume_file_name: 'dev_resume.pdf',
          job_title: 'Principal Software Engineer',
          overall_score: 87.5,
          skill_score: 87.5,
          matched_count: 6,
          missing_count: 1,
          created_at: '2026-09-30T10:00:00.000Z',
        },
      ],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    renderWithContext(<AnalysesPage />, { route: '/analyses' });

    await waitFor(() => {
      expect(screen.getByText('Principal Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('dev_resume.pdf')).toBeInTheDocument();
      expect(screen.getByText('87.5% Match')).toBeInTheDocument();
      expect(screen.getByText('Matched: 6')).toBeInTheDocument();
      expect(screen.getByText('Missing: 1')).toBeInTheDocument();
    });
  });

  // 3. Analysis empty state
  it('3. Analysis empty state: renders empty state when zero analyses exist', async () => {
    analysisApi.listAnalyses.mockResolvedValueOnce({
      analyses: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });

    renderWithContext(<AnalysesPage />, { route: '/analyses' });

    await waitFor(() => {
      expect(screen.getByText(/no compatibility analyses yet/i)).toBeInTheDocument();
      expect(screen.getByTestId('empty-create-analysis-btn')).toBeInTheDocument();
    });
  });

  // 4. Analysis list API error + retry
  it('4. Analysis list API error + retry: displays error alert and recovers on retry', async () => {
    analysisApi.listAnalyses.mockRejectedValueOnce(new Error('Database connectivity error'));

    renderWithContext(<AnalysesPage />, { route: '/analyses' });

    await waitFor(() => {
      expect(screen.getByTestId('analyses-error')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('analyses-error')).getByText('Database connectivity error')
      ).toBeInTheDocument();
    });

    // Provide recovery data
    analysisApi.listAnalyses.mockResolvedValueOnce({
      analyses: [
        {
          analysis_id: 'a-rec',
          job_title: 'Recovered Role Analysis',
          resume_file_name: 'test.pdf',
          overall_score: 95.0,
          matched_count: 4,
          missing_count: 0,
          created_at: '2026-09-30T10:00:00.000Z',
        },
      ],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    fireEvent.click(screen.getByTestId('analyses-retry-btn'));

    await waitFor(() => {
      expect(screen.getByText('Recovered Role Analysis')).toBeInTheDocument();
    });
  });

  // 5. Create analysis page rendering
  it('5. Create analysis page rendering: renders selectors and submit button', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [{ resume_id: 'r-1', file_name: 'resume.pdf', extraction_status: 'COMPLETED' }],
    });
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [{ job_id: 'j-1', title: 'Senior Backend Engineer' }],
    });

    renderWithContext(<CreateAnalysisPage />, { route: '/analyses/new' });

    await waitFor(() => {
      expect(screen.getByText('New Compatibility Match')).toBeInTheDocument();
      expect(screen.getByTestId('resume-select')).toBeInTheDocument();
      expect(screen.getByTestId('job-select')).toBeInTheDocument();
      expect(screen.getByTestId('start-analysis-btn')).toBeInTheDocument();
    });
  });

  // 6. Resume selector loading
  it('6. Resume selector loading: shows loading spinner while fetching candidate resumes', () => {
    resumeApi.listResumes.mockReturnValue(new Promise(() => {}));
    jobApi.listJobs.mockReturnValue(new Promise(() => {}));

    renderWithContext(<CreateAnalysisPage />, { route: '/analyses/new' });

    expect(screen.getByTestId('create-analysis-loading')).toBeInTheDocument();
  });

  // 7. Job selector loading
  it('7. Job selector loading: shows indicator while fetching options', () => {
    resumeApi.listResumes.mockResolvedValueOnce({ resumes: [] });
    jobApi.listJobs.mockReturnValue(new Promise(() => {}));

    renderWithContext(<CreateAnalysisPage />, { route: '/analyses/new' });

    expect(screen.getByTestId('create-analysis-loading')).toBeInTheDocument();
  });

  // 8. Create analysis validation
  it('8. Create analysis validation: enforces selection of both resume and job', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [{ resume_id: 'r-1', file_name: 'resume.pdf', extraction_status: 'COMPLETED' }],
    });
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [{ job_id: 'j-1', title: 'Senior Backend Engineer' }],
    });

    renderWithContext(<CreateAnalysisPage />, { route: '/analyses/new' });

    await waitFor(() => {
      expect(screen.getByTestId('start-analysis-btn')).toBeInTheDocument();
    });

    // Submit empty
    fireEvent.click(screen.getByTestId('start-analysis-btn'));
    expect(screen.getByTestId('create-analysis-validation-error')).toHaveTextContent(
      'Please select a resume for analysis.'
    );

    // Select resume only
    fireEvent.change(screen.getByTestId('resume-select'), { target: { value: 'r-1' } });
    fireEvent.click(screen.getByTestId('start-analysis-btn'));
    expect(screen.getByTestId('create-analysis-validation-error')).toHaveTextContent(
      'Please select a job description for analysis.'
    );
  });

  // 9. Successful analysis creation
  it('9. Successful analysis creation: invokes API and navigates to report', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [{ resume_id: 'r-1', file_name: 'resume.pdf', extraction_status: 'COMPLETED' }],
    });
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [{ job_id: 'j-1', title: 'Senior Backend Engineer' }],
    });
    analysisApi.createAnalysis.mockResolvedValueOnce({
      analysis: {
        analysis_id: 'a-created-123',
        job_title: 'Senior Backend Engineer',
        overall_score: 88.0,
      },
    });

    renderWithContext(
      <Routes>
        <Route path="/analyses/new" element={<CreateAnalysisPage />} />
        <Route path="/analyses/:analysisId" element={<div>Analysis Report Destination</div>} />
      </Routes>,
      { route: '/analyses/new' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('resume-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('resume-select'), { target: { value: 'r-1' } });
    fireEvent.change(screen.getByTestId('job-select'), { target: { value: 'j-1' } });

    fireEvent.click(screen.getByTestId('start-analysis-btn'));

    await waitFor(() => {
      expect(analysisApi.createAnalysis).toHaveBeenCalledWith({
        resumeId: 'r-1',
        jobId: 'j-1',
      });
      expect(screen.getByText('Analysis Report Destination')).toBeInTheDocument();
    });
  });

  // 10. Analysis creation API failure
  it('10. Analysis creation API failure: displays server error inside creation form', async () => {
    resumeApi.listResumes.mockResolvedValueOnce({
      resumes: [{ resume_id: 'r-1', file_name: 'resume.pdf', extraction_status: 'COMPLETED' }],
    });
    jobApi.listJobs.mockResolvedValueOnce({
      jobs: [{ job_id: 'j-1', title: 'Senior Backend Engineer' }],
    });
    analysisApi.createAnalysis.mockRejectedValueOnce(
      new Error('Resume text extraction has not started yet')
    );

    renderWithContext(<CreateAnalysisPage />, { route: '/analyses/new' });

    await waitFor(() => {
      expect(screen.getByTestId('resume-select')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('resume-select'), { target: { value: 'r-1' } });
    fireEvent.change(screen.getByTestId('job-select'), { target: { value: 'j-1' } });

    fireEvent.click(screen.getByTestId('start-analysis-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('create-analysis-error')).toHaveTextContent(
        'Resume text extraction has not started yet'
      );
    });
  });

  // 11. Analysis detail loading
  it('11. Analysis detail loading: displays loading indicator during detail fetch', () => {
    analysisApi.getAnalysisById.mockReturnValue(new Promise(() => {}));
    analysisApi.getRecommendations.mockReturnValue(new Promise(() => {}));

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    expect(screen.getByTestId('analysis-detail-loading')).toBeInTheDocument();
  });

  // 12. Analysis detail rendering
  it('12. Analysis detail rendering: renders header metadata, title, and file name', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('analysis-detail-title')).toHaveTextContent(
        'Lead Distributed Systems Engineer'
      );
      expect(screen.getByText('senior_backend_dev.pdf')).toBeInTheDocument();
    });
  });

  // 13. Match summary rendering
  it('13. Match summary rendering: displays overall score, required and preferred coverages', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('overall-score-display')).toHaveTextContent('85.0%');
      expect(screen.getByTestId('required-coverage-stat')).toHaveTextContent('100.0%');
      expect(screen.getByTestId('preferred-coverage-stat')).toHaveTextContent('0.0%');
      // Verify no client-side score classification labels are invented
      expect(screen.queryByText(/strong match/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/moderate match/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/low match/i)).not.toBeInTheDocument();
    });
  });

  // 14. Required skill rendering
  it('14. Required skill rendering: renders required skills in their dedicated section', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('required-skills-group')).toBeInTheDocument();
      expect(screen.getByTestId('skill-item-s-1')).toHaveTextContent('Node.js');
      expect(screen.getByTestId('skill-item-s-2')).toHaveTextContent('PostgreSQL');
    });
  });

  // 15. Preferred skill rendering
  it('15. Preferred skill rendering: renders preferred skills in their dedicated section', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('preferred-skills-group')).toBeInTheDocument();
      expect(screen.getByTestId('skill-item-s-3')).toHaveTextContent('Kubernetes');
    });
  });

  // 16. Matched/missing status rendering
  it('16. Matched/missing status rendering: renders MATCHED and MISSING badges', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(within(screen.getByTestId('skill-item-s-1')).getByText('MATCHED')).toBeInTheDocument();
      expect(within(screen.getByTestId('skill-item-s-3')).getByText('MISSING')).toBeInTheDocument();
    });
  });

  // 17. Evidence rendering
  it('17. Evidence rendering: renders quotation evidence for evaluated skills', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(
        screen.getByText("\"[REQUIRED] Skills section exact match: 'Node.js'\"")
      ).toBeInTheDocument();
    });
  });

  // 18. Recommendation loading
  it('18. Recommendation loading: displays spinner in recommendations section while loading', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockReturnValue(new Promise(() => {}));

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('analysis-summary-card')).toBeInTheDocument();
      expect(screen.getByTestId('recommendations-loading')).toBeInTheDocument();
    });
  });

  // 19. Recommendation rendering
  it('19. Recommendation rendering: renders prioritized recommendation cards and categories', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('recommendations-section')).toBeInTheDocument();
      expect(screen.getByText('Highlight Preferred Skill: Kubernetes')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM PRIORITY')).toBeInTheDocument();
      expect(screen.getByText('Expand Quantifiable Results')).toBeInTheDocument();
    });
  });

  // 20. Recommendation API failure with analysis remaining visible
  it('20. Recommendation API failure with analysis remaining visible: preserves analysis score and shows recommendation error', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockRejectedValueOnce(
      new Error('Recommendation generation timeout')
    );

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      // Core analysis remains completely visible
      expect(screen.getByTestId('overall-score-display')).toHaveTextContent('85.0%');
      expect(screen.getByTestId('skill-match-list')).toBeInTheDocument();

      // Only recommendations section displays error
      expect(screen.getByTestId('recommendations-error')).toHaveTextContent(
        'Recommendation generation timeout'
      );
    });
  });

  // 21. Recommendation retry
  it('21. Recommendation retry: successfully recovers recommendations on retry button click', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockRejectedValueOnce(
      new Error('Temporary failure')
    );

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('recommendations-retry-btn')).toBeInTheDocument();
    });

    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    fireEvent.click(screen.getByTestId('recommendations-retry-btn'));

    await waitFor(() => {
      expect(screen.getByText('Highlight Preferred Skill: Kubernetes')).toBeInTheDocument();
    });
  });

  // 22. Analysis delete confirmation
  it('22. Analysis delete confirmation: opens modal displaying job title before deletion', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-analysis-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-analysis-page-btn'));

    expect(screen.getByTestId('delete-analysis-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('delete-analysis-dialog')).toHaveTextContent(
      'Lead Distributed Systems Engineer'
    );
  });

  // 23. Analysis delete cancellation
  it('23. Analysis delete cancellation: closes modal without calling delete API', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-analysis-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-analysis-page-btn'));
    expect(screen.getByTestId('delete-analysis-dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-analysis-cancel-btn'));

    expect(screen.queryByTestId('delete-analysis-dialog')).not.toBeInTheDocument();
    expect(analysisApi.deleteAnalysis).not.toHaveBeenCalled();
  });

  // 24. Successful analysis deletion
  it('24. Successful analysis deletion: calls delete API and navigates to /analyses', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);
    analysisApi.deleteAnalysis.mockResolvedValueOnce({});

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        <Route path="/analyses" element={<div>Analyses History Landing</div>} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-analysis-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-analysis-page-btn'));
    fireEvent.click(screen.getByTestId('delete-analysis-confirm-btn'));

    await waitFor(() => {
      expect(analysisApi.deleteAnalysis).toHaveBeenCalledWith('a-1');
      expect(screen.getByText('Analyses History Landing')).toBeInTheDocument();
    });
  });

  // 25. Analysis delete failure
  it('25. Analysis delete failure: displays server error inside deletion modal', async () => {
    analysisApi.getAnalysisById.mockResolvedValueOnce({ analysis: sampleAnalysisData });
    analysisApi.getRecommendations.mockResolvedValueOnce(sampleRecommendationsData);
    analysisApi.deleteAnalysis.mockRejectedValueOnce(
      new Error('Deletion locked by background process')
    );

    renderWithContext(
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
      </Routes>,
      { route: '/analyses/a-1' }
    );

    await waitFor(() => {
      expect(screen.getByTestId('delete-analysis-page-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-analysis-page-btn'));
    fireEvent.click(screen.getByTestId('delete-analysis-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-analysis-dialog-error')).toHaveTextContent(
        'Deletion locked by background process'
      );
    });
  });

  // 26. Protected analysis routes
  it('26. Protected analysis routes: unauthenticated visitor is redirected to /login', async () => {
    renderWithContext(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/analyses" element={<AnalysesPage />} />
          <Route path="/analyses/new" element={<CreateAnalysisPage />} />
          <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        </Route>
        <Route path="/login" element={<div>Login Page Guard Target</div>} />
      </Routes>,
      { route: '/analyses', isAuthenticated: false }
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page Guard Target')).toBeInTheDocument();
    });
  });
});
