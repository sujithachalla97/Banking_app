// src/controllers/customerProfileController.js
import Joi from 'joi';
import CustomerProfile from '../models/CustomerProfile.js';

const profileSchema = Joi.object({
  fullName: Joi.string().min(2).max(150).required(),
  phone: Joi.string().min(7).max(15).required(),
  dob: Joi.date().required(),
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

export async function createOrUpdateProfile(req, res) {
  // 🚫 Block admins from creating/updating profiles
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins do not require KYC' });
  }

  const { error, value } = profileSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  try {
    const payload = { ...value, userId: req.user.id, kycStatus: 'pending' };
    const updated = await CustomerProfile.findOneAndUpdate(
      { userId: req.user.id },
      payload,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ ok: true, profile: updated });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'Duplicate identity field' });
    res.status(500).json({ error: e.message });
  }
}

export async function getMyProfile(req, res) {
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Admins do not have KYC profiles' });
  }

  const profile = await CustomerProfile.findOne({ userId: req.user.id });
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json({ ok: true, profile });
}

// Admin can still list and update others’ profiles
export async function listProfiles(req, res) {
  const profiles = await CustomerProfile.find().limit(200);
  res.json({ ok: true, profiles });
}

export async function updateKycStatus(req, res) {
  const { id } = req.params;
  const { kycStatus } = req.body;
  if (!['pending','verified','rejected'].includes(kycStatus))
    return res.status(400).json({ error: 'Invalid status' });

  const profile = await CustomerProfile.findByIdAndUpdate(id, { kycStatus }, { new: true });
  if (!profile) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, profile });
}
