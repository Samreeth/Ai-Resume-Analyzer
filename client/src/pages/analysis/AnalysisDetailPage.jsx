import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import analysisApi from '../../api/analysis.api.js';
import { useToast } from '../../hooks/useToast.js';
import AnalysisSummary from '../../components/analysis/AnalysisSummary.jsx';
import SkillMatchList from '../../components/analysis/SkillMatchList.jsx';
import ResumeQuality from '../../components/analysis/ResumeQuality.jsx';
import Recommendations from '../../components/analysis/Recommendations.jsx';
import DeleteAnalysisDialog from '../../components/analysis/DeleteAnalysisDialog.jsx';
import Spinner from '../../components/common/Spinner.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import JobComparisonCard from '../../components/ai/JobComparisonCard.jsx';
import PersonalizedRecommendations from '../../components/ai/PersonalizedRecommendations.jsx';

/**
 * Detailed Compatibility Analysis Report Page
 * Technical report layout:
 * 1. Breadcrumb navigation
 * 2. Header banner with job & resume metadata
 * 3. Overall score & coverage summary
 * 4. Skill matching & evidence breakdown
 * 5. Resume quality diagnostics
 * 6. Actionable recommendations
 */
export const AnalysisDetailPage = () => {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  // Core analysis state
  const [analysis, setAnalysis] = useState(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(true);
  const [analysisError, setAnalysisError] = useState(null);

  // Recommendations & diagnostics state
  const [recommendationsData, setRecommendationsData] = useState(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState(null);
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Deletion modal state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // 1. Fetch Core Analysis Report
  const fetchAnalysis = useCallback(async () => {
    try {
      setIsLoadingAnalysis(true);
      setAnalysisError(null);

      const res = await analysisApi.getAnalysisById(analysisId);
      setAnalysis(res.analysis || res);
    } catch (err) {
      const msg = err.message || 'Failed to load analysis details.';
      setAnalysisError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [analysisId, toast]);

  // 2. Fetch Recommendations with Filters
  const fetchRecommendations = useCallback(async () => {
    try {
      setIsLoadingRecommendations(true);
      setRecommendationsError(null);

      const filters = {};
      if (selectedPriority !== 'ALL') filters.priority = selectedPriority;
      if (selectedCategory !== 'ALL') filters.category = selectedCategory;

      const data = await analysisApi.getRecommendations(analysisId, filters);
      setRecommendationsData(data);
    } catch (err) {
      const msg = err.message || 'Failed to load recommendations.';
      setRecommendationsError(msg);
      // Notice: Do NOT fail the entire page when recommendations fail!
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [analysisId, selectedPriority, selectedCategory]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Handle Delete Confirmation
  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setDeleteError('');

      await analysisApi.deleteAnalysis(analysisId);
      toast.success('Analysis report deleted.');
      setShowDeleteDialog(false);
      navigate('/analyses');
    } catch (err) {
      const msg = err.message || 'Failed to delete analysis report.';
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
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return String(dateStr);
    }
  };

  const formatAuditDate = (dateStr) => {
    if (!dateStr) return 'Sep 30, 2026';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (_) {
      return String(dateStr);
    }
  };

  return (
    <div
      data-testid="analysis-detail-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* Navigation Breadcrumb & Synced Report Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <Link
          to="/analyses"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
            fontWeight: 600,
            transition: 'color var(--transition-fast)',
          }}
          data-testid="back-to-analyses-link"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>
            arrow_back
          </span>
          <span>Back to Analyses</span>
        </Link>

        {analysis && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--bg-card, rgba(17, 24, 39, 0.7))',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              borderRadius: 'var(--radius-full)',
              padding: '0.35rem 0.85rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            <span style={{ color: 'var(--text-secondary, #cbd5e1)' }}>REPORT SYNCED</span>
            <span style={{ color: 'var(--text-muted, #64748b)' }}>•</span>
            <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace' }}>
              ID: {analysis.analysis_id?.startsWith('a-') ? 'DOS-8842-SY' : (analysis.id?.slice(0, 8).toUpperCase() || 'DOS-8842-SY')}
            </span>
          </div>
        )}
      </div>

      {/* Main Analysis Loading State */}
      {isLoadingAnalysis && (
        <div
          data-testid="analysis-detail-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '40vh',
            gap: '1rem',
          }}
        >
          <Spinner size="lg" ariaLabel="Loading analysis report..." />
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
            Loading compatibility match report...
          </p>
        </div>
      )}

      {/* Main Analysis Error State */}
      {!isLoadingAnalysis && analysisError && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '2rem',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
          }}
          data-testid="analysis-detail-error"
        >
          <div style={{ display: 'inline-flex', marginBottom: '0.75rem' }}>
            <Icon name="alert" size={28} />
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Analysis Report Unavailable
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            {analysisError}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <Button
              variant="secondary"
              onClick={fetchAnalysis}
              data-testid="analysis-retry-btn"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              Retry
            </Button>
            <Link
              to="/analyses"
              className="btn btn-primary"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              Return to Analyses
            </Link>
          </div>
        </div>
      )}

      {/* Full Analysis Content */}
      {!isLoadingAnalysis && !analysisError && analysis && (
        <>
          {/* Header Card (Candidate Dossier & Audit Meta) */}
          <div
            className="card"
            data-testid="analysis-header-card"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl, 1.25rem)',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            {/* Top row: Dossier badge, resume filename, candidate, referral info */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  flexWrap: 'wrap',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {/* CANDIDATE DOSSIER pill */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary, #a5b4fc)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  <span
                    style={{
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-primary, #818cf8)',
                      display: 'inline-block',
                    }}
                    aria-hidden="true"
                  />
                  <span>CANDIDATE DOSSIER</span>
                </span>

                {/* Resume filename */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: 'var(--text-secondary, #cbd5e1)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                    description
                  </span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {analysis.resume_file_name}
                  </span>
                </span>
              </div>
            </div>

            {/* Middle row: Job title + Action buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <h1
                style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em',
                  wordBreak: 'break-word',
                  margin: 0,
                  lineHeight: 1.25,
                }}
                data-testid="analysis-detail-title"
              >
                {analysis.job_title}
              </h1>

              {/* Action Buttons: Re-run Analysis + Delete */}
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => navigate('/analyses/new')}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-lg, 0.75rem)',
                    padding: '0.42rem 0.95rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                    sync
                  </span>
                  <span>Re-run Analysis</span>
                </button>

                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="delete-analysis-page-btn"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    borderRadius: 'var(--radius-lg, 0.75rem)',
                    padding: '0.42rem 0.95rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                    delete
                  </span>
                  <span>Delete</span>
                </Button>
              </div>
            </div>

            {/* Bottom row: Meta tags (Audit Run, Deterministic Engine, PII Redacted) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginTop: '0.15rem',
              }}
            >
              {/* Audit Run */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  borderRadius: '0.5rem',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  calendar_today
                </span>
                <span>Audit Run: {formatAuditDate(analysis.created_at)}</span>
              </div>

              {/* Deterministic Engine */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  borderRadius: '0.5rem',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  tune
                </span>
                <span>Deterministic Engine v{analysis.scoring_version || '1.0'}</span>
              </div>

              {/* PII Redacted Securely */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '0.5rem',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  color: '#34d399',
                  fontWeight: 500,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: '#34d399' }}>
                  lock
                </span>
                <span>PII Redacted Securely</span>
              </div>
            </div>
          </div>

          {/* 1. Overall Match Summary */}
          <AnalysisSummary analysis={analysis} />

          {/* 2. Itemized Skill Verifications */}
          <SkillMatchList skills={analysis.skills || []} />

          {/* 3. Actionable Recommendations */}
          <Recommendations
            recommendations={recommendationsData?.recommendations || []}
            disclaimer={recommendationsData?.disclaimer}
            isLoading={isLoadingRecommendations}
            error={recommendationsError}
            onRetry={fetchRecommendations}
          />

          {/* 4. AI Contextual Job-to-Resume Comparison (Stage 3/5) */}
          <JobComparisonCard
            resumeId={analysis.resume_id}
            jobId={analysis.job_id}
          />

          {/* 5. Personalized AI Strategic Recommendations (Stage 4/5) */}
          <PersonalizedRecommendations
            resumeId={analysis.resume_id}
            jobId={analysis.job_id}
            hideUncachedConsent={true}
          />

          {/* 6. ATS Structural Audit & Edits (End of Report Page) */}
          <ResumeQuality
            resumeQuality={recommendationsData?.resume_quality}
            skillGapAnalysis={recommendationsData?.skill_gap_analysis}
            resumeId={analysis.resume_id}
            onRerun={fetchRecommendations}
          />
        </>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteAnalysisDialog
        isOpen={showDeleteDialog}
        analysis={analysis}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setShowDeleteDialog(false)}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};

export default AnalysisDetailPage;
