import assert from 'node:assert';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.NODE_ENV = 'test';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import User from '../src/models/User.js';
import { generateToken, verifyToken } from '../src/utils/token.js';

let passed = 0;
let failed = 0;
const results = [];

function recordTest(name, success, details = '') {
  if (success) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name} - ${details}`);
  }
  results.push({ name, success, details });
}

async function runAuthTests() {
  console.log('='.repeat(70));
  console.log('PHASE 1: AUTHENTICATION & MULTI-USER IDENTITY TEST SUITE');
  console.log('='.repeat(70));

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('MONGODB_URI missing in server/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoURI);

  const testEmail = `auth_test_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  let createdUserId = null;
  let authToken = null;

  try {
    // 1. Password Hashing & toJSON Security
    try {
      const hash = await User.hashPassword(testPassword);
      assert.ok(hash.startsWith('$2'), 'Hash must be standard bcrypt format');
      assert.notStrictEqual(hash, testPassword, 'Password must not be stored in plaintext');

      const userDoc = new User({
        email: testEmail,
        passwordHash: hash,
        displayName: 'Test Auditor'
      });
      const jsonOutput = userDoc.toJSON();
      assert.strictEqual(jsonOutput.passwordHash, undefined, 'toJSON must delete passwordHash');
      assert.strictEqual(jsonOutput.email, testEmail, 'Email must be preserved in toJSON');

      recordTest('1. Password Hashing & Serialization Security', true);
    } catch (err) {
      recordTest('1. Password Hashing & Serialization Security', false, err.message);
    }

    // 2. User Registration via Model & Password Verification
    try {
      const user = await User.create({
        email: testEmail,
        passwordHash: await User.hashPassword(testPassword),
        displayName: 'Test Auditor'
      });
      createdUserId = user._id;

      const isMatch = await user.comparePassword(testPassword);
      const isMismatch = await user.comparePassword('WrongPassword999');

      assert.strictEqual(isMatch, true, 'Correct password must verify');
      assert.strictEqual(isMismatch, false, 'Incorrect password must be rejected');

      recordTest('2. User Creation & Password Comparison', true);
    } catch (err) {
      recordTest('2. User Creation & Password Comparison', false, err.message);
    }

    // 3. Duplicate Email Prevention
    try {
      let duplicateCaught = false;
      try {
        await User.create({
          email: testEmail,
          passwordHash: 'dummy'
        });
      } catch (dupErr) {
        duplicateCaught = dupErr.code === 11000;
      }
      assert.strictEqual(duplicateCaught, true, 'Duplicate email must trigger unique index error');
      recordTest('3. Duplicate Email Uniqueness Enforcement', true);
    } catch (err) {
      recordTest('3. Duplicate Email Uniqueness Enforcement', false, err.message);
    }

    // 4. Token Generation & Verification
    try {
      const user = await User.findById(createdUserId);
      authToken = generateToken(user);
      assert.ok(typeof authToken === 'string' && authToken.length > 20, 'JWT must be non-empty string');

      const decoded = verifyToken(authToken);
      assert.strictEqual(decoded.id, createdUserId.toString(), 'Decoded ID must match user ID');
      assert.strictEqual(decoded.email, testEmail, 'Decoded email must match user email');

      recordTest('4. JWT Token Generation & Cryptographic Verification', true);
    } catch (err) {
      recordTest('4. JWT Token Generation & Cryptographic Verification', false, err.message);
    }

    // 5. RequireAuth Middleware Simulation (Cookie & Bearer)
    try {
      const { requireAuth } = await import('../src/middleware/authMiddleware.js');

      // Subtest A: Missing token -> 401
      let statusA = null;
      let jsonA = null;
      const resA = {
        status: (s) => { statusA = s; return { json: (j) => { jsonA = j; } }; }
      };
      await requireAuth({ cookies: {}, headers: {} }, resA, () => {});
      assert.strictEqual(statusA, 401, 'Must reject missing token with 401');
      assert.strictEqual(jsonA?.error?.code, 'UNAUTHORIZED');

      // Subtest B: Bearer token -> success & req.user attached
      let nextCalledB = false;
      const reqB = {
        cookies: {},
        headers: { authorization: `Bearer ${authToken}` }
      };
      await requireAuth(reqB, {}, () => { nextCalledB = true; });
      assert.strictEqual(nextCalledB, true, 'Valid Bearer token must call next()');
      assert.strictEqual(reqB.user?._id?.toString(), createdUserId.toString(), 'req.user must be attached');

      // Subtest C: Cookie token -> success & req.user attached
      let nextCalledC = false;
      const reqC = {
        cookies: { token: authToken },
        headers: {}
      };
      await requireAuth(reqC, {}, () => { nextCalledC = true; });
      assert.strictEqual(nextCalledC, true, 'Valid Cookie token must call next()');
      assert.strictEqual(reqC.user?._id?.toString(), createdUserId.toString(), 'req.user must be attached via cookie');

      recordTest('5. RequireAuth Middleware (Bearer & Cookie Transport)', true);
    } catch (err) {
      recordTest('5. RequireAuth Middleware (Bearer & Cookie Transport)', false, err.message);
    }

    // 6. Invalid Token Rejection
    try {
      const { requireAuth } = await import('../src/middleware/authMiddleware.js');
      let statusD = null;
      let jsonD = null;
      const resD = {
        status: (s) => { statusD = s; return { json: (j) => { jsonD = j; } }; }
      };
      await requireAuth({ cookies: { token: 'invalid.tampered.token' }, headers: {} }, resD, () => {});
      assert.strictEqual(statusD, 401, 'Must reject invalid token with 401');
      assert.strictEqual(jsonD?.error?.code, 'TOKEN_INVALID');

      recordTest('6. Tampered / Malformed Token Rejection', true);
    } catch (err) {
      recordTest('6. Tampered / Malformed Token Rejection', false, err.message);
    }

    // 7. Full HTTP Route Wire Transport (Register -> Me -> Logout -> Login)
    try {
      const http = await import('node:http');
      const { default: app } = await import('../src/server.js');
      
      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}/api/auth`;

      try {
        const wireEmail = `wire_${Date.now()}@test.io`;
        const wirePass = 'WirePasswordSecure1!';

        // Step A: Register via HTTP
        const regRes = await fetch(`${baseUrl}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: wireEmail, password: wirePass, displayName: 'Wire User' })
        });
        assert.strictEqual(regRes.status, 201, 'HTTP Register must return 201');
        const setCookieHeader = regRes.headers.get('set-cookie');
        assert.ok(setCookieHeader && setCookieHeader.includes('token='), 'Must set HttpOnly token cookie');
        assert.ok(setCookieHeader.includes('HttpOnly'), 'Cookie must be marked HttpOnly');

        const regData = await regRes.json();
        assert.strictEqual(regData.user.email, wireEmail);
        assert.strictEqual(regData.user.passwordHash, undefined, 'passwordHash must not leak');
        const wireToken = regData.token;

        // Step B: Authenticated /me via Cookie
        const meCookieRes = await fetch(`${baseUrl}/me`, {
          headers: { Cookie: `token=${wireToken}` }
        });
        assert.strictEqual(meCookieRes.status, 200, 'HTTP /me with Cookie must return 200');
        const meData = await meCookieRes.json();
        assert.strictEqual(meData.user.email, wireEmail);

        // Step C: Authenticated /me via Bearer
        const meBearerRes = await fetch(`${baseUrl}/me`, {
          headers: { Authorization: `Bearer ${wireToken}` }
        });
        assert.strictEqual(meBearerRes.status, 200, 'HTTP /me with Bearer must return 200');

        // Step D: Logout via HTTP
        const logoutRes = await fetch(`${baseUrl}/logout`, { method: 'POST' });
        assert.strictEqual(logoutRes.status, 200, 'HTTP Logout must return 200');

        // Step E: Login via HTTP
        const loginRes = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: wireEmail, password: wirePass })
        });
        assert.strictEqual(loginRes.status, 200, 'HTTP Login must return 200');
        const loginData = await loginRes.json();
        assert.ok(loginData.token, 'Login must issue new JWT');

        // Clean up wire user
        await User.deleteOne({ email: wireEmail });

        recordTest('7. HTTP Wire Transport (Register, Cookie/Bearer /me, Logout, Login)', true);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    } catch (err) {
      recordTest('7. HTTP Wire Transport', false, err.message);
    }

    // 8. Cleanup Test User from Atlas
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId);
      const exists = await User.findById(createdUserId);
      assert.strictEqual(exists, null, 'Test user must be purged after tests');
      recordTest('8. Test User Cleanup & Database Hygiene', true);
    }
  } finally {
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId).catch(() => {});
    }
    await mongoose.disconnect();
  }

  console.log('='.repeat(70));
  console.log(`AUTH TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
}

runAuthTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
