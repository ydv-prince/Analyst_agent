import express from 'express';
import { requireDatabase } from '../middleware/dbCheck.js';
import { handleChatCompletion } from '../controllers/chatController.js';

const router = express.Router();

// Apply database check to ensure message persistence is guaranteed
router.use(requireDatabase);

// POST /api/chat/completions - Dispatch message to Mistral agent with conversation history
router.post('/completions', handleChatCompletion);

export default router;

