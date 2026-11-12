import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name} - ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${name} - ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('PHASE 3 FRONTEND & STATE INTEGRATION TEST SUITE');
  console.log('='.repeat(70));

  // 1. Build Verification
  test('1. Production Build Verification', () => {
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    assert.strictEqual(fs.existsSync(distIndex), true, 'dist/index.html must exist after build');
    const distHtml = fs.readFileSync(distIndex, 'utf-8');
    assert.ok(distHtml.includes('Analyst Agent'), 'dist/index.html must contain title');
  });

  // 2. No Frontend API Key Exposure
  test('2. No Frontend API Key Exposure', () => {
    const srcDir = path.join(__dirname, 'src');
    const files = ['App.jsx', 'main.jsx', 'index.css', 'context/AgentContext.jsx', 'services/api.js'];
    for (const file of files) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      assert.strictEqual(
        content.includes('MISTRAL_API_KEY'),
        false,
        `File ${file} must not contain MISTRAL_API_KEY`
      );
      assert.strictEqual(
        content.includes('Bearer '),
        false,
        `File ${file} must not contain hardcoded Bearer tokens`
      );
    }
  });

  // 3. Vite Proxy Configuration Check
  test('3. Vite Proxy Configuration', () => {
    const viteConfigPath = path.join(__dirname, 'vite.config.js');
    const content = fs.readFileSync(viteConfigPath, 'utf-8');
    assert.ok(content.includes("port: 5173"), 'vite.config.js must configure port 5173');
    assert.ok(content.includes("target: 'http://localhost:5000'"), 'Vite proxy must target port 5000');
    assert.ok(content.includes("'/api'"), 'Vite proxy must proxy /api routes');
  });

  // 4. Backend CORS Configuration Check
  test('4. Backend CORS Configuration Alignment', () => {
    const serverPath = path.join(__dirname, '..', 'server', 'src', 'server.js');
    const content = fs.readFileSync(serverPath, 'utf-8');
    assert.ok(content.includes('http://localhost:5173'), 'server.js must permit Vite origin 5173');
  });

  // 5. Backend Message Role Correction Check
  test('5. Backend Message Role Filtering & System Prompt Correction', () => {
    const mistralServicePath = path.join(__dirname, '..', 'server', 'src', 'services/mistralService.js');
    const content = fs.readFileSync(mistralServicePath, 'utf-8');
    assert.ok(content.includes("m.role === 'user' || m.role === 'assistant'"), 'Must filter only user and assistant messages');
    assert.ok(!content.includes("m.role == 'user' ? 'user' : 'assistant'"), 'Must not convert stored system messages to assistant');
    assert.ok(content.includes("{ role: 'system', content: SYSTEM_PROMPT }"), 'Must inject trusted backend system prompt');
  });

  // 6. API Client Integration: Session Creation (Mocked Transport)
  await asyncTest('6. API Client: Session Creation Contract', async () => {
    const originalFetch = global.fetch;
    let requestedUrl = null;
    let requestOptions = null;

    global.fetch = async (url, opts) => {
      requestedUrl = url;
      requestOptions = opts;
      return {
        ok: true,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({
          id: 'mock_session_123',
          agentName: 'Data analyst',
          model: 'mistral-large-latest',
          createdAt: new Date().toISOString()
        })
      };
    };

    const { api } = await import('./src/services/api.js');
    const result = await api.createSession({ agentName: 'Test Analyst' });

    global.fetch = originalFetch;

    assert.strictEqual(requestedUrl, '/api/sessions');
    assert.strictEqual(requestOptions.method, 'POST');
    assert.strictEqual(result.id, 'mock_session_123');
    assert.strictEqual(result.agentName, 'Data analyst');
  });

  // 7. API Client: Message Dispatch & Error Handling
  await asyncTest('7. API Client: Error Handling Contract', async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        error: { code: 'SESSION_NOT_FOUND', message: 'Session does not exist' }
      })
    });

    const { api } = await import('./src/services/api.js');
    let thrownError = null;
    try {
      await api.sendChatMessage('invalid_id', 'Hello');
    } catch (err) {
      thrownError = err;
    } finally {
      global.fetch = originalFetch;
    }

    assert.ok(thrownError, 'API client must throw on non-2xx status');
    assert.strictEqual(thrownError.status, 404);
    assert.strictEqual(thrownError.code, 'SESSION_NOT_FOUND');
    assert.strictEqual(thrownError.message, 'Session does not exist');
  });

  // 8. Navigation Foundation Verification
  test('8. Navigation Foundation (Zero-Dependency Stack)', async () => {
    const agentContextPath = path.join(__dirname, 'src', 'context', 'AgentContext.jsx');
    const content = fs.readFileSync(agentContextPath, 'utf-8');
    assert.ok(content.includes("HOME: 'home'"), 'Must declare HOME screen');
    assert.ok(content.includes("CHAT: 'chat'"), 'Must declare CHAT screen');
    assert.ok(content.includes("SETTINGS: 'settings'"), 'Must declare SETTINGS screen');
    assert.ok(content.includes("navigateTo"), 'Must provide navigateTo');
    assert.ok(content.includes("goBack"), 'Must provide goBack');
    assert.ok(!content.includes("react-router-dom"), 'Must not introduce unapproved router dependency');
  });

  console.log('='.repeat(70));
  console.log(`PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();

