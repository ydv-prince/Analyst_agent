/**
 * Global Express error handling middleware.
 * Ensures consistent JSON responses and prevents credential or stack trace leakage.
 */
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : status === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR');

  // Sanitize message: never expose raw bearer tokens or secret values
  let message = err.message || 'An unexpected error occurred';
  if (typeof message === 'string') {
    message = message.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  }

  res.status(status).json({
    error: {
      code,
      message
    }
  });
}

export default errorHandler;

