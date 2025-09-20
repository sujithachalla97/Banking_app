// src/controllers/customerProfileController.js
import Joi from 'joi';
import CustomerProfile from '../models/CustomerProfile.js'; // your model
import mongoose from 'mongoose';

const profileSchema = Joi.object({
  fullName: Joi.string().min(2).max(150).required(),
  phone: Joi.string().min(7).max(15).required(),
  dob: Joi.date().iso().required(),
  address: Joi.object({
    line1: Joi.string().allow('').optional(),
    line2: Joi.string().allow('').optional(),
    city: Joi.string().allow('').optional(),
    state: Joi.string().allow('').optional(),
    postalCode: Joi.string().allow('').optional()
  }).optional(),
  aadhar: Joi.string().min(8).max(20).required(),
  pan: Joi.string().min(5).max(20).required(),
  photoUrl: Joi.string().uri().optional()
});

/**
 * Create or update current user's profile (KYC).
 * Admins are blocked from creating/updating KYC profiles.
 */
export async function createOrUpdateProfile(req, res) {
  if (req.user?.role === 'admin') {
    return res.status(403).json({ ok: false, error: 'Admins do not require KYC' });
  }

  const { error, value } = profileSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(400).json({ ok: false, error: error.details.map(d => d.message).join('; ') });

  try {
    const payload = { ...value, userId: req.user.id, kycStatus: 'pending' };

    // upsert and return created/updated document
    const updated = await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    // mask sensitive fields in response (if needed)
    const response = { ...updated };
    if (response.aadhar) response.aadhar = `****${String(response.aadhar).slice(-4)}`;

    return res.status(201).json({ ok: true, profile: response });
  } catch (e) {
    // duplicate key handling (unique aadhar/pan)
    if (e.code === 11000) return res.status(409).json({ ok: false, error: 'Duplicate identity field' });
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * Get current user's profile
 */
export async function getMyProfile(req, res) {
  if (req.user?.role === 'admin') {
    return res.status(403).json({ ok: false, error: 'Admins do not have KYC profiles' });
  }
  try {
    const profile = await CustomerProfile.findOne({ userId: req.user.id }).lean();
    if (!profile) return res.status(404).json({ ok: false, error: 'Profile not found' });

    // mask aadhar before sending
    if (profile.aadhar) profile.aadhar = `****${String(profile.aadhar).slice(-4)}`;
    return res.json({ ok: true, profile });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * Admin: list profiles (paginated)
 * Use authMiddleware + requireRole('admin') on route
 */
export async function listProfiles(req, res) {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const skip = Number(req.query.skip) || 0;
    const profiles = await CustomerProfile.find().skip(skip).limit(limit).lean();

    // mask aadhar for all rows
    const sanitized = profiles.map(p => {
      if (p.aadhar) p.aadhar = `****${String(p.aadhar).slice(-4)}`;
      return p;
    });

    return res.json({ ok: true, profiles: sanitized });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}

/**
 * Admin: update kyc status
 */
export async function updateKycStatus(req, res) {
  const { id } = req.params;
  const { kycStatus } = req.body;
  if (!['pending','verified','rejected'].includes(kycStatus))
    return res.status(400).json({ ok: false, error: 'Invalid status' });

  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ ok: false, error: 'Invalid profile id' });

  try {
    const profile = await CustomerProfile.findByIdAndUpdate(id, { kycStatus }, { new: true }).lean();
    if (!profile) return res.status(404).json({ ok: false, error: 'Not found' });

    // mask
    if (profile.aadhar) profile.aadhar = `****${String(profile.aadhar).slice(-4)}`;

    return res.json({ ok: true, profile });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
