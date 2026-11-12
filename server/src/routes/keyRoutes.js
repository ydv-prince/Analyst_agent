import express from 'express';
import { requireDatabase } from '../middleware/dbCheck.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import {
  getKeys,
  setKey,
  validateKey,
  deleteKey
} from '../controllers/keyController.js';

const router = express.Router();

// Enforce active MongoDB connection and authentication on all BYOK routes
router.use(requireDatabase);
router.use(requireAuth);

router.get('/', getKeys);
router.post('/:provider', setKey);
router.post('/:provider/validate', validateKey);
router.delete('/:provider', deleteKey);

export default router;
