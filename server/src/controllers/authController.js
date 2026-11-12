import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../utils/token.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/register
 * Registers a new user with email and password.
 */
export async function register(req, res, next) {
  try {
    const { email, password, displayName } = req.body || {};

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({
        error: {
          code: 'INVALID_EMAIL',
          message: 'A valid email address is required.'
        }
      });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long.'
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.'
        }
      });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
      displayName: displayName && typeof displayName === 'string' && displayName.trim() ? displayName.trim() : 'Data Analyst',
      authProvider: 'local'
    });

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({
      user,
      token
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticates user with email and password.
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required.'
        }
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.'
        }
      });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      user,
      token
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/google
 * Authenticates or registers user via Google OAuth ID token credential.
 */
export async function googleAuth(req, res, next) {
  try {
    const { credential } = req.body || {};

    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIAL',
          message: 'Google ID token credential is required.'
        }
      });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID || undefined
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({
        error: {
          code: 'INVALID_GOOGLE_TOKEN',
          message: `Google token verification failed: ${verifyErr.message}`
        }
      });
    }

    const { sub: googleId, email, name, picture } = payload;
    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({
      $or: [{ googleId }, { email: normalizedEmail }]
    });

    if (user) {
      // Link Google ID if registered locally first
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = user.passwordHash ? 'both' : 'google';
      }
      if (picture && !user.avatarUrl) {
        user.avatarUrl = picture;
      }
      await user.save();
    } else {
      user = await User.create({
        email: normalizedEmail,
        googleId,
        displayName: name || 'Data Analyst',
        avatarUrl: picture || null,
        authProvider: 'google'
      });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.status(200).json({
      user,
      token
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Clears authentication cookie.
 */
export async function logout(req, res) {
  clearAuthCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
}

/**
 * GET /api/auth/me
 * Retrieves the currently authenticated user profile.
 */
export async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: req.user
  });
}
