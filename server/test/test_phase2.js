import mongoose from 'mongoose';
import Session from '../src/models/Session.js';
import Message from '../src/models/Message.js';
import mistralService, { SYSTEM_PROMPT } from '../src/services/mistralService.js';
import errorHandler from '../src/middleware/errorHandler.js';
import { requireDatabase } from '../src/middleware/dbCheck.js';
import { handleChatCompletion } from '../src/controllers/chatController.js';
import { getSessionById, clearSessionMessages } from '../src/controllers/sessionController.js';
import app from '../src/server.js';

let passed = 0;
let failed = 0;
const results = [];

function recordTest(name, success, details) {
  if (success) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name} - ${details}`);
  }
  results.push({ name, success, details });
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('PHASE 2 BACKEND TEST SUITE');
  console.log('='.repeat(70));

  // Capture initial environment state
  const initialEnvKey = process.env.MISTRAL_API_KEY;
  const restoreEnvKey = () => {
    if (initialEnvKey === undefined) {
      delete process.env.MISTRAL_API_KEY;
    } else {
      process.env.MISTRAL_API_KEY = initialEnvKey;
    }
  };
  try {
    const isConnected = mongoose.connection.readyState === 1;
    // Test requireDatabase middleware when DB is disconnected
    let middlewareStatus = null;
    let middlewareBody = null;
    const mockReq = {};
    const mockRes = {
      status: (code) => {
        middlewareStatus = code;
        return {
          json: (data) => { middlewareBody = data; }
        };
      }
    };
    let nextCalled = false;
    requireDatabase(mockReq, mockRes, () => { nextCalled = true; });

    if (isConnected) {
      recordTest('1. MongoDB Connection Handling', nextCalled === true, 'Database is connected and middleware allowed request');
    } else {
      recordTest(
        '1. MongoDB Connection Handling (Graceful 503)',
        middlewareStatus === 503 && middlewareBody?.error?.code === 'DATABASE_UNAVAILABLE',
        `Middleware returned 503 DATABASE_UNAVAILABLE as expected when DB is offline`
      );
    }
  } catch (err) {
    recordTest('1. MongoDB Connection Handling', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 2: Session Model Defaults & Schema Validation
  // -------------------------------------------------------------
  try {
    const dummySession = new Session({});
    const validationError = dummySession.validateSync();
    const json = dummySession.toJSON();

    const ok = !validationError &&
      dummySession.agentName === 'Data analyst' &&
      dummySession.model === 'mistral-large-latest' &&
      dummySession.createdAt instanceof Date &&
      Boolean(json.id);

    recordTest(
      '2. Session Creation & Defaults Validation',
      ok,
      `agentName=${dummySession.agentName}, model=${dummySession.model}, id=${json.id}`
    );
  } catch (err) {
    recordTest('2. Session Creation & Defaults Validation', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 3: Message Model Schema Validation
  // -------------------------------------------------------------
  try {
    const validSessionId = new mongoose.Types.ObjectId();
    const validMsg = new Message({
      sessionId: validSessionId,
      content: 'Analyze this sample',
      role: 'user'
    });
    const err = validMsg.validateSync();
    const json = validMsg.toJSON();

    const ok = !err &&
      json.role === 'user' &&
      json.content === 'Analyze this sample' &&
      json.isError === false &&
      Array.isArray(json.attachments);

    recordTest('3. Message Model Schema & Default Values', ok, `role=${json.role}, isError=${json.isError}`);
  } catch (err) {
    recordTest('3. Message Model Schema & Default Values', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 4: Message Role Validation (Must Reject Invalid Roles)
  // -------------------------------------------------------------
  try {
    const invalidMsg = new Message({
      sessionId: new mongoose.Types.ObjectId(),
      content: 'Test',
      role: 'superadmin' // Invalid role
    });
    const err = invalidMsg.validateSync();
    const rejected = Boolean(err && err.errors && err.errors.role);
    recordTest('4. Message Role Enum Enforcement (Rejects Unauthorized Roles)', rejected, 'Correctly rejected role "superadmin"');
  } catch (err) {
    recordTest('4. Message Role Enum Enforcement', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 5: Invalid Request Validation (Chat Controller)
  // -------------------------------------------------------------
  try {
    let statusCode = null;
    let jsonBody = null;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { jsonBody = body; }
        };
      }
    };

    // Subtest A: Missing sessionId
    await handleChatCompletion({ body: { content: 'Hello' } }, mockRes, () => {});
    const missingSessionOk = statusCode === 400 && jsonBody?.error?.code === 'INVALID_SESSION_ID';

    // Subtest B: Empty content
    statusCode = null;
    jsonBody = null;
    await handleChatCompletion({ body: { sessionId: new mongoose.Types.ObjectId().toString(), content: '   ' } }, mockRes, () => {});
    const emptyContentOk = statusCode === 400 && jsonBody?.error?.code === 'INVALID_MESSAGE_CONTENT';

    recordTest('5. Chat Controller Payload Validation', missingSessionOk && emptyContentOk, 'Rejected empty content and invalid sessionId');
  } catch (err) {
    recordTest('5. Chat Controller Payload Validation', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 6: Invalid Session ID Validation (Session Controller)
  // -------------------------------------------------------------
  try {
    let statusCode = null;
    let jsonBody = null;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return { json: (body) => { jsonBody = body; } };
      }
    };

    await getSessionById({ params: { id: 'invalid-id-format' } }, mockRes, () => {});
    const getOk = statusCode === 400 && jsonBody?.error?.code === 'INVALID_SESSION_ID';

    statusCode = null;
    jsonBody = null;
    await clearSessionMessages({ params: { id: 'invalid-id-format' } }, mockRes, () => {});
    const deleteOk = statusCode === 400 && jsonBody?.error?.code === 'INVALID_SESSION_ID';

    recordTest('6. Session Controller ID Format Validation', getOk && deleteOk, '400 returned on invalid ObjectId strings');
  } catch (err) {
    recordTest('6. Session Controller ID Format Validation', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 7: Missing Mistral API Key Handling
  // -------------------------------------------------------------
  try {
    let caughtError = null;
    try {
      await mistralService.sendChatCompletion([{ role: 'user', content: 'Test' }]);
    } catch (e) {
      caughtError = e;
    } finally {
      restoreEnvKey();
    }

    const ok = caughtError && caughtError.code === 'CONFIG_MISSING_API_KEY' && caughtError.status === 500;
    recordTest('7. Missing Mistral API Key Handling', ok, caughtError ? caughtError.message : 'No error thrown');
  } catch (err) {
    recordTest('7. Missing Mistral API Key Handling', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 8: Mocked Mistral 401 Authentication Failure
  // -------------------------------------------------------------
  try {
    const originalFetch = global.fetch;
    process.env.MISTRAL_API_KEY = 'test_invalid_key';

    global.fetch = async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Invalid API key provided' })
    });

    let caughtError = null;
    try {
      await mistralService.sendChatCompletion([{ role: 'user', content: 'Test' }]);
    } catch (e) {
      caughtError = e;
    } finally {
      restoreEnvKey();
      global.fetch = originalFetch;
    }

    const ok = caughtError && caughtError.code === 'MISTRAL_AUTH_FAILED' && caughtError.status === 502;
    recordTest('8. Mistral Authentication Error Handling (Mocked 401)', ok, caughtError ? caughtError.message : 'Failed');
  } catch (err) {
    recordTest('8. Mistral Authentication Error Handling', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 9: Mocked Mistral 429 Rate Limiting
  // -------------------------------------------------------------
  try {
    const originalFetch = global.fetch;
    process.env.MISTRAL_API_KEY = 'test_key';

    global.fetch = async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ message: 'Usage limit reached' })
    });

    let caughtError = null;
    try {
      await mistralService.sendChatCompletion([{ role: 'user', content: 'Test' }]);
    } catch (e) {
      caughtError = e;
    } finally {
      restoreEnvKey();
      global.fetch = originalFetch;
    }

    const ok = caughtError && caughtError.code === 'MISTRAL_RATE_LIMIT' && caughtError.status === 429;
    recordTest('9. Mistral Rate Limit Handling (Mocked 429)', ok, caughtError ? caughtError.message : 'Failed');
  } catch (err) {
    recordTest('9. Mistral Rate Limit Handling', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 10: Successful Mistral Response & Extraction (Mocked)
  // -------------------------------------------------------------
  try {
    const originalFetch = global.fetch;
    process.env.MISTRAL_API_KEY = 'test_key';

    let capturedPayload = null;
    global.fetch = async (url, opts) => {
      capturedPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Data analysis result: Shape is (100, 5).'
              }
            }
          ]
        })
      };
    };

    let result = null;
    try {
      result = await mistralService.sendChatCompletion([
        { role: 'user', content: 'Inspect the dataset' }
      ]);
    } finally {
      restoreEnvKey();
      global.fetch = originalFetch;
    }

    const systemPromptPrepended = capturedPayload?.messages?.[0]?.role === 'system' &&
      capturedPayload?.messages?.[0]?.content === SYSTEM_PROMPT;
    const userPromptAppended = capturedPayload?.messages?.[1]?.role === 'user' &&
      capturedPayload?.messages?.[1]?.content === 'Inspect the dataset';
    const contentMatched = result?.content === 'Data analysis result: Shape is (100, 5).';

    const ok = systemPromptPrepended && userPromptAppended && contentMatched && capturedPayload?.max_tokens === 4096;
    recordTest('10. Successful Response Extraction & Payload Structure (Mocked)', ok, `max_tokens=${capturedPayload?.max_tokens}, content="${result?.content}"`);
  } catch (err) {
    recordTest('10. Successful Response Extraction', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 11: Live Mistral API Connectivity Status
  // -------------------------------------------------------------
  const liveKeySet = Boolean(process.env.MISTRAL_API_KEY && process.env.MISTRAL_API_KEY.trim() !== '');
  if (!liveKeySet) {
    console.log('[INFO] 11. Live Mistral API Call: SKIPPED (MISTRAL_API_KEY is not configured in server/.env)');
    results.push({
      name: '11. Live Mistral API Connectivity',
      success: true,
      details: 'SKIPPED: MISTRAL_API_KEY not populated in server/.env (unverified by design)'
    });
  } else {
    // Attempt live check only if user has provided an actual key
    try {
      const res = await mistralService.sendChatCompletion([{ role: 'user', content: 'Ping' }]);
      recordTest('11. Live Mistral API Connectivity', Boolean(res?.content), `Live response received: ${res.content.slice(0, 50)}...`);
    } catch (err) {
      recordTest('11. Live Mistral API Connectivity', false, `Live call failed: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // Test 12: Error Handler Credential Sanitization
  // -------------------------------------------------------------
  try {
    let sanitizedOutput = null;
    const mockErrorRes = {
      status: () => ({
        json: (data) => { sanitizedOutput = data; }
      })
    };
    const leakError = new Error('Failed to query with Bearer super_secret_mistral_api_key_12345');
    errorHandler(leakError, {}, mockErrorRes, () => {});

    const redacted = !sanitizedOutput?.error?.message.includes('super_secret_mistral_api_key_12345') &&
      sanitizedOutput?.error?.message.includes('Bearer [REDACTED]');

    recordTest('12. Error Handler Credential Redaction & Security', redacted, sanitizedOutput?.error?.message);
  } catch (err) {
    recordTest('12. Error Handler Credential Redaction', false, err.message);
  }

  // -------------------------------------------------------------
  // Test 13: HTTP Server Wire Transport & Route Binding
  // -------------------------------------------------------------
  try {
    const testServer = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = testServer.address().port;

    const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
    const healthJson = await healthRes.json();

    const notFoundRes = await fetch(`http://127.0.0.1:${port}/api/unrecognized-endpoint`);
    const notFoundJson = await notFoundRes.json();

    await new Promise((resolve) => testServer.close(resolve));

    const healthOk = healthRes.status === 200 && healthJson.status === 'ok';
    const notFoundOk = notFoundRes.status === 404 && notFoundJson?.error?.code === 'ROUTE_NOT_FOUND';

    recordTest('13. HTTP Server Wire Transport & Health Check (/api/health)', healthOk && notFoundOk, `healthStatus=${healthRes.status}, 404Status=${notFoundRes.status}`);
  } catch (err) {
    recordTest('13. HTTP Server Wire Transport & Health Check', false, err.message);
  }

  console.log('='.repeat(70));
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
