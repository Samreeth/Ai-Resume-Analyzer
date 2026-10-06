import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Core and API imports
import apiClient from '../api/apiClient.js';
import aiApi from '../api/ai.api.js';
import analysisApi from '../api/analysis.api.js';
import resumeApi from '../api/resume.api.js';

// Components under test
import ProvenanceBadge from '../components/ai/ProvenanceBadge.jsx';
import VerificationBadge from '../components/ai/VerificationBadge.jsx';
import EvidenceSnippet from '../components/ai/EvidenceSnippet.jsx';
import AiConsentCard from '../components/ai/AiConsentCard.jsx';
import AiLoadingSkeleton from '../components/ai/AiLoadingSkeleton.jsx';
import AiErrorAlert from '../components/ai/AiErrorAlert.jsx';
import ResumeAiProfileCard from '../components/ai/ResumeAiProfileCard.jsx';
import JobComparisonCard from '../components/ai/JobComparisonCard.jsx';
import PersonalizedRecommendations from '../components/ai/PersonalizedRecommendations.jsx';

// Pages under test
import ResumeDetailPage from '../pages/resumes/ResumeDetailPage.jsx';
import AnalysisDetailPage from '../pages/analysis/AnalysisDetailPage.jsx';

// Context Providers
import { AuthContext } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';

// Mocks
vi.mock('../api/apiClient.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../api/analysis.api.js', () => ({
  default: {
    getAnalysisById: vi.fn(),
    getRecommendations: vi.fn(),
    deleteAnalysis: vi.fn(),
  },
}));

vi.mock('../api/resume.api.js', () => ({
  default: {
    getResumeById: vi.fn(),
    getResumeStatus: vi.fn(),
    processResume: vi.fn(),
    deleteResume: vi.fn(),
  },
}));

const mockUser = {
  user_id: 'u-101',
  name: 'Candidate User',
  email: 'user@example.com',
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

describe('Stage 5: Frontend AI Integration Suite (48 Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Part 1: Explicit Consent Architecture (Tests 1–6)
  // =========================================================================
  describe('Part 1: Explicit Consent Architecture', () => {
    it('1. API: generateResumeAiProfile rejects with AI_CONSENT_REQUIRED when consent is not true', async () => {
      await expect(aiApi.generateResumeAiProfile('res-1', { consent: false })).rejects.toMatchObject({
        code: 'AI_CONSENT_REQUIRED',
        status: 400,
      });
      await expect(aiApi.generateResumeAiProfile('res-1', { consent: null })).rejects.toMatchObject({
        code: 'AI_CONSENT_REQUIRED',
        status: 400,
      });
      await expect(aiApi.generateResumeAiProfile('res-1')).rejects.toMatchObject({
        code: 'AI_CONSENT_REQUIRED',
        status: 400,
      });
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('2. API: generateJobComparison rejects with AI_CONSENT_REQUIRED when consent is not true', async () => {
      await expect(
        aiApi.generateJobComparison('res-1', { jobId: 'job-1', consent: false })
      ).rejects.toMatchObject({
        code: 'AI_CONSENT_REQUIRED',
        status: 400,
      });
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('3. API: generateAiRecommendations rejects with AI_CONSENT_REQUIRED when consent is not true', async () => {
      await expect(
        aiApi.generateAiRecommendations('res-1', { jobId: 'job-1', consent: undefined })
      ).rejects.toMatchObject({
        code: 'AI_CONSENT_REQUIRED',
        status: 400,
      });
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('4. UI: AiConsentCard renders with submit button disabled when checkbox is unchecked', () => {
      const onSubmit = vi.fn();
      render(<AiConsentCard type="resume-profile" onConsentSubmit={onSubmit} />);

      const checkbox = screen.getByTestId('ai-consent-checkbox');
      const submitBtn = screen.getByTestId('ai-consent-submit-btn');

      expect(checkbox).not.toBeChecked();
      expect(submitBtn).toBeDisabled();

      fireEvent.click(submitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('5. UI: AiConsentCard enables submit button only after checkbox is checked and submits consent: true', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<AiConsentCard type="resume-profile" onConsentSubmit={onSubmit} />);

      const checkbox = screen.getByTestId('ai-consent-checkbox');
      const submitBtn = screen.getByTestId('ai-consent-submit-btn');

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
      expect(submitBtn).not.toBeDisabled();

      await user.click(submitBtn);
      expect(onSubmit).toHaveBeenCalledWith({ consent: true });
    });

    it('6. UI: AiConsentCard renders contextual text for resume-profile vs job-analysis', () => {
      const { rerender } = render(<AiConsentCard type="resume-profile" onConsentSubmit={vi.fn()} />);

      expect(screen.getByTestId('ai-consent-title')).toHaveTextContent('AI-Powered Resume Understanding');
      expect(screen.getByTestId('ai-consent-description').textContent).not.toMatch(/job description/i);

      rerender(<AiConsentCard type="job-analysis" onConsentSubmit={vi.fn()} />);
      expect(screen.getByTestId('ai-consent-title')).toHaveTextContent('Contextual AI Analysis & Recommendations');
      expect(screen.getByTestId('ai-consent-description').textContent).toMatch(/job description/i);
    });
  });

  // =========================================================================
  // Part 2: Provenance & Grounding Presentation (Tests 7–12)
  // =========================================================================
  describe('Part 2: Provenance & Grounding Presentation', () => {
    it('7. ProvenanceBadge renders "Resume Evidence" with green styling for RESUME_EVIDENCE', () => {
      render(<ProvenanceBadge sourceType="RESUME_EVIDENCE" />);
      const badge = screen.getByTestId('provenance-badge-resume');
      expect(badge).toHaveTextContent('Resume Evidence');
      expect(badge).toHaveAttribute('title', 'Directly grounded in candidate resume text');
    });

    it('8. ProvenanceBadge renders "Deterministic Analysis" with accent styling for DETERMINISTIC_ANALYSIS', () => {
      render(<ProvenanceBadge sourceType="DETERMINISTIC_ANALYSIS" />);
      const badge = screen.getByTestId('provenance-badge-deterministic');
      expect(badge).toHaveTextContent('Deterministic Analysis');
      expect(badge).toHaveAttribute('title', 'Derived from authoritative deterministic skill analysis');
    });

    it('9. ProvenanceBadge renders "Role Requirement — Employer Expectation" for JOB_REQUIREMENT', () => {
      render(<ProvenanceBadge sourceType="JOB_REQUIREMENT" />);
      const badge = screen.getByTestId('provenance-badge-job');
      expect(badge).toHaveTextContent('Role Requirement — Employer Expectation');
    });

    it('10. ProvenanceBadge for JOB_REQUIREMENT includes disclaimer in tooltip that it does not indicate candidate skill', () => {
      render(<ProvenanceBadge sourceType="JOB_REQUIREMENT" />);
      const badge = screen.getByTestId('provenance-badge-job');
      expect(badge.getAttribute('title')).toContain('Identified from employer job description — does not indicate that the candidate possesses this skill');
    });

    it('11. EvidenceSnippet renders verbatim blockquote when non-empty string is provided', () => {
      render(<EvidenceSnippet snippet="5+ years developing distributed backend systems in Go and Node.js" />);
      const snippet = screen.getByTestId('evidence-snippet');
      expect(snippet).toHaveTextContent('5+ years developing distributed backend systems in Go and Node.js');
    });

    it('12. EvidenceSnippet returns null when snippet is empty string or null', () => {
      const { container, rerender } = render(<EvidenceSnippet snippet="" />);
      expect(container.firstChild).toBeNull();

      rerender(<EvidenceSnippet snippet={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  // =========================================================================
  // Part 3: Verification Status Presentation (Tests 13–18)
  // =========================================================================
  describe('Part 3: Verification Status Presentation', () => {
    it('13. VerificationBadge renders "Verified" for VERIFIED status', () => {
      render(<VerificationBadge status="VERIFIED" />);
      const badge = screen.getByTestId('verification-badge-verified');
      expect(badge).toHaveTextContent('Verified');
    });

    it('14. VerificationBadge renders "Unverified" for UNVERIFIED status', () => {
      render(<VerificationBadge status="UNVERIFIED" />);
      const badge = screen.getByTestId('verification-badge-unverified');
      expect(badge).toHaveTextContent('Unverified');
    });

    it('15. VerificationBadge displays unverified_reason in tooltip when provided', () => {
      render(<VerificationBadge status="UNVERIFIED" reason="No verbatim mention of Kubernetes in resume" />);
      const badge = screen.getByTestId('verification-badge-unverified');
      expect(badge).toHaveAttribute('title', 'Unverified: No verbatim mention of Kubernetes in resume');
    });

    it('16. ResumeAiProfileCard renders unverified styling and reason for unverified claims', async () => {
      vi.spyOn(aiApi, 'getResumeAiProfile').mockResolvedValue({
        cached: true,
        version: '1.0',
        profile: {
          professional_summary: {
            text: 'Senior Full Stack Architect with extensive AWS experience.',
            verification_status: 'UNVERIFIED',
            unverified_reason: 'AWS experience claimed without matching project details',
            evidence_snippet: null,
          },
          technical_skills: [
            {
              name: 'Docker',
              verification_status: 'UNVERIFIED',
              unverified_reason: 'Implicit skill claim',
            },
          ],
        },
      });

      renderWithContext(<ResumeAiProfileCard resumeId="res-1" extractionStatus="COMPLETED" />);

      await waitFor(() => {
        expect(screen.getByTestId('resume-ai-profile-card')).toBeInTheDocument();
      });

      const unverifiedBadges = screen.getAllByTestId('verification-badge-unverified');
      expect(unverifiedBadges.length).toBeGreaterThanOrEqual(1);
      expect(unverifiedBadges[0]).toHaveAttribute('title', expect.stringContaining('AWS experience claimed'));
    });

    it('17. JobComparisonCard renders unverified badge on unverified claims', async () => {
      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({
        cached: true,
        version: '1.1',
        comparison: {
          overall_context: {
            source_type: 'RESUME_EVIDENCE',
            summary: 'Context summary',
            verification_status: 'UNVERIFIED',
            unverified_reason: 'Synthesized overview',
          },
          strengths: [
            {
              claim: 'Strong Python fluency',
              source_type: 'RESUME_EVIDENCE',
              verification_status: 'UNVERIFIED',
              unverified_reason: 'No explicit projects listed',
            },
          ],
          gaps: [],
          requirement_analysis: [],
        },
      });

      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-card')).toBeInTheDocument();
      });

      expect(screen.getAllByTestId('verification-badge-unverified').length).toBeGreaterThanOrEqual(1);
    });

    it('18. PersonalizedRecommendations renders unverified badge and reason on overall_strategy', async () => {
      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({
        cached: true,
        version: '1.0',
        recommendations: {
          overall_strategy: {
            summary: 'Focus on highlighting DevOps and Cloud architecture.',
            verification_status: 'UNVERIFIED',
            unverified_reason: 'Strategy synthesizes aspirational direction',
          },
          recommendations: [],
        },
      });

      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('personalized-recommendations-card')).toBeInTheDocument();
      });

      const unverifiedBadge = screen.getByTestId('verification-badge-unverified');
      expect(unverifiedBadge).toHaveAttribute('title', expect.stringContaining('Strategy synthesizes aspirational direction'));
    });
  });

  // =========================================================================
  // Part 4: Resume AI Profile Lifecycle & Integration (Tests 19–25)
  // =========================================================================
  describe('Part 4: Resume AI Profile Lifecycle & Integration', () => {
    it('19. ResumeAiProfileCard renders pending notice if extractionStatus !== COMPLETED', () => {
      renderWithContext(<ResumeAiProfileCard resumeId="res-1" extractionStatus="PROCESSING" />);
      expect(screen.getByTestId('ai-profile-pending-notice')).toBeInTheDocument();
      expect(screen.getByText(/Document text extraction must complete/i)).toBeInTheDocument();
    });

    it('20. ResumeAiProfileCard renders loading skeleton while fetching cached profile', () => {
      vi.spyOn(aiApi, 'getResumeAiProfile').mockReturnValue(new Promise(() => {}));
      renderWithContext(<ResumeAiProfileCard resumeId="res-1" extractionStatus="COMPLETED" />);

      expect(screen.getByTestId('ai-loading-skeleton')).toBeInTheDocument();
      expect(screen.getByText(/Extracting professional profile/i)).toBeInTheDocument();
    });

    it('21. ResumeAiProfileCard renders consent card on 404 with code AI_PROFILE_NOT_FOUND', async () => {
      const notFoundErr = new Error('Not found');
      notFoundErr.status = 404;
      notFoundErr.code = 'AI_PROFILE_NOT_FOUND';
      vi.spyOn(aiApi, 'getResumeAiProfile').mockRejectedValue(notFoundErr);

      renderWithContext(<ResumeAiProfileCard resumeId="res-1" extractionStatus="COMPLETED" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-profile-uncached-section')).toBeInTheDocument();
      });
      expect(screen.getByTestId('ai-consent-card')).toBeInTheDocument();
    });

    it('22. ResumeAiProfileCard renders stale banner on 404 with code AI_PROFILE_STALE and regenerates', async () => {
      const user = userEvent.setup();
      const staleErr = new Error('Stale profile');
      staleErr.status = 404;
      staleErr.code = 'AI_PROFILE_STALE';
      vi.spyOn(aiApi, 'getResumeAiProfile').mockRejectedValue(staleErr);

      const generateSpy = vi.spyOn(aiApi, 'generateResumeAiProfile').mockResolvedValue({
        cached: false,
        version: '1.0',
        profile: {
          professional_summary: { text: 'Regenerated summary', verification_status: 'VERIFIED' },
          technical_skills: [],
        },
      });

      renderWithContext(<ResumeAiProfileCard resumeId="res-1" extractionStatus="COMPLETED" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-profile-stale-card')).toBeInTheDocument();
      });

      const regenBtn = screen.getByTestId('ai-profile-regenerate-stale-btn');
      await user.click(regenBtn);

      expect(generateSpy).toHaveBeenCalledWith('res-1', { consent: true, forceRefresh: true });
      await waitFor(() => {
        expect(screen.getByTestId('resume-ai-profile-card')).toBeInTheDocument();
      });
    });

    it('23. ResumeAiProfileCard renders "Cached • v1.0" badge when cached profile is loaded', async () => {
      vi.spyOn(aiApi, 'getResumeAiProfile').mockResolvedValue({
        cached: true,
        version: '1.0',
        profile: {
          professional_summary: { text: 'Seasoned engineer', verification_status: 'VERIFIED' },
        },
      });

      renderWithContext(<ResumeAiProfileCard resumeId="res-1" extractionStatus="COMPLETED" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-profile-cached-badge')).toBeInTheDocument();
      });
      expect(screen.getByTestId('ai-profile-cached-badge')).toHaveTextContent('Cached • v1.0');
    });

    it('24. ResumeAiProfileCard renders "Live Profile" badge when newly generated profile is returned', async () => {
      const user = userEvent.setup();
      const notFoundErr = new Error('Not found');
      notFoundErr.status = 404;
      notFoundErr.code = 'AI_PROFILE_NOT_FOUND';
      vi.spyOn(aiApi, 'getResumeAiProfile').mockRejectedValue(notFoundErr);

      vi.spyOn(aiApi, 'generateResumeAiProfile').mockResolvedValue({
        cached: false,
        version: '1.0',
        profile: {
          professional_summary: { text: 'Live generated summary', verification_status: 'VERIFIED' },
        },
      });

      renderWithContext(<ResumeAiProfileCard resumeId="res-1" extractionStatus="COMPLETED" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-consent-checkbox')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ai-consent-checkbox'));
      await user.click(screen.getByTestId('ai-consent-submit-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('ai-profile-live-badge')).toBeInTheDocument();
      });
      expect(screen.getByTestId('ai-profile-live-badge')).toHaveTextContent('Live Profile');
    });

    it('25. ResumeDetailPage mounts ResumeAiProfileCard alongside metadata and diagnostics', async () => {
      resumeApi.getResumeById.mockResolvedValue({
        resume: {
          resume_id: 'res-101',
          file_name: 'test-resume.pdf',
          file_size: 15400,
          mime_type: 'application/pdf',
          extraction_status: 'COMPLETED',
          uploaded_at: '2026-10-06T10:00:00Z',
        },
      });
      resumeApi.getResumeStatus.mockResolvedValue({
        extractionStatus: 'COMPLETED',
        processingAttempts: 1,
        hasExtractedText: true,
      });

      vi.spyOn(aiApi, 'getResumeAiProfile').mockResolvedValue({
        cached: true,
        version: '1.0',
        profile: {
          professional_summary: { text: 'Full-stack software engineer', verification_status: 'VERIFIED' },
        },
      });

      renderWithContext(
        <Routes>
          <Route path="/resumes/:resumeId" element={<ResumeDetailPage />} />
        </Routes>,
        { route: '/resumes/res-101' }
      );

      await waitFor(() => {
        expect(screen.getByTestId('meta-filename')).toHaveTextContent('test-resume.pdf');
      });

      expect(screen.getByTestId('resume-ai-profile-card')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Part 5: Job Comparison Lifecycle & Integration (Tests 26–32)
  // =========================================================================
  describe('Part 5: Job Comparison Lifecycle & Integration', () => {
    it('26. JobComparisonCard renders loading skeleton while fetching cached comparison', () => {
      vi.spyOn(aiApi, 'getJobComparison').mockReturnValue(new Promise(() => {}));
      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      expect(screen.getByTestId('ai-loading-skeleton')).toBeInTheDocument();
      expect(screen.getByText(/Comparing resume qualifications/i)).toBeInTheDocument();
    });

    it('27. JobComparisonCard renders consent card on 404 with code AI_COMPARISON_NOT_FOUND', async () => {
      const err = new Error('Not found');
      err.status = 404;
      err.code = 'AI_COMPARISON_NOT_FOUND';
      vi.spyOn(aiApi, 'getJobComparison').mockRejectedValue(err);

      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-uncached-section')).toBeInTheDocument();
      });
      expect(screen.getByTestId('ai-consent-card')).toBeInTheDocument();
    });

    it('28. JobComparisonCard renders stale card on 404 with code AI_COMPARISON_STALE and regenerates', async () => {
      const user = userEvent.setup();
      const err = new Error('Stale');
      err.status = 404;
      err.code = 'AI_COMPARISON_STALE';
      vi.spyOn(aiApi, 'getJobComparison').mockRejectedValue(err);

      const genSpy = vi.spyOn(aiApi, 'generateJobComparison').mockResolvedValue({
        cached: false,
        version: '1.1',
        comparison: {
          overall_context: { summary: 'Fresh fit overview', source_type: 'RESUME_EVIDENCE', verification_status: 'VERIFIED' },
        },
      });

      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-stale-card')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('job-comparison-regenerate-stale-btn'));
      expect(genSpy).toHaveBeenCalledWith('res-1', { jobId: 'job-1', consent: true, forceRefresh: true });

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-card')).toBeInTheDocument();
      });
    });

    it('29. JobComparisonCard renders "Cached • v1.1" badge when cached comparison is loaded', async () => {
      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({
        cached: true,
        version: '1.1',
        comparison: {
          overall_context: { summary: 'Solid contextual alignment', source_type: 'RESUME_EVIDENCE', verification_status: 'VERIFIED' },
        },
      });

      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-comparison-cached-badge')).toBeInTheDocument();
      });
      expect(screen.getByTestId('ai-comparison-cached-badge')).toHaveTextContent('Cached • v1.1');
    });

    it('30. JobComparisonCard renders strengths, gaps, and requirement analysis with correct provenance badges', async () => {
      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({
        cached: true,
        version: '1.1',
        comparison: {
          overall_context: { summary: 'Great candidate fit', source_type: 'RESUME_EVIDENCE', verification_status: 'VERIFIED' },
          strengths: [
            {
              claim: 'Extensive experience in React',
              source_type: 'RESUME_EVIDENCE',
              verification_status: 'VERIFIED',
              evidence_snippet: '3 years of React development',
            },
          ],
          gaps: [
            {
              claim: 'Missing GraphQL backend knowledge',
              source_type: 'DETERMINISTIC_ANALYSIS',
              verification_status: 'VERIFIED',
              evidence_snippet: null,
            },
          ],
          requirement_analysis: [
            {
              requirement: 'GraphQL Experience',
              context: 'The role requires building GraphQL schemas',
              match_type: 'NO_EVIDENCE',
              source_type: 'JOB_REQUIREMENT',
              verification_status: 'VERIFIED',
            },
          ],
        },
      });

      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-card')).toBeInTheDocument();
      });

      expect(screen.getByTestId('ai-strength-item')).toHaveTextContent('Extensive experience in React');
      expect(screen.getByTestId('ai-gap-item')).toHaveTextContent('Missing GraphQL backend knowledge');
      expect(screen.getByTestId('ai-requirement-item')).toHaveTextContent('GraphQL Experience');
    });

    it('31. JobComparisonCard displays employer expectation disclaimer on JOB_REQUIREMENT items', async () => {
      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({
        cached: true,
        version: '1.1',
        comparison: {
          requirement_analysis: [
            {
              requirement: 'Kafka Streaming',
              context: 'Must possess enterprise Kafka stream experience',
              source_type: 'JOB_REQUIREMENT',
              verification_status: 'VERIFIED',
            },
          ],
        },
      });

      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-card')).toBeInTheDocument();
      });

      const jobProvenance = screen.getByTestId('provenance-badge-job');
      expect(jobProvenance).toHaveTextContent('Role Requirement — Employer Expectation');
      expect(jobProvenance.getAttribute('title')).toContain('does not indicate that the candidate possesses this skill');
    });

    it('32. JobComparisonCard regenerate button triggers generateJobComparison with forceRefresh: true', async () => {
      const user = userEvent.setup();
      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({
        cached: true,
        version: '1.1',
        comparison: {
          overall_context: { summary: 'Cached overview', source_type: 'RESUME_EVIDENCE', verification_status: 'VERIFIED' },
        },
      });

      const genSpy = vi.spyOn(aiApi, 'generateJobComparison').mockResolvedValue({
        cached: false,
        version: '1.1',
        comparison: {
          overall_context: { summary: 'Fresh overview', source_type: 'RESUME_EVIDENCE', verification_status: 'VERIFIED' },
        },
      });

      renderWithContext(<JobComparisonCard resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-comparison-regenerate-btn')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('ai-comparison-regenerate-btn'));
      expect(genSpy).toHaveBeenCalledWith('res-1', { jobId: 'job-1', consent: true, forceRefresh: true });
    });
  });

  // =========================================================================
  // Part 6: Recommendations Lifecycle & Deterministic Authority (Tests 33–39)
  // =========================================================================
  describe('Part 6: Personalized Recommendations Lifecycle & Authority', () => {
    it('33. PersonalizedRecommendations renders loading skeleton while fetching', () => {
      vi.spyOn(aiApi, 'getAiRecommendations').mockReturnValue(new Promise(() => {}));
      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      expect(screen.getByTestId('ai-loading-skeleton')).toBeInTheDocument();
      expect(screen.getByText(/Synthesizing personalized resume positioning strategy/i)).toBeInTheDocument();
    });

    it('34. PersonalizedRecommendations renders consent card on 404 with code AI_RECOMMENDATIONS_NOT_FOUND', async () => {
      const err = new Error('Not found');
      err.status = 404;
      err.code = 'AI_RECOMMENDATIONS_NOT_FOUND';
      vi.spyOn(aiApi, 'getAiRecommendations').mockRejectedValue(err);

      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-recommendations-uncached-section')).toBeInTheDocument();
      });
      expect(screen.getByTestId('ai-consent-card')).toBeInTheDocument();
    });

    it('35. PersonalizedRecommendations renders stale card on 404 with code AI_RECOMMENDATIONS_STALE', async () => {
      const err = new Error('Stale');
      err.status = 404;
      err.code = 'AI_RECOMMENDATIONS_STALE';
      vi.spyOn(aiApi, 'getAiRecommendations').mockRejectedValue(err);

      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('ai-recommendations-stale-card')).toBeInTheDocument();
      });
    });

    it('36. PersonalizedRecommendations renders overall strategy and recommendations list', async () => {
      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({
        cached: true,
        version: '1.0',
        recommendations: {
          overall_strategy: {
            summary: 'Align system design experience with senior lead expectations.',
            verification_status: 'VERIFIED',
          },
          recommendations: [
            {
              id: 'rec-1',
              category: 'SKILL_GAP',
              source_type: 'DETERMINISTIC_ANALYSIS',
              title: 'Address TypeScript Gap',
              recommendation: 'Highlight recent TypeScript migrations.',
              rationale: 'TypeScript is required in the JD.',
              priority: 'HIGH',
              evidence_snippet: null,
              verification_status: 'VERIFIED',
            },
          ],
        },
      });

      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('personalized-recommendations-card')).toBeInTheDocument();
      });

      expect(screen.getByTestId('ai-strategy-section')).toHaveTextContent('Align system design experience');
      expect(screen.getByTestId('ai-recommendation-item')).toHaveTextContent('Address TypeScript Gap');
    });

    it('37. PersonalizedRecommendations renders locked note on SKILL_GAP items', async () => {
      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({
        cached: true,
        version: '1.0',
        recommendations: {
          recommendations: [
            {
              id: 'rec-gap-1',
              category: 'SKILL_GAP',
              source_type: 'DETERMINISTIC_ANALYSIS',
              title: 'Learn Docker containerization',
              recommendation: 'Complete Docker certification',
              rationale: 'Docker is a missing required skill',
              priority: 'HIGH',
              evidence_snippet: null,
              verification_status: 'VERIFIED',
            },
          ],
        },
      });

      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('skill-gap-authority-note')).toBeInTheDocument();
      });
      expect(screen.getByTestId('skill-gap-authority-note')).toHaveTextContent(/Priority and gap severity authoritatively derived/i);
    });

    it('38. PersonalizedRecommendations displays employer expectation disclaimer for JOB_REQUIREMENT items', async () => {
      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({
        cached: true,
        version: '1.0',
        recommendations: {
          recommendations: [
            {
              id: 'rec-req-1',
              category: 'JOB_REQUIREMENT',
              source_type: 'JOB_REQUIREMENT',
              title: 'Understand SOC2 Compliance Requirements',
              recommendation: 'Familiarize with SOC2 policies',
              rationale: 'Employer operates in regulated industry',
              priority: 'MEDIUM',
              verification_status: 'VERIFIED',
            },
          ],
        },
      });

      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getByTestId('job-requirement-disclaimer')).toBeInTheDocument();
      });
      expect(screen.getByTestId('job-requirement-disclaimer')).toHaveTextContent(
        /Identified from employer job description — does not indicate that the candidate possesses this skill/i
      );
    });

    it('39. PersonalizedRecommendations category filter buttons filter items correctly', async () => {
      const user = userEvent.setup();
      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({
        cached: true,
        version: '1.0',
        recommendations: {
          recommendations: [
            {
              id: 'item-1',
              category: 'SKILL_GAP',
              source_type: 'DETERMINISTIC_ANALYSIS',
              title: 'Skill Gap Item',
              recommendation: 'Do X',
              rationale: 'Why X',
              priority: 'HIGH',
              verification_status: 'VERIFIED',
            },
            {
              id: 'item-2',
              category: 'RESUME_STRENGTH',
              source_type: 'RESUME_EVIDENCE',
              title: 'Strength Item',
              recommendation: 'Do Y',
              rationale: 'Why Y',
              priority: 'MEDIUM',
              evidence_snippet: 'Built Y',
              verification_status: 'VERIFIED',
            },
          ],
        },
      });

      renderWithContext(<PersonalizedRecommendations resumeId="res-1" jobId="job-1" />);

      await waitFor(() => {
        expect(screen.getAllByTestId('ai-recommendation-item').length).toBe(2);
      });

      // Click Skill Gaps filter
      await user.click(screen.getByTestId('filter-skill_gap'));
      expect(screen.getAllByTestId('ai-recommendation-item').length).toBe(1);
      expect(screen.getByText('Skill Gap Item')).toBeInTheDocument();

      // Click Resume Strengths filter
      await user.click(screen.getByTestId('filter-resume_strength'));
      expect(screen.getAllByTestId('ai-recommendation-item').length).toBe(1);
      expect(screen.getByText('Strength Item')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Part 7: Independent State & Deterministic Authority (Tests 40–44)
  // =========================================================================
  describe('Part 7: Independent State & Deterministic Authority', () => {
    const mockAnalysisPayload = {
      analysis_id: 'a-101',
      resume_id: 'res-101',
      job_id: 'job-101',
      resume_file_name: 'engineer-resume.pdf',
      job_title: 'Principal Software Engineer',
      overall_score: 84.5,
      skill_score: 88.0,
      experience_score: 80.0,
      project_score: 85.0,
      education_score: 85.0,
      quality_score: 90.0,
      scoring_version: '1.0',
      created_at: '2026-10-06T10:00:00Z',
      skills: [
        {
          skill_id: 's-1',
          skill_name: 'Node.js',
          status: 'MATCHED',
          requirement_type: 'REQUIRED',
          evidence: '[REQUIRED] Mentioned in work experience',
          similarity_score: 1.0,
        },
      ],
    };

    it('40. AnalysisDetailPage displays authoritative deterministic score and skill matches intact', async () => {
      analysisApi.getAnalysisById.mockResolvedValue(mockAnalysisPayload);
      analysisApi.getRecommendations.mockResolvedValue({
        recommendations: [],
        resume_quality: { total_score: 90 },
      });
      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({ cached: true, version: '1.1', comparison: {} });
      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({ cached: true, version: '1.0', recommendations: {} });

      renderWithContext(
        <Routes>
          <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        </Routes>,
        { route: '/analyses/a-101' }
      );

      await waitFor(() => {
        expect(screen.getByTestId('analysis-detail-title')).toHaveTextContent('Principal Software Engineer');
      });

      expect(screen.getByText('84.5%')).toBeInTheDocument();
      expect(screen.getByText('Node.js')).toBeInTheDocument();
    });

    it('41. AnalysisDetailPage mounts both JobComparisonCard and PersonalizedRecommendations independently', async () => {
      analysisApi.getAnalysisById.mockResolvedValue(mockAnalysisPayload);
      analysisApi.getRecommendations.mockResolvedValue({ recommendations: [] });
      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({
        cached: true,
        version: '1.1',
        comparison: { overall_context: { summary: 'Comparison text', source_type: 'RESUME_EVIDENCE', verification_status: 'VERIFIED' } },
      });
      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({
        cached: true,
        version: '1.0',
        recommendations: { overall_strategy: { summary: 'Recommendations text', verification_status: 'VERIFIED' } },
      });

      renderWithContext(
        <Routes>
          <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        </Routes>,
        { route: '/analyses/a-101' }
      );

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-card')).toBeInTheDocument();
      });
      expect(screen.getByTestId('personalized-recommendations-card')).toBeInTheDocument();
    });

    it('42. Independent state: Comparison error does NOT hide or affect recommendations', async () => {
      analysisApi.getAnalysisById.mockResolvedValue(mockAnalysisPayload);
      analysisApi.getRecommendations.mockResolvedValue({ recommendations: [] });

      const cmpErr = new Error('Job comparison failed');
      cmpErr.status = 500;
      vi.spyOn(aiApi, 'getJobComparison').mockRejectedValue(cmpErr);

      vi.spyOn(aiApi, 'getAiRecommendations').mockResolvedValue({
        cached: true,
        version: '1.0',
        recommendations: {
          overall_strategy: { summary: 'Strategy remains completely intact', verification_status: 'VERIFIED' },
        },
      });

      renderWithContext(
        <Routes>
          <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        </Routes>,
        { route: '/analyses/a-101' }
      );

      await waitFor(() => {
        expect(screen.getByTestId('ai-error-alert')).toBeInTheDocument();
      });

      // Recommendations card is still fully rendered!
      expect(screen.getByTestId('personalized-recommendations-card')).toBeInTheDocument();
      expect(screen.getByText('Strategy remains completely intact')).toBeInTheDocument();
    });

    it('43. Independent state: Recommendations loading does NOT hide comparison results', async () => {
      analysisApi.getAnalysisById.mockResolvedValue(mockAnalysisPayload);
      analysisApi.getRecommendations.mockResolvedValue({ recommendations: [] });

      vi.spyOn(aiApi, 'getJobComparison').mockResolvedValue({
        cached: true,
        version: '1.1',
        comparison: { overall_context: { summary: 'Comparison is loaded and visible', source_type: 'RESUME_EVIDENCE', verification_status: 'VERIFIED' } },
      });

      // Recommendations remains pending/loading
      vi.spyOn(aiApi, 'getAiRecommendations').mockReturnValue(new Promise(() => {}));

      renderWithContext(
        <Routes>
          <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        </Routes>,
        { route: '/analyses/a-101' }
      );

      await waitFor(() => {
        expect(screen.getByTestId('job-comparison-card')).toBeInTheDocument();
      });

      expect(screen.getByText('Comparison is loaded and visible')).toBeInTheDocument();
      expect(screen.getByTestId('ai-loading-skeleton')).toBeInTheDocument();
    });

    it('44. Independent state: AI failure does not affect deterministic recommendations or resume quality', async () => {
      analysisApi.getAnalysisById.mockResolvedValue(mockAnalysisPayload);
      analysisApi.getRecommendations.mockResolvedValue({
        recommendations: [
          {
            recommendation_id: 'det-rec-1',
            type: 'ADD_SKILL',
            category: 'SKILL',
            priority: 'HIGH',
            title: 'Add Python',
            description: 'Add Python to resume',
            effort: 'LOW',
          },
        ],
        resume_quality: {
          total_score: 92,
          formatting_score: 95,
        },
      });

      const err = new Error('AI Unavailable');
      err.status = 503;
      err.code = 'AI_SERVICE_UNAVAILABLE';
      vi.spyOn(aiApi, 'getJobComparison').mockRejectedValue(err);
      vi.spyOn(aiApi, 'getAiRecommendations').mockRejectedValue(err);

      renderWithContext(
        <Routes>
          <Route path="/analyses/:analysisId" element={<AnalysisDetailPage />} />
        </Routes>,
        { route: '/analyses/a-101' }
      );

      await waitFor(() => {
        expect(screen.getByTestId('analysis-header-card')).toBeInTheDocument();
      });

      // Deterministic recommendations remain visible and authoritative!
      expect(screen.getByText('Add Python')).toBeInTheDocument();
      // Resume quality card remains visible!
      expect(screen.getByTestId('resume-quality-card')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Part 8: Error Handling & Security Leakage Prevention (Tests 45–48)
  // =========================================================================
  describe('Part 8: Error Handling & Security Leakage Prevention', () => {
    it('45. AiErrorAlert maps 429 AI_RATE_LIMITED to friendly rate limit message', () => {
      const err = new Error('Rate limit exceeded');
      err.status = 429;
      err.code = 'AI_RATE_LIMITED';

      render(<AiErrorAlert error={err} />);
      expect(screen.getByTestId('ai-error-title')).toHaveTextContent('AI Rate Limit Exceeded');
      expect(screen.getByTestId('ai-error-message')).toHaveTextContent(/rate limit has been temporarily reached/i);
    });

    it('46. AiErrorAlert maps 503 AI_SERVICE_UNAVAILABLE to graceful fallback message', () => {
      const err = new Error('Service down');
      err.status = 503;
      err.code = 'AI_SERVICE_UNAVAILABLE';

      render(<AiErrorAlert error={err} />);
      expect(screen.getByTestId('ai-error-title')).toHaveTextContent('AI Service Unavailable');
      expect(screen.getByTestId('ai-error-message')).toHaveTextContent(/All deterministic scoring, skill matches, and core features remain fully operational/i);
    });

    it('47. AiErrorAlert maps 404 RESOURCE_NOT_FOUND to resource not found message without retrying', () => {
      const err = new Error('Not found');
      err.status = 404;
      err.code = 'RESOURCE_NOT_FOUND';

      render(<AiErrorAlert error={err} onRetry={vi.fn()} />);
      expect(screen.getByTestId('ai-error-title')).toHaveTextContent('Resource Not Found');
      expect(screen.getByTestId('ai-error-message')).toHaveTextContent(/requested resume or job description was not found/i);
      expect(screen.queryByTestId('ai-error-retry-btn')).not.toBeInTheDocument();
    });

    it('48. Security: Zero storage of AI results, Gemini keys, or raw text in localStorage/sessionStorage', async () => {
      const fakeAiResult = {
        cached: false,
        profile: {
          professional_summary: { text: 'Top secret candidate summary' },
        },
      };

      vi.spyOn(aiApi, 'getResumeAiProfile').mockResolvedValue(fakeAiResult);
      renderWithContext(<ResumeAiProfileCard resumeId="res-secret" extractionStatus="COMPLETED" />);

      await waitFor(() => {
        expect(screen.getByTestId('resume-ai-profile-card')).toBeInTheDocument();
      });

      // Verify localStorage is completely clean
      expect(localStorage.getItem('gemini_api_key')).toBeNull();
      expect(localStorage.getItem('ai_profile')).toBeNull();
      expect(localStorage.getItem('ai_comparison')).toBeNull();
      expect(localStorage.getItem('ai_recommendations')).toBeNull();
      expect(localStorage.length).toBe(0);

      // Verify sessionStorage is completely clean
      expect(sessionStorage.getItem('gemini_api_key')).toBeNull();
      expect(sessionStorage.length).toBe(0);

      // Verify no sensitive keys exist anywhere in window
      expect(window.GEMINI_API_KEY).toBeUndefined();
      expect(window.VITE_GEMINI_API_KEY).toBeUndefined();
    });
  });
});
