// src/models/Account.js
import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountNumber: { type: String, unique: true, required: true },
  type: { type: String, enum: ['SAV', 'CUR'], default: 'SAV' },
  balance: { type: Number, default: 0 }, // store in smallest unit later (paise/cents)
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['active', 'frozen', 'closed'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Account', accountSchema);
