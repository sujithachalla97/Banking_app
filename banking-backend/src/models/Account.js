import mongoose from 'mongoose';
const AccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  accountNumber: { type:String, required:true, unique:true },
  type: { type: String, default:'SAV' },
  balance: { type: Number, default: 0 }, // paise integer
  currency: { type:String, default:'INR' },
  status: { type:String, enum:['active','disabled'], default:'active' }
}, { timestamps:true });
export default mongoose.model('Account', AccountSchema);
