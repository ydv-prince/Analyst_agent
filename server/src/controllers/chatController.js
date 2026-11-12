import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import mistralService from '../services/mistralService.js';

/**
 * POST /api/chat/completions
 * Dispatches a user prompt to the Mistral AI agent, preserving conversation context and message persistence.
 */
export async function handleChatCompletion(req, res, next) {
  try {
    const { sessionId, content } = req.body || {};

    // 1. Validate sessionId
    if (!sessionId || typeof sessionId !== 'string' || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_SESSION_ID',
          message: 'A valid MongoDB sessionId must be provided.'
        }
      });
    }

    // 2. Validate message content
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        error: {
          code: 'INVALID_MESSAGE_CONTENT',
          message: 'Message content cannot be empty.'
        }
      });
    }

    // 3. Confirm that session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: `Session with ID '${sessionId}' was not found.`
        }
      });
    }

    // 4. Persist the user's message
    const userMessage = await Message.create({
      sessionId: session._id,
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
      isError: false
    });

    // 5. Retrieve conversation history (chronological order)
    // Note: This query already includes the newly saved userMessage at the end.
    const historyDocs = await Message.find({ sessionId: session._id }).sort({ timestamp: 1 });

    const historyPayload = historyDocs.map((doc) => ({
      role: doc.role,
      content: doc.content
    }));

    // 6. Send history to Mistral AI through the backend service
    let completionResult;
    try {
      completionResult = await mistralService.sendChatCompletion(historyPayload, {
        model: session.model
      });
    } catch (mistralError) {
      // Record the error message bubble in the session
      const savedErrorMessage = await Message.create({
        sessionId: session._id,
        content: `Error: ${mistralError.message}`,
        role: 'assistant',
        timestamp: new Date(),
        isError: true
      });

      const statusCode = mistralError.status || 502;
      return res.status(statusCode).json({
        error: {
          code: mistralError.code || 'MISTRAL_SERVICE_ERROR',
          message: mistralError.message
        },
        message: savedErrorMessage
      });
    }

    // 7. Persist the assistant response
    const assistantMessage = await Message.create({
      sessionId: session._id,
      content: completionResult.content,
      role: 'assistant',
      timestamp: new Date(),
      isError: false
    });

    // 8. Return the assistant response message
    return res.status(200).json(assistantMessage);
  } catch (error) {
    return next(error);
  }
}

export default {
  handleChatCompletion
};

