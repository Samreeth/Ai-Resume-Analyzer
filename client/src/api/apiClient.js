/**
 * Centralized API Client
 * Uses native fetch with Bearer token injection, response normalization,
 * and automatic 401 token eviction.
 */

const TOKEN_KEY = 'ai_resume_analyzer_token';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Retrieve current token from localStorage.
 * Compatible with existing stateless Bearer JWT backend.
 *
 * @returns {string|null}
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Store token in localStorage.
 *
 * @param {string} token
 */
export const setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

/**
 * Remove token from localStorage.
 */
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Core HTTP Request Execution
 *
 * @param {string} endpoint - Path relative to base URL (e.g. '/auth/login')
 * @param {object} [options={}] - Fetch options
 * @returns {Promise<{ data: any, message: string, raw: object }>}
 */
export const request = async (endpoint, options = {}) => {
  const url = `${BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;
  const token = getToken();

  const headers = {
    ...options.headers,
  };

  // Attach Bearer token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Set JSON content-type if body is an object and not FormData
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body,
    });

    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const responseBody = isJson ? await response.json() : null;

    if (!response.ok) {
      // Automatic 401 token eviction
      if (response.status === 401) {
        clearToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
      }

      const errorCode =
        responseBody?.error?.code ||
        responseBody?.code ||
        `HTTP_${response.status}`;

      const errorMessage =
        responseBody?.error?.message ||
        responseBody?.message ||
        response.statusText ||
        'Request failed';

      const error = new Error(errorMessage);
      error.status = response.status;
      error.code = errorCode;
      error.details = responseBody?.error?.details || responseBody?.details || null;
      throw error;
    }

    // Response Normalization:
    // Some controllers return `{ success: true, data, message }`
    // Processing controller returns `{ status: 'success', data, message }`
    const normalizedData = responseBody?.data !== undefined ? responseBody.data : responseBody;
    const message = responseBody?.message || 'Operation successful';

    return {
      data: normalizedData,
      message,
      raw: responseBody,
    };
  } catch (err) {
    // Rethrow normalized error or network failure
    if (err.status) {
      throw err;
    }
    const networkError = new Error('Network error. Unable to reach server.');
    networkError.status = 0;
    networkError.code = 'NETWORK_ERROR';
    throw networkError;
  }
};

export const apiClient = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options) => request(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
  upload: (endpoint, formData, options) => request(endpoint, { ...options, method: 'POST', body: formData }),
};

export default apiClient;
