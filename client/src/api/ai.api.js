import apiClient from './apiClient.js';

/**
 * Client API wrapper for backend AI capabilities.
 * Strictly enforces explicit user consent before dispatching any POST generation request.
 */
export const aiApi = {
  /**
   * Retrieve cached AI resume understanding profile.
   * GET /api/resumes/:resumeId/ai-profile
   *
   * @param {string} resumeId
   * @returns {Promise<object>}
   */
  getResumeAiProfile: async (resumeId) => {
    const res = await apiClient.get(`/resumes/${resumeId}/ai-profile`);
    return res.data;
  },

  /**
   * Generate an AI resume profile or retrieve valid cached profile.
   * POST /api/resumes/:resumeId/ai-profile
   *
   * @param {string} resumeId
   * @param {object} params
   * @param {boolean} params.consent - Must be explicitly true
   * @param {boolean} [params.forceRefresh=false]
   * @returns {Promise<object>}
   */
  generateResumeAiProfile: async (resumeId, { consent, forceRefresh = false } = {}) => {
    if (consent !== true) {
      const err = new Error('Explicit consent is required to process resume data with Gemini AI.');
      err.code = 'AI_CONSENT_REQUIRED';
      err.status = 400;
      throw err;
    }

    const res = await apiClient.post(`/resumes/${resumeId}/ai-profile`, {
      consent,
      force_refresh: forceRefresh,
    });
    return res.data;
  },

  /**
   * Retrieve cached AI contextual job-to-resume comparison.
   * GET /api/resumes/:resumeId/ai-job-comparison?jobId=<UUID>
   *
   * @param {string} resumeId
   * @param {string} jobId
   * @returns {Promise<object>}
   */
  getJobComparison: async (resumeId, jobId) => {
    const res = await apiClient.get(`/resumes/${resumeId}/ai-job-comparison?jobId=${jobId}`);
    return res.data;
  },

  /**
   * Generate an AI job-to-resume comparison or retrieve valid cached comparison.
   * POST /api/resumes/:resumeId/ai-job-comparison
   *
   * @param {string} resumeId
   * @param {object} params
   * @param {string} params.jobId
   * @param {boolean} params.consent - Must be explicitly true
   * @param {boolean} [params.forceRefresh=false]
   * @returns {Promise<object>}
   */
  generateJobComparison: async (resumeId, { jobId, consent, forceRefresh = false } = {}) => {
    if (consent !== true) {
      const err = new Error('Explicit consent is required to process resume and job text with Gemini AI.');
      err.code = 'AI_CONSENT_REQUIRED';
      err.status = 400;
      throw err;
    }

    const res = await apiClient.post(`/resumes/${resumeId}/ai-job-comparison`, {
      jobId,
      consent,
      force_refresh: forceRefresh,
    });
    return res.data;
  },

  /**
   * Retrieve cached personalized AI recommendations.
   * GET /api/resumes/:resumeId/ai-recommendations?jobId=<UUID>
   *
   * @param {string} resumeId
   * @param {string} jobId
   * @returns {Promise<object>}
   */
  getAiRecommendations: async (resumeId, jobId) => {
    const res = await apiClient.get(`/resumes/${resumeId}/ai-recommendations?jobId=${jobId}`);
    return res.data;
  },

  /**
   * Generate personalized AI recommendations or retrieve valid cached recommendations.
   * POST /api/resumes/:resumeId/ai-recommendations
   *
   * @param {string} resumeId
   * @param {object} params
   * @param {string} params.jobId
   * @param {boolean} params.consent - Must be explicitly true
   * @param {boolean} [params.forceRefresh=false]
   * @returns {Promise<object>}
   */
  generateAiRecommendations: async (resumeId, { jobId, consent, forceRefresh = false } = {}) => {
    if (consent !== true) {
      const err = new Error('Explicit consent is required to process resume and job text with Gemini AI.');
      err.code = 'AI_CONSENT_REQUIRED';
      err.status = 400;
      throw err;
    }

    const res = await apiClient.post(`/resumes/${resumeId}/ai-recommendations`, {
      jobId,
      consent,
      force_refresh: forceRefresh,
    });
    return res.data;
  },
};

export default aiApi;
