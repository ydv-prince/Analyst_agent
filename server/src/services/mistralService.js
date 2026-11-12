const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-large-latest';
const MAX_TOKENS = 4096;

export const SYSTEM_PROMPT = `You are a data analyst AI assistant. Your role is to:
1. Load and explore datasets from files or URLs
2. Perform statistical analysis and data cleaning
3. Create visualizations using matplotlib/plotly
4. Answer questions about data with clear explanations
5. Provide actionable insights with proper caveats`;

/**
 * Sends conversation history to Mistral AI chat completions API.
 * Uses MISTRAL_API_KEY from environment variables only.
 * 
 * @param {Array<{ role: string, content: string }>} history - Array of previous and current messages
 * @param {Object} [options] - Optional overrides (e.g. custom model)
 * @returns {Promise<{ content: string, raw: Object }>} Assistant message content and metadata
 */
export async function sendChatCompletion(history, options = {}) {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    const error = new Error('Mistral API key is not configured on the server. Please set MISTRAL_API_KEY in server/.env');
    error.status = 500;
    error.code = 'CONFIG_MISSING_API_KEY';
    throw error;
  }

  const model = options.model || DEFAULT_MODEL;

  // Filter conversation history: only valid user and assistant messages are sent.
  // Never convert stored system messages to assistant, and never trust client-supplied system messages.
  const validHistory = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({
      role: m.role,
      content: m.content
    }));

  // Prepend backend's trusted system prompt
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...validHistory
  ];

  const payload = {
    model,
    messages: formattedMessages,
    max_tokens: MAX_TOKENS
  };

  let response;
  try {
    response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000) // 60s timeout
    });
  } catch (networkError) {
    const error = new Error(`Network error while communicating with Mistral AI: ${networkError.message}`);
    error.status = 502;
    error.code = 'MISTRAL_NETWORK_ERROR';
    throw error;
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorBody = await response.json();
      errorDetail = errorBody.message || errorBody.error?.message || response.statusText;
    } catch {
      // response body was not JSON
    }

    const error = new Error(`Mistral API Error (${response.status}): ${errorDetail}`);
    error.status = response.status === 401 ? 502 : response.status === 429 ? 429 : 502;
    error.code = response.status === 401 ? 'MISTRAL_AUTH_FAILED' : response.status === 429 ? 'MISTRAL_RATE_LIMIT' : 'MISTRAL_UPSTREAM_ERROR';
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
    const error = new Error('Invalid response structure received from Mistral AI');
    error.status = 502;
    error.code = 'MISTRAL_INVALID_RESPONSE';
    throw error;
  }

  return {
    content: data.choices[0].message.content,
    raw: data
  };
}

export default {
  sendChatCompletion,
  SYSTEM_PROMPT,
  DEFAULT_MODEL
};

