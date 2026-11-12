import express from 'express';
import { requireDatabase } from '../middleware/dbCheck.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  register,
  login,
  googleAuth,
  logout,
  getCurrentUser
} from '../controllers/authController.js';

const router = express.Router();

// Ensure MongoDB is connected for all authentication routes
router.use(requireDatabase);

// Public Auth Endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/logout', logout);

// Protected Auth Endpoints
router.get('/me', requireAuth, getCurrentUser);

export default router;
