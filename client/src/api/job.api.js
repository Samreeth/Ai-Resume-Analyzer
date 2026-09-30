import apiClient from './apiClient.js';

export const jobApi = {
  /**
   * Create a new job description with automatic skill extraction
   * POST /api/jobs
   *
   * @param {object} payload
   * @param {string} payload.title - Min 3, max 255 chars
   * @param {string} payload.description - Min 20, max 50,000 chars
   * @returns {Promise<{ job: { job_id, title, description, extracted_data, created_at, updated_at } }>}
   */
  createJob: async ({ title, description }) => {
    const res = await apiClient.post('/jobs', { title, description });
    return res.data;
  },

  /**
   * List paginated job descriptions owned by the authenticated user
   * GET /api/jobs?page=1&limit=10
   *
   * @param {object} [params={}]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ jobs: Array, pagination: { total, page, limit, totalPages } }>}
   */
  listJobs: async ({ page = 1, limit = 10 } = {}) => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await apiClient.get(`/jobs?${query.toString()}`);
    return res.data;
  },

  /**
   * Get job description details by ID
   * GET /api/jobs/:jobId
   *
   * @param {string} jobId
   * @returns {Promise<{ job: { job_id, title, description, extracted_data, created_at, updated_at } }>}
   */
  getJobById: async (jobId) => {
    const res = await apiClient.get(`/jobs/${jobId}`);
    return res.data;
  },

  /**
   * Update a job description (partial update under PUT)
   * PUT /api/jobs/:jobId
   *
   * @param {string} jobId
   * @param {object} payload
   * @param {string} [payload.title]
   * @param {string} [payload.description]
   * @returns {Promise<{ job: { job_id, title, description, extracted_data, created_at, updated_at } }>}
   */
  updateJob: async (jobId, { title, description }) => {
    const res = await apiClient.put(`/jobs/${jobId}`, { title, description });
    return res.data;
  },

  /**
   * Delete a job description record
   * DELETE /api/jobs/:jobId
   *
   * @param {string} jobId
   * @returns {Promise<{}>}
   */
  deleteJob: async (jobId) => {
    const res = await apiClient.delete(`/jobs/${jobId}`);
    return res.data;
  },

  /**
   * Force skill re-extraction on an existing job description
   * POST /api/jobs/:jobId/extract
   *
   * @param {string} jobId
   * @returns {Promise<{ job: { job_id, title, description, extracted_data, created_at, updated_at } }>}
   */
  extractJobSkills: async (jobId) => {
    const res = await apiClient.post(`/jobs/${jobId}/extract`);
    return res.data;
  },

  /**
   * Alias for extractJobSkills
   * POST /api/jobs/:jobId/extract
   */
  extractJob: async (jobId) => {
    const res = await apiClient.post(`/jobs/${jobId}/extract`);
    return res.data;
  },
};

export default jobApi;
