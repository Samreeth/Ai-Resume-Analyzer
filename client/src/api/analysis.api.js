import apiClient from './apiClient.js';

export const analysisApi = {
  /**
   * Run compatibility match between a completed resume and a job description
   * POST /api/analyses
   *
   * @param {object} payload
   * @param {string} payload.resumeId
   * @param {string} payload.jobId
   * @returns {Promise<{ analysis: { analysis_id, resume_id, job_id, resume_file_name, job_title, overall_score, skill_score, summary, skills, created_at } }>}
   */
  createAnalysis: async ({ resumeId, jobId }) => {
    const res = await apiClient.post('/analyses', { resumeId, jobId });
    return res.data;
  },

  /**
   * List paginated historical analyses for authenticated user
   * GET /api/analyses?page=1&limit=10
   *
   * @param {object} [params={}]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ analyses: Array, pagination: { total, page, limit, totalPages } }>}
   */
  listAnalyses: async ({ page = 1, limit = 10 } = {}) => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await apiClient.get(`/analyses?${query.toString()}`);
    return res.data;
  },

  /**
   * Get detailed analysis report including itemized skill matches
   * GET /api/analyses/:analysisId
   *
   * @param {string} analysisId
   * @returns {Promise<{ analysis: { analysis_id, resume_id, job_id, resume_file_name, job_title, overall_score, skill_score, summary, skills, created_at } }>}
   */
  getAnalysisById: async (analysisId) => {
    const res = await apiClient.get(`/analyses/${analysisId}`);
    return res.data;
  },

  /**
   * Get skill gap analysis, resume quality diagnostics, and actionable recommendations
   * GET /api/analyses/:analysisId/recommendations?priority=...&category=...
   *
   * @param {string} analysisId
   * @param {object} [filters={}]
   * @param {'HIGH'|'MEDIUM'|'LOW'} [filters.priority]
   * @param {'SKILL_GAP'|'RESUME_QUALITY'|'IMPACT_METRICS'|'FORMATTING'} [filters.category]
   * @returns {Promise<{ analysis_id, overall_score, skill_gap_analysis, resume_quality, recommendations, disclaimer }>}
   */
  getRecommendations: async (analysisId, { priority, category } = {}) => {
    const params = new URLSearchParams();
    if (priority) params.append('priority', priority);
    if (category) params.append('category', category);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get(`/analyses/${analysisId}/recommendations${queryString}`);
    return res.data;
  },

  /**
   * Delete an analysis record
   * DELETE /api/analyses/:analysisId
   *
   * @param {string} analysisId
   * @returns {Promise<{}>}
   */
  deleteAnalysis: async (analysisId) => {
    const res = await apiClient.delete(`/analyses/${analysisId}`);
    return res.data;
  },
};

export default analysisApi;
