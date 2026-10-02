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

  return (
    <div data-testid="analysis-detail-page" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/analyses"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            textDecoration: 'none',
          }}
          data-testid="back-to-analyses-link"
        >
          <Icon name="arrow-left" size={14} />
          <span>Back to Analyses</span>
        </Link>
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
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
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
            borderRadius: 'var(--radius-lg)',
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
            <Button variant="secondary" onClick={fetchAnalysis} data-testid="analysis-retry-btn">
              Retry
            </Button>
            <Link to="/analyses" className="btn btn-primary">
              Return to Analyses
            </Link>
          </div>
        </div>
      )}

      {/* Full Analysis Content */}
      {!isLoadingAnalysis && !analysisError && analysis && (
        <>
          {/* Header Card */}
          <div className="card" data-testid="analysis-header-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1.25rem',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--accent-primary)',
                      display: 'inline-block',
                    }}
                    aria-hidden="true"
                  />
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Compatibility Report
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: 'var(--text-2xl)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    wordBreak: 'break-word',
                    margin: 0,
                  }}
                  data-testid="analysis-detail-title"
                >
                  {analysis.job_title}
                </h1>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginTop: '0.5rem',
                  }}
                  className="tabular-nums"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Icon name="file" size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>Resume:</span>{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {analysis.resume_file_name}
                    </strong>
                  </span>
                  <span>Evaluated {formatDate(analysis.created_at)}</span>
                  <span>Deterministic Engine v{analysis.scoring_version || '1.0'}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid="delete-analysis-page-btn"
                >
                  <Icon name="trash" size={14} />
                  <span>Delete Report</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 1. Overall Match Summary */}
          <AnalysisSummary analysis={analysis} />

          {/* 2. Itemized Skill Verifications */}
          <SkillMatchList skills={analysis.skills || []} />

          {/* 3. Resume Quality Diagnostics */}
          <ResumeQuality resumeQuality={recommendationsData?.resume_quality} />

          {/* 4. Actionable Recommendations */}
          <Recommendations
            recommendations={recommendationsData?.recommendations || []}
            disclaimer={recommendationsData?.disclaimer}
            selectedPriority={selectedPriority}
            onPriorityChange={setSelectedPriority}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            isLoading={isLoadingRecommendations}
            error={recommendationsError}
            onRetry={fetchRecommendations}
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
