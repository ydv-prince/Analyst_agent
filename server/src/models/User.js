import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      default: null
    },
    displayName: {
      type: String,
      trim: true,
      default: 'Data Analyst'
    },
    avatarUrl: {
      type: String,
      default: null
    },
    authProvider: {
      type: String,
      enum: ['local', 'google', 'both'],
      default: 'local'
    },
    googleId: {
      type: String,
      sparse: true,
      index: true
    },
    preferences: {
      defaultProvider: {
        type: String,
        enum: ['mistral', 'gemini', 'openai', 'anthropic'],
        default: 'mistral'
      },
      defaultModel: {
        type: String,
        default: 'mistral-small-latest'
      }
    }
  },
  {
    timestamps: true
  }
);

/**
 * Compare plain text password against stored hash.
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Static helper to hash a plain text password with 12 salt rounds.
 */
userSchema.statics.hashPassword = async function (password) {
  return bcrypt.hash(password, 12);
};

/**
 * Exclude sensitive fields from JSON serialization.
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
