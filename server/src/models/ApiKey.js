import mongoose from 'mongoose';

export const SUPPORTED_PROVIDERS = ['mistral', 'gemini', 'openai', 'anthropic'];
export const VALIDATION_STATUSES = ['verified', 'unverified', 'invalid', 'expired'];

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for credential ownership'],
      index: true
    },
    provider: {
      type: String,
      enum: {
        values: SUPPORTED_PROVIDERS,
        message: '{VALUE} is not a supported AI provider'
      },
      required: [true, 'Provider identifier is required']
    },
    encryptedKey: {
      type: String,
      required: [true, 'Encrypted ciphertext is required']
    },
    wrappedDek: {
      type: String,
      required: [true, 'Wrapped DEK payload is required']
    },
    nonce: {
      type: String,
      required: [true, 'Credential nonce/IV is required']
    },
    authTag: {
      type: String,
      required: [true, 'Authentication tag is required']
    },
    keyVersion: {
      type: Number,
      default: 1
    },
    keyMask: {
      type: String,
      required: [true, 'Masked key preview is required']
    },
    validationStatus: {
      type: String,
      enum: VALIDATION_STATUSES,
      default: 'unverified'
    },
    lastValidatedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Enforce unique provider per user account
apiKeySchema.index({ userId: 1, provider: 1 }, { unique: true });

/**
 * Strips ciphertext, DEK, nonces, and auth tags from JSON output.
 * Guarantees zero secret leakage in API responses.
 */
apiKeySchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedKey;
  delete obj.wrappedDek;
  delete obj.nonce;
  delete obj.authTag;
  delete obj.__v;
  return obj;
};

const ApiKey = mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
