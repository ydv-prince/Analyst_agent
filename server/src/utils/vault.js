import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const DEK_LENGTH = 32; // 256 bits

// Deterministic dev fallback key (64 hex characters = 32 bytes)
const DEV_FALLBACK_KEK = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Retrieves the Key Encryption Key (KEK) for a specific version.
 * Supports multiple versioned keys for rotation (e.g. ENCRYPTION_MASTER_KEY_V1, ENCRYPTION_MASTER_KEY_V2).
 */
export function getKek(version = 1) {
  const versionedEnvName = `ENCRYPTION_MASTER_KEY_V${version}`;
  const hexKey = process.env[versionedEnvName] || process.env.ENCRYPTION_MASTER_KEY;

  if (hexKey && typeof hexKey === 'string' && hexKey.trim().length === 64) {
    return Buffer.from(hexKey.trim(), 'hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`CRITICAL: Master encryption key missing for version ${version} (set ${versionedEnvName} or ENCRYPTION_MASTER_KEY)`);
  }

  // In non-production, return deterministic development fallback
  return Buffer.from(DEV_FALLBACK_KEK, 'hex');
}

/**
 * Masks an API key for safe UI and API presentation.
 * Retains safe prefix and suffix characters without revealing the secret core.
 */
export function maskApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return '****';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return '****';

  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Encrypts a plaintext API key using envelope encryption (DEK + KEK).
 * 
 * 1. Generates a cryptographically random 256-bit DEK.
 * 2. Encrypts the plaintext with the DEK using AES-256-GCM.
 * 3. Wraps (encrypts) the DEK with the environment KEK using AES-256-GCM.
 * 4. Returns ciphertext, wrapped DEK, nonces, auth tags, and key version.
 */
export function encryptCredential(plaintextKey, keyVersion = 1) {
  if (!plaintextKey || typeof plaintextKey !== 'string' || !plaintextKey.trim()) {
    throw new Error('Plaintext credential must be a non-empty string');
  }

  // 1. Generate unique random DEK
  const dek = crypto.randomBytes(DEK_LENGTH);

  // 2. Encrypt payload with DEK
  const nonce = crypto.randomBytes(IV_LENGTH);
  const payloadCipher = crypto.createCipheriv(ALGORITHM, dek, nonce);
  let encryptedKey = payloadCipher.update(plaintextKey.trim(), 'utf8', 'hex');
  encryptedKey += payloadCipher.final('hex');
  const authTag = payloadCipher.getAuthTag().toString('hex');

  // 3. Wrap DEK with KEK
  const kek = getKek(keyVersion);
  const dekNonce = crypto.randomBytes(IV_LENGTH);
  const wrapCipher = crypto.createCipheriv(ALGORITHM, kek, dekNonce);
  const wrappedDekCiphertext = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]).toString('hex');
  const wrappedDekAuthTag = wrapCipher.getAuthTag().toString('hex');

  // Format wrapped DEK composite string: <ciphertext>:<nonceHex>:<authTagHex>
  const wrappedDek = `${wrappedDekCiphertext}:${dekNonce.toString('hex')}:${wrappedDekAuthTag}`;

  return {
    encryptedKey,
    wrappedDek,
    nonce: nonce.toString('hex'),
    authTag,
    keyVersion,
    keyMask: maskApiKey(plaintextKey)
  };
}

/**
 * Decrypts an envelope-encrypted credential in memory.
 * 
 * 1. Unwraps the DEK using the KEK corresponding to keyVersion.
 * 2. Decrypts the payload using the recovered DEK.
 * 3. Returns the plaintext secret string.
 */
export function decryptCredential({ encryptedKey, wrappedDek, nonce, authTag, keyVersion = 1 }) {
  if (!encryptedKey || !wrappedDek || !nonce || !authTag) {
    throw new Error('Missing required envelope encryption parameters');
  }

  // 1. Unwrap DEK using KEK
  const [dekCiphertext, dekNonceHex, dekAuthTagHex] = wrappedDek.split(':');
  if (!dekCiphertext || !dekNonceHex || !dekAuthTagHex) {
    throw new Error('Malformed wrapped DEK payload structure');
  }

  const kek = getKek(keyVersion);
  const unwrapDecipher = crypto.createDecipheriv(ALGORITHM, kek, Buffer.from(dekNonceHex, 'hex'));
  unwrapDecipher.setAuthTag(Buffer.from(dekAuthTagHex, 'hex'));

  let dek;
  try {
    dek = Buffer.concat([
      unwrapDecipher.update(Buffer.from(dekCiphertext, 'hex')),
      unwrapDecipher.final()
    ]);
  } catch (err) {
    const error = new Error('Failed to unwrap DEK: Master key mismatch or corrupted payload');
    error.code = 'DEK_UNWRAP_FAILED';
    throw error;
  }

  // 2. Decrypt payload with recovered DEK
  const payloadDecipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(nonce, 'hex'));
  payloadDecipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let plaintext;
  try {
    plaintext = payloadDecipher.update(encryptedKey, 'hex', 'utf8') + payloadDecipher.final('utf8');
  } catch (err) {
    const error = new Error('Failed to decrypt credential: Authentication tag mismatch or corrupted ciphertext');
    error.code = 'PAYLOAD_DECRYPT_FAILED';
    throw error;
  }

  return plaintext;
}

/**
 * Rotates the KEK for a credential record without re-encrypting the underlying payload.
 * Unwraps the DEK using oldVersion, and re-wraps it with newVersion KEK.
 */
export function rotateCredentialDek(storedRecord, newKeyVersion = 2) {
  const currentKeyVersion = storedRecord.keyVersion || 1;

  // 1. Unwrap DEK with current KEK
  const [dekCiphertext, dekNonceHex, dekAuthTagHex] = storedRecord.wrappedDek.split(':');
  const oldKek = getKek(currentKeyVersion);
  const unwrapDecipher = crypto.createDecipheriv(ALGORITHM, oldKek, Buffer.from(dekNonceHex, 'hex'));
  unwrapDecipher.setAuthTag(Buffer.from(dekAuthTagHex, 'hex'));
  const dek = Buffer.concat([
    unwrapDecipher.update(Buffer.from(dekCiphertext, 'hex')),
    unwrapDecipher.final()
  ]);

  // 2. Re-wrap DEK with new KEK
  const newKek = getKek(newKeyVersion);
  const newDekNonce = crypto.randomBytes(IV_LENGTH);
  const wrapCipher = crypto.createCipheriv(ALGORITHM, newKek, newDekNonce);
  const newWrappedCiphertext = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]).toString('hex');
  const newWrappedAuthTag = wrapCipher.getAuthTag().toString('hex');

  const newWrappedDek = `${newWrappedCiphertext}:${newDekNonce.toString('hex')}:${newWrappedAuthTag}`;

  return {
    wrappedDek: newWrappedDek,
    keyVersion: newKeyVersion
  };
}
