import mongoose from 'mongoose';

/**
 * Middleware ensuring MongoDB is actively connected before processing route operations.
 * Fails gracefully with 503 Service Unavailable if the database is disconnected or unreachable.
 */
export function requireDatabase(req, res, next) {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database service is currently unavailable. MongoDB is not actively connected.'
      }
    });
  }
  next();
}

export default requireDatabase;

