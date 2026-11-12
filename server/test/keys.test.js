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
import ApiKey from '../src/models/ApiKey.js';
import { generateToken } from '../src/utils/token.js';
import {
  encryptCredential,
  decryptCredential,
  rotateCredentialDek
} from '../src/utils/vault.js';
import { validateProviderKey } from '../src/services/providerValidation.js';

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

async function runKeysTestSuite() {
  console.log('='.repeat(70));
  console.log('PHASE 2: SECURE BYOK CREDENTIAL VAULT TEST SUITE');
  console.log('='.repeat(70));

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('MONGODB_URI missing in server/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoURI);
  await User.init();
  await ApiKey.init();

  let userA = null;
  let userB = null;
  let tokenA = null;
  let tokenB = null;

  try {
    // Setup test users
    userA = await User.create({
      email: `user_a_${Date.now()}@test.io`,
      passwordHash: 'dummyhash',
      displayName: 'User A'
    });
    tokenA = generateToken(userA);

    userB = await User.create({
      email: `user_b_${Date.now()}@test.io`,
      passwordHash: 'dummyhash',
      displayName: 'User B'
    });
    tokenB = generateToken(userB);

    // -------------------------------------------------------------
    // Test 1: Encryption & Decryption Round-Trip (AES-256-GCM Envelope)
    // -------------------------------------------------------------
    try {
      const rawSecret = 'sk-proj-super-secret-key-1234567890';
      const envelope = encryptCredential(rawSecret);

      assert.ok(envelope.encryptedKey, 'Must produce encrypted ciphertext');
      assert.ok(envelope.wrappedDek, 'Must produce wrapped DEK');
      assert.ok(envelope.nonce, 'Must produce nonce/IV');
      assert.ok(envelope.authTag, 'Must produce GCM auth tag');
      assert.notStrictEqual(envelope.encryptedKey, rawSecret, 'Ciphertext must differ from raw secret');
      assert.strictEqual(envelope.keyMask, 'sk-p...7890', 'Must produce correct mask');

      const recovered = decryptCredential(envelope);
      assert.strictEqual(recovered, rawSecret, 'Decrypted key must exactly match original secret');

      recordTest('1. Envelope Encryption & Decryption Round-Trip (AES-256-GCM)', true);
    } catch (err) {
      recordTest('1. Envelope Encryption & Decryption Round-Trip', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 2: Cryptographic Tampering & Auth Tag Validation
    // -------------------------------------------------------------
    try {
      const rawSecret = 'sk-ant-test-tamper-key';
      const envelope = encryptCredential(rawSecret);

      // Corrupt the authTag
      let caughtAuthTag = false;
      try {
        decryptCredential({
          ...envelope,
          authTag: 'ffffffffffffffffffffffffffffffff'
        });
      } catch (e) {
        caughtAuthTag = e.code === 'PAYLOAD_DECRYPT_FAILED';
      }
      assert.strictEqual(caughtAuthTag, true, 'Corrupted authTag must fail authentication');

      // Corrupt the wrappedDek
      let caughtDek = false;
      try {
        const [c, iv] = envelope.wrappedDek.split(':');
        decryptCredential({
          ...envelope,
          wrappedDek: `${c}:${iv}:00000000000000000000000000000000`
        });
      } catch (e) {
        caughtDek = e.code === 'DEK_UNWRAP_FAILED';
      }
      assert.strictEqual(caughtDek, true, 'Corrupted wrapped DEK must fail unwrapping');

      recordTest('2. Cryptographic Tampering & Integrity Verification', true);
    } catch (err) {
      recordTest('2. Cryptographic Tampering & Integrity Verification', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 3: Key Versioning & KEK Rotation
    // -------------------------------------------------------------
    try {
      process.env.ENCRYPTION_MASTER_KEY_V2 = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
      const secret = 'sk-rotation-test-secret';
      const v1Envelope = encryptCredential(secret, 1);

      const rotated = rotateCredentialDek(v1Envelope, 2);
      assert.strictEqual(rotated.keyVersion, 2, 'Rotated record must have version 2');
      assert.notStrictEqual(rotated.wrappedDek, v1Envelope.wrappedDek, 'Wrapped DEK must change under new KEK');

      const recoveredV2 = decryptCredential({ ...v1Envelope, ...rotated });
      assert.strictEqual(recoveredV2, secret, 'Decrypted rotated credential must match original');

      recordTest('3. Encryption Key Versioning & DEK Re-wrapping Rotation', true);
    } catch (err) {
      recordTest('3. Encryption Key Versioning & DEK Re-wrapping Rotation', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 4: Database Model — Plaintext Never Stored & Serialization
    // -------------------------------------------------------------
    try {
      const plainKey = 'AIzaSyTestGeminiKey123456789';
      const envelope = encryptCredential(plainKey);

      const keyDoc = await ApiKey.create({
        userId: userA._id,
        provider: 'gemini',
        ...envelope,
        validationStatus: 'verified',
        lastValidatedAt: new Date()
      });

      // Direct inspection of stored MongoDB document
      const rawDoc = await ApiKey.findById(keyDoc._id).lean();
      assert.strictEqual(rawDoc.encryptedKey !== plainKey, true, 'Database must not store plaintext');
      assert.ok(rawDoc.encryptedKey.length > 20, 'Encrypted key must be stored');
      assert.ok(rawDoc.wrappedDek, 'Wrapped DEK must be stored');

      // toJSON check: API responses MUST NOT leak secrets
      const json = keyDoc.toJSON();
      assert.strictEqual(json.encryptedKey, undefined, 'toJSON must omit encryptedKey');
      assert.strictEqual(json.wrappedDek, undefined, 'toJSON must omit wrappedDek');
      assert.strictEqual(json.nonce, undefined, 'toJSON must omit nonce');
      assert.strictEqual(json.authTag, undefined, 'toJSON must omit authTag');
      assert.strictEqual(json.keyMask, 'AIza...6789', 'toJSON must expose safe mask');
      assert.strictEqual(json.provider, 'gemini', 'Provider must be present');

      await ApiKey.findByIdAndDelete(keyDoc._id);
      recordTest('4. Storage Security & API Serialization Protection', true);
    } catch (err) {
      recordTest('4. Storage Security & API Serialization Protection', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 5: Unique Compound Index (userId + provider)
    // -------------------------------------------------------------
    try {
      const envelope = encryptCredential('sk-test-unique-key-1');
      await ApiKey.create({
        userId: userA._id,
        provider: 'openai',
        ...envelope
      });

      let duplicateBlocked = false;
      try {
        await ApiKey.create({
          userId: userA._id,
          provider: 'openai',
          ...encryptCredential('sk-test-unique-key-2')
        });
      } catch (dupErr) {
        duplicateBlocked = dupErr.code === 11000;
      }

      assert.strictEqual(duplicateBlocked, true, 'Duplicate provider record for same user must be rejected');
      await ApiKey.deleteOne({ userId: userA._id, provider: 'openai' });
      recordTest('5. Unique Compound Index (userId + provider) Enforcement', true);
    } catch (err) {
      recordTest('5. Unique Compound Index Enforcement', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 6: Provider Validation Adapter Error Sanitization
    // -------------------------------------------------------------
    try {
      const fakeSecret = 'super-secret-key-should-never-leak-in-error-output';
      const result = await validateProviderKey('mistral', fakeSecret);

      assert.strictEqual(result.valid, false, 'Invalid key must report valid: false');
      assert.strictEqual(result.code, 'INVALID_KEY', 'Must classify as INVALID_KEY');
      assert.strictEqual(result.message.includes(fakeSecret), false, 'Error message must NOT leak secret');

      recordTest('6. Provider Validation Error Normalization & Secret Redaction', true);
    } catch (err) {
      recordTest('6. Provider Validation Error Normalization', false, err.message);
    }

    // -------------------------------------------------------------
    // Test 7: HTTP Route Wire Transport & Tenant Isolation
    // -------------------------------------------------------------
    try {
      const http = await import('node:http');
      const { default: app } = await import('../src/server.js');

      const server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}/api/keys`;

      await ApiKey.deleteMany({ userId: { $in: [userA._id, userB._id] } });

      try {
        // Subtest 7A: Unauthenticated request rejected (401)
        const unauthRes = await fetch(baseUrl);
        assert.strictEqual(unauthRes.status, 401, 'Unauthenticated GET /api/keys must return 401');

        // Subtest 7B: User A saves a key (skip upstream validate for test speed)
        const saveRes = await fetch(`${baseUrl}/anthropic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`
          },
          body: JSON.stringify({
            apiKey: 'sk-ant-test-user-a-valid-length-key',
            validateOnSave: false
          })
        });
        assert.strictEqual(saveRes.status, 200, 'POST /api/keys/:provider must return 200');
        const saveData = await saveRes.json();
        assert.strictEqual(saveData.success, true);
        assert.strictEqual(saveData.key.provider, 'anthropic');
        assert.strictEqual(saveData.key.encryptedKey, undefined, 'Must not return ciphertext');
        assert.strictEqual(saveData.key.keyMask, 'sk-a...-key');

        // Subtest 7C: User B cannot view User A's keys (Tenant Isolation)
        const listUserB = await fetch(baseUrl, {
          headers: { Authorization: `Bearer ${tokenB}` }
        });
        const listUserBData = await listUserB.json();
        assert.strictEqual(listUserBData.keys.length, 0, 'User B must see 0 keys (User A key isolated)');

        // Subtest 7D: User A sees their own key
        const listUserA = await fetch(baseUrl, {
          headers: { Authorization: `Bearer ${tokenA}` }
        });
        const listUserAData = await listUserA.json();
        assert.strictEqual(listUserAData.keys.length, 1);
        assert.strictEqual(listUserAData.keys[0].provider, 'anthropic');

        // Subtest 7E: User B cannot delete User A's key
        const deleteResB = await fetch(`${baseUrl}/anthropic`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenB}` }
        });
        assert.strictEqual(deleteResB.status, 404, 'User B deleting User A key must return 404');

        // Subtest 7F: User A replaces key (Credential replacement)
        const replaceRes = await fetch(`${baseUrl}/anthropic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`
          },
          body: JSON.stringify({
            apiKey: 'sk-ant-updated-key-for-user-a-1234',
            validateOnSave: false
          })
        });
        assert.strictEqual(replaceRes.status, 200);
        const replaceData = await replaceRes.json();
        assert.strictEqual(replaceData.key.keyMask, 'sk-a...1234');

        // Verify still only 1 record in database for User A
        const countA = await ApiKey.countDocuments({ userId: userA._id });
        assert.strictEqual(countA, 1, 'Replacement must update atomically, not duplicate');

        // Subtest 7G: User A deletes their key
        const deleteResA = await fetch(`${baseUrl}/anthropic`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokenA}` }
        });
        assert.strictEqual(deleteResA.status, 200, 'User A deleting own key must return 200');

        const postDeleteCount = await ApiKey.countDocuments({ userId: userA._id });
        assert.strictEqual(postDeleteCount, 0, 'Key must be deleted from database');

        recordTest('7. HTTP Endpoints & Strict Multi-Tenant Isolation', true);
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    } catch (err) {
      recordTest('7. HTTP Endpoints & Strict Multi-Tenant Isolation', false, err.message);
    }
  } finally {
    // Teardown
    if (userA) {
      await ApiKey.deleteMany({ userId: userA._id }).catch(() => {});
      await User.findByIdAndDelete(userA._id).catch(() => {});
    }
    if (userB) {
      await ApiKey.deleteMany({ userId: userB._id }).catch(() => {});
      await User.findByIdAndDelete(userB._id).catch(() => {});
    }
    await mongoose.disconnect();
  }

  console.log('='.repeat(70));
  console.log(`BYOK VAULT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log('='.repeat(70));

  if (failed > 0) process.exit(1);
}

runKeysTestSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
