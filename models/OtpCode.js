import mongoose from 'mongoose';

const OtpCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: false,
      default: null,
    },
    codeHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['reset_password'],
      default: 'reset_password',
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL auto-delete when expired
    },
  },
  { timestamps: true }
);

export default mongoose.models.OtpCode ||
  mongoose.model('OtpCode', OtpCodeSchema);