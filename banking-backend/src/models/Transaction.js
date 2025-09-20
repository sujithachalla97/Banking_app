// src/models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  type: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
  amount: { type: Number, required: true }, // in paise (integer)
  balanceAfter: { type: Number, required: true }, // in paise
  description: { type: String },
  refId: { type: String, index: true }, // optional idempotency key (not unique to allow same ref for different accounts if needed)
  createdAt: { type: Date, default: Date.now }
});

// optional compound unique index if you want refId globally unique:
// transactionSchema.index({ refId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Transaction', transactionSchema);
