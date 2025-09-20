import mongoose from 'mongoose';
const GoalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  title: { type:String, required:true },
  targetAmount: { type: Number, required:true }, // paise
  currentAmount: { type: Number, default:0 }, // paise
  deadline: Date,
  overfunded: { type:Boolean, default:false }
}, { timestamps:true });
export default mongoose.model('Goal', GoalSchema);
