const API_BASE = '/api';

/**
 * HTTP API client for communicating with the Node.js/Express backend.
 * Uses native fetch and handles structured error envelopes.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (networkError) {
    throw new Error(`Network failure connecting to backend: ${networkError.message}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage = data?.error?.message || response.statusText || 'Unknown server error';
    const error = new Error(errorMessage);
    error.status = response.status;
    error.code = data?.error?.code || 'API_ERROR';
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  /**
   * Health status check
   */
  getHealth: () => request('/health'),

  /**
   * Create a new analysis session
   */
  createSession: (data = {}) =>
    request('/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  /**
   * Retrieve a session and its chronological message history
   */
  getSession: (id) => request(`/sessions/${id}`),

  /**
   * Clear message history for a specific session
   */
  clearSessionMessages: (id) =>
    request(`/sessions/${id}/messages`, {
      method: 'DELETE'
    }),

  /**
   * Send a user message and receive the assistant completion
   */
  sendChatMessage: (sessionId, content) =>
    request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ sessionId, content })
    })
};

export default api;

