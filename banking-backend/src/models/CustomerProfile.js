// src/models/CustomerProfile.js
import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  line1: String,
  line2: String,
  city: String,
  state: String,
  postalCode: String
}, { _id: false });

const customerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  dob: { type: Date, required: true },
  address: addressSchema,
  aadhar: { type: String, required: true, unique: true, trim: true },
  pan: { type: String, required: true, unique: true, trim: true },
  photoUrl: { type: String }, // optional
  kycStatus: { type: String, enum: ['pending','verified','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('CustomerProfile', customerProfileSchema);
