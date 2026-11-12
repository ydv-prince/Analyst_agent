import express from 'express';
import { requireDatabase } from '../middleware/dbCheck.js';
import {
  createSession,
  getSessionById,
  clearSessionMessages
} from '../controllers/sessionController.js';

const router = express.Router();

// Apply database check to all session persistence routes
router.use(requireDatabase);

// POST /api/sessions - Create new analysis session
router.post('/', createSession);

// GET /api/sessions/:id - Retrieve session and chronological messages
router.get('/:id', getSessionById);

// DELETE /api/sessions/:id/messages - Clear conversation history for a session
router.delete('/:id/messages', clearSessionMessages);

export default router;

