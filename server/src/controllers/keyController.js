import ApiKey, { SUPPORTED_PROVIDERS } from '../models/ApiKey.js';
import { encryptCredential, decryptCredential } from '../utils/vault.js';
import { validateProviderKey } from '../services/providerValidation.js';

/**
 * GET /api/keys
 * Lists all configured BYOK credentials for the authenticated user.
 * Returns only safe masked metadata (zero ciphertext/DEK leakage).
 */
export async function getKeys(req, res, next) {
  try {
    const keys = await ApiKey.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({
      keys: keys.map((k) => k.toJSON())
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/keys/:provider
 * Sets or replaces the API credential for a specific provider.
 * Performs optional pre-storage upstream validation and envelope encryption.
 */
export async function setKey(req, res, next) {
  try {
    const { provider } = req.params;
    const { apiKey, validateOnSave = true } = req.body || {};

    // 1. Validate provider name
    const normalizedProvider = (provider || '').toLowerCase().trim();
    if (!SUPPORTED_PROVIDERS.includes(normalizedProvider)) {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: `Provider '${provider}' is not supported. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`
        }
      });
    }

    // 2. Validate key payload
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 8) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'A valid API key string of at least 8 characters is required.'
        }
      });
    }

    const trimmedKey = apiKey.trim();
    let validationStatus = 'unverified';
    let lastValidatedAt = null;
    let validationResult = null;

    // 3. Pre-storage upstream verification (if requested)
    if (validateOnSave) {
      validationResult = await validateProviderKey(normalizedProvider, trimmedKey);

      if (validationResult.code === 'INVALID_KEY' || validationResult.code === 'PERMISSION_DENIED') {
        return res.status(400).json({
          error: {
            code: 'INVALID_PROVIDER_KEY',
            message: validationResult.message
          }
        });
      }

      validationStatus = validationResult.status;
      lastValidatedAt = validationResult.testedAt;
    }

    // 4. Envelope encryption (AES-256-GCM DEK + KEK)
    const encryptedData = encryptCredential(trimmedKey);

    // 5. Atomic upsert scoped to authenticated user
    const updatedKey = await ApiKey.findOneAndUpdate(
      {
        userId: req.user._id,
        provider: normalizedProvider
      },
      {
        $set: {
          encryptedKey: encryptedData.encryptedKey,
          wrappedDek: encryptedData.wrappedDek,
          nonce: encryptedData.nonce,
          authTag: encryptedData.authTag,
          keyVersion: encryptedData.keyVersion,
          keyMask: encryptedData.keyMask,
          validationStatus,
          lastValidatedAt
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    return res.status(200).json({
      success: true,
      key: updatedKey.toJSON(),
      validation: validationResult
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/keys/:provider/validate
 * Triggers on-demand validation of an already stored provider credential.
 */
export async function validateKey(req, res, next) {
  try {
    const { provider } = req.params;
    const normalizedProvider = (provider || '').toLowerCase().trim();

    if (!SUPPORTED_PROVIDERS.includes(normalizedProvider)) {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: `Provider '${provider}' is not supported.`
        }
      });
    }

    const keyRecord = await ApiKey.findOne({
      userId: req.user._id,
      provider: normalizedProvider
    });

    if (!keyRecord) {
      return res.status(404).json({
        error: {
          code: 'KEY_NOT_FOUND',
          message: `No credential configured for provider '${normalizedProvider}'.`
        }
      });
    }

    // Decrypt in memory for validation only
    const decryptedKey = decryptCredential({
      encryptedKey: keyRecord.encryptedKey,
      wrappedDek: keyRecord.wrappedDek,
      nonce: keyRecord.nonce,
      authTag: keyRecord.authTag,
      keyVersion: keyRecord.keyVersion
    });

    const validationResult = await validateProviderKey(normalizedProvider, decryptedKey);

    keyRecord.validationStatus = validationResult.status;
    keyRecord.lastValidatedAt = validationResult.testedAt;
    await keyRecord.save();

    return res.status(200).json({
      success: true,
      key: keyRecord.toJSON(),
      validation: validationResult
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/keys/:provider
 * Deletes a stored provider credential for the authenticated user.
 */
export async function deleteKey(req, res, next) {
  try {
    const { provider } = req.params;
    const normalizedProvider = (provider || '').toLowerCase().trim();

    if (!SUPPORTED_PROVIDERS.includes(normalizedProvider)) {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: `Provider '${provider}' is not supported.`
        }
      });
    }

    const deleted = await ApiKey.findOneAndDelete({
      userId: req.user._id,
      provider: normalizedProvider
    });

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'KEY_NOT_FOUND',
          message: `No credential configured for provider '${normalizedProvider}'.`
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Credential for provider '${normalizedProvider}' removed successfully.`
    });
  } catch (error) {
    next(error);
  }
}
