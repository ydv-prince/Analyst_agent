import { verifyToken } from '../utils/token.js';
import User from '../models/User.js';

/**
 * Middleware requiring authenticated user for protected endpoints.
 * Checks HttpOnly cookie first, then fallback to Authorization header.
 */
export async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Please sign in.'
        }
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (jwtErr) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Session expired or invalid token. Please log in again.'
        }
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Account not found or deactivated.'
        }
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication middleware for public endpoints that can be enhanced with user context.
 */
export async function optionalAuth(req, res, next) {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id);
        if (user) {
          req.user = user;
        }
      } catch {
        // Ignore invalid token in optional auth
      }
    }
    next();
  } catch (error) {
    next(error);
  }
}

export default requireAuth;
