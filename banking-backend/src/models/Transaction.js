import mongoose from 'mongoose';
const TransactionSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref:'Account', required:true },
  type: { type: String, enum:['DEBIT','CREDIT'], required:true },
  amount: { type: Number, required:true }, // paise
  balanceAfter: { type: Number, required:true },
  description: String,
  refId: String,
  meta: mongoose.Mixed
}, { timestamps:true });
export default mongoose.model('Transaction', TransactionSchema);
