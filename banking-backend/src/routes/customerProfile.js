// src/routes/customerProfile.js
import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { createOrUpdateProfile, getMyProfile, listProfiles, updateKycStatus } from '../controllers/customerProfileController.js';

const router = express.Router();

router.post('/', authMiddleware, createOrUpdateProfile);      // create or update own profile
router.get('/me', authMiddleware, getMyProfile);              // get my profile

// admin routes
router.get('/', authMiddleware, requireRole('admin'), listProfiles);
router.patch('/:id/kyc', authMiddleware, requireRole('admin'), updateKycStatus);

export default router;
