import apiClient from './apiClient.js';

export const resumeApi = {
  /**
   * Upload and stage a resume file (PDF or DOCX, max 5 MB)
   * POST /api/resumes
   *
   * @param {File} file
   * @returns {Promise<{ resume: { resume_id, file_name, file_size, mime_type, file_hash, extraction_status, uploaded_at, updated_at } }>}
   */
  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append('resume', file);
    const res = await apiClient.upload('/resumes', formData);
    return res.data;
  },

  /**
   * List paginated resumes owned by the authenticated user
   * GET /api/resumes?page=1&limit=10
   *
   * @param {object} [params={}]
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   * @returns {Promise<{ resumes: Array, pagination: { total, page, limit, totalPages } }>}
   */
  listResumes: async ({ page = 1, limit = 10 } = {}) => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await apiClient.get(`/resumes?${query.toString()}`);
    return res.data;
  },

  /**
   * Get resume details by ID
   * GET /api/resumes/:resumeId
   *
   * @param {string} resumeId
   * @returns {Promise<{ resume: { resume_id, file_name, file_size, mime_type, file_hash, extraction_status, extracted_data, uploaded_at, updated_at } }>}
   */
  getResumeById: async (resumeId) => {
    const res = await apiClient.get(`/resumes/${resumeId}`);
    return res.data;
  },

  /**
   * Trigger in-process text extraction and skill matching for a resume
   * POST /api/resumes/:resumeId/process
   *
   * @param {string} resumeId
   * @param {object} [options={}]
   * @returns {Promise<{ resumeId, extractionStatus, extractedText, characterCount, wordCount, processingAttempts, processingCompletedAt }>}
   */
  processResume: async (resumeId, options = {}) => {
    const res = await apiClient.post(`/resumes/${resumeId}/process`, { options });
    return res.data;
  },

  /**
   * Poll processing lifecycle status for a resume
   * GET /api/resumes/:resumeId/status
   *
   * @param {string} resumeId
   * @returns {Promise<{ resumeId, extractionStatus, processingAttempts, processingStartedAt, processingCompletedAt, processingErrorCode, processingErrorMessage, hasExtractedText, canRetry }>}
   */
  getResumeStatus: async (resumeId) => {
    const res = await apiClient.get(`/resumes/${resumeId}/status`);
    return res.data;
  },

  /**
   * Delete a resume record and unlinks file vault asset
   * DELETE /api/resumes/:resumeId
   *
   * @param {string} resumeId
   * @returns {Promise<{}>}
   */
  deleteResume: async (resumeId) => {
    const res = await apiClient.delete(`/resumes/${resumeId}`);
    return res.data;
  },
};

export default resumeApi;
