import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'analyst_agent_jwt_default_dev_secret_key_2026';
const JWT_EXPIRES_IN = '7d';

/**
 * Signs a JWT for a user entity.
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verifies and decodes a JWT string.
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Sets the authentication JWT cookie on the response.
 */
export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

/**
 * Clears the authentication JWT cookie.
 */
export function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
}
