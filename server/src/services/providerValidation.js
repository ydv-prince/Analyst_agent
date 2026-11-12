const VALIDATION_TIMEOUT_MS = 6000;

/**
 * Sanitizes an error message by stripping potential key fragments, headers, or connection strings.
 */
function sanitizeMessage(msg, rawKey) {
  if (!msg || typeof msg !== 'string') return 'Unknown upstream error';
  let clean = msg;
  if (rawKey && rawKey.length > 5) {
    clean = clean.replaceAll(rawKey, '[REDACTED_API_KEY]');
  }
  return clean.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
}

/**
 * Validates a Mistral API key against the official models metadata endpoint.
 * Zero-cost metadata query (does not consume prompt/completion tokens).
 */
async function validateMistral(apiKey) {
  try {
    const res = await fetch('https://api.mistral.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS)
    });

    if (res.status === 200) {
      const data = await res.json().catch(() => ({}));
      return {
        valid: true,
        status: 'verified',
        code: 'VALID',
        message: 'Mistral API key verified successfully.',
        modelCount: Array.isArray(data?.data) ? data.data.length : undefined
      };
    }

    if (res.status === 401) {
      return {
        valid: false,
        status: 'invalid',
        code: 'INVALID_KEY',
        message: 'Invalid Mistral API key. Please check your credentials.'
      };
    }

    if (res.status === 403) {
      return {
        valid: false,
        status: 'invalid',
        code: 'PERMISSION_DENIED',
        message: 'Access forbidden. Key lacks permissions or account is restricted.'
      };
    }

    if (res.status === 429) {
      return {
        valid: true, // Key is valid, but rate limited
        status: 'rate_limited',
        code: 'RATE_LIMITED',
        message: 'Mistral rate limit exceeded. Key is valid but currently throttled.'
      };
    }

    return {
      valid: false,
      status: 'unverified',
      code: 'SERVICE_UNAVAILABLE',
      message: `Mistral API responded with status ${res.status}.`
    };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        valid: false,
        status: 'unverified',
        code: 'TIMEOUT',
        message: 'Connection timed out while contacting Mistral API.'
      };
    }
    return {
      valid: false,
      status: 'unverified',
      code: 'NETWORK_ERROR',
      message: sanitizeMessage(err.message, apiKey)
    };
  }
}

/**
 * Validates a Google Gemini API key against Google Generative Language models endpoint.
 * Zero-cost metadata query.
 */
async function validateGemini(apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS)
    });

    if (res.status === 200) {
      const data = await res.json().catch(() => ({}));
      return {
        valid: true,
        status: 'verified',
        code: 'VALID',
        message: 'Google Gemini API key verified successfully.',
        modelCount: Array.isArray(data?.models) ? data.models.length : undefined
      };
    }

    if (res.status === 400 || res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      const reason = errData?.error?.message || 'Invalid API key';
      return {
        valid: false,
        status: 'invalid',
        code: 'INVALID_KEY',
        message: sanitizeMessage(`Google Gemini verification failed: ${reason}`, apiKey)
      };
    }

    if (res.status === 429) {
      return {
        valid: true,
        status: 'rate_limited',
        code: 'RATE_LIMITED',
        message: 'Google Gemini quota or rate limit exceeded.'
      };
    }

    return {
      valid: false,
      status: 'unverified',
      code: 'SERVICE_UNAVAILABLE',
      message: `Google Gemini API responded with status ${res.status}.`
    };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        valid: false,
        status: 'unverified',
        code: 'TIMEOUT',
        message: 'Connection timed out while contacting Google Gemini API.'
      };
    }
    return {
      valid: false,
      status: 'unverified',
      code: 'NETWORK_ERROR',
      message: sanitizeMessage(err.message, apiKey)
    };
  }
}

/**
 * Validates an OpenAI API key against the official models metadata endpoint.
 * Zero-cost metadata query (does not consume inference tokens).
 */
async function validateOpenAI(apiKey) {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS)
    });

    if (res.status === 200) {
      const data = await res.json().catch(() => ({}));
      return {
        valid: true,
        status: 'verified',
        code: 'VALID',
        message: 'OpenAI API key verified successfully.',
        modelCount: Array.isArray(data?.data) ? data.data.length : undefined
      };
    }

    if (res.status === 401) {
      return {
        valid: false,
        status: 'invalid',
        code: 'INVALID_KEY',
        message: 'Invalid OpenAI API key. Please check your credentials.'
      };
    }

    if (res.status === 429) {
      return {
        valid: true,
        status: 'rate_limited',
        code: 'RATE_LIMITED',
        message: 'OpenAI rate limit or usage quota exceeded. Key is valid.'
      };
    }

    return {
      valid: false,
      status: 'unverified',
      code: 'SERVICE_UNAVAILABLE',
      message: `OpenAI API responded with status ${res.status}.`
    };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        valid: false,
        status: 'unverified',
        code: 'TIMEOUT',
        message: 'Connection timed out while contacting OpenAI API.'
      };
    }
    return {
      valid: false,
      status: 'unverified',
      code: 'NETWORK_ERROR',
      message: sanitizeMessage(err.message, apiKey)
    };
  }
}

/**
 * Validates an Anthropic API key against the official models metadata endpoint.
 * Zero-cost metadata query (does not consume messages inference tokens).
 */
async function validateAnthropic(apiKey) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01'
      },
      signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS)
    });

    if (res.status === 200) {
      const data = await res.json().catch(() => ({}));
      return {
        valid: true,
        status: 'verified',
        code: 'VALID',
        message: 'Anthropic Claude API key verified successfully.',
        modelCount: Array.isArray(data?.data) ? data.data.length : undefined
      };
    }

    if (res.status === 401) {
      return {
        valid: false,
        status: 'invalid',
        code: 'INVALID_KEY',
        message: 'Invalid Anthropic API key. Authentication failed.'
      };
    }

    if (res.status === 403) {
      return {
        valid: false,
        status: 'invalid',
        code: 'PERMISSION_DENIED',
        message: 'Anthropic access forbidden. Key lacks permissions.'
      };
    }

    if (res.status === 429) {
      return {
        valid: true,
        status: 'rate_limited',
        code: 'RATE_LIMITED',
        message: 'Anthropic rate limit exceeded. Key is valid.'
      };
    }

    return {
      valid: false,
      status: 'unverified',
      code: 'SERVICE_UNAVAILABLE',
      message: `Anthropic API responded with status ${res.status}.`
    };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        valid: false,
        status: 'unverified',
        code: 'TIMEOUT',
        message: 'Connection timed out while contacting Anthropic API.'
      };
    }
    return {
      valid: false,
      status: 'unverified',
      code: 'NETWORK_ERROR',
      message: sanitizeMessage(err.message, apiKey)
    };
  }
}

/**
 * Universal dispatcher to validate an API key for any supported provider.
 */
export async function validateProviderKey(provider, apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
    return {
      valid: false,
      status: 'invalid',
      code: 'MALFORMED_KEY',
      message: 'API key is too short or malformed.'
    };
  }

  const normalizedProvider = (provider || '').toLowerCase().trim();

  let result;
  switch (normalizedProvider) {
    case 'mistral':
      result = await validateMistral(apiKey);
      break;
    case 'gemini':
      result = await validateGemini(apiKey);
      break;
    case 'openai':
      result = await validateOpenAI(apiKey);
      break;
    case 'anthropic':
      result = await validateAnthropic(apiKey);
      break;
    default:
      return {
        valid: false,
        status: 'invalid',
        code: 'UNSUPPORTED_PROVIDER',
        message: `Provider '${provider}' is not supported. Supported: mistral, gemini, openai, anthropic.`
      };
  }

  return {
    ...result,
    testedAt: new Date()
  };
}

export default validateProviderKey;
