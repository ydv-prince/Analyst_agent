import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Message from '../models/Message.js';

/**
 * POST /api/sessions
 * Creates a new agent session with default values.
 */
export async function createSession(req, res, next) {
  try {
    const { agentName, model } = req.body || {};

    const sessionData = {};
    if (typeof agentName === 'string' && agentName.trim()) {
      sessionData.agentName = agentName.trim();
    }
    if (typeof model === 'string' && model.trim()) {
      sessionData.model = model.trim();
    }

    const session = await Session.create(sessionData);

    return res.status(201).json(session);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/sessions/:id
 * Retrieves a specific session and its chronological message history.
 */
export async function getSessionById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'The provided session ID is not a valid MongoDB ObjectId.'
        }
      });
    }

    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session with ID '${id}' was not found.`
        }
      });
    }

    const messages = await Message.find({ sessionId: id }).sort({ timestamp: 1 });

    return res.status(200).json({
      session,
      messages
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * DELETE /api/sessions/:id/messages
 * Clears message history for a given session while preserving the session entity.
 */
export async function clearSessionMessages(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'The provided session ID is not a valid MongoDB ObjectId.'
        }
      });
    }

    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session with ID '${id}' was not found.`
        }
      });
    }

    const result = await Message.deleteMany({ sessionId: id });

    return res.status(200).json({
      success: true,
      message: 'Conversation history cleared successfully.',
      clearedCount: result.deletedCount
    });
  } catch (error) {
    return next(error);
  }
}

export default {
  createSession,
  getSessionById,
  clearSessionMessages
};

