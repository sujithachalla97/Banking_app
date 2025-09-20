import mongoose from 'mongoose';

const AddressSchema = new mongoose.Schema({
  line1: { type: String },
  line2: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String }
}, { _id: false });

const CustomerProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // one profile per user
  },
  fullName: { type: String, required: true, minlength: 2, maxlength: 150 },
  phone: { type: String, required: true, minlength: 7, maxlength: 15 },
  dob: { type: Date, required: true },
  address: { type: AddressSchema },

  // Sensitive identity fields
  aadhar: { type: String, required: true, unique: true, sparse: true },
  pan: { type: String, required: true, unique: true, sparse: true },

  photoUrl: { type: String }, // e.g. S3 / Cloudinary URL

  kycStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },

  // Optional audit trail
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('CustomerProfile', CustomerProfileSchema);
