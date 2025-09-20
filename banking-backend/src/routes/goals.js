import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createGoal, depositToGoal } from '../controllers/goalController.js';

const router = express.Router();
router.post('/', authMiddleware, createGoal);
router.post('/deposit', authMiddleware, depositToGoal);

export default router;
