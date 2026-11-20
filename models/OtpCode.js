import mongoose from 'mongoose';

const OtpCodeSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ['reset_password'], default: 'reset_password' },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL auto-delete
  },
  { timestamps: true }
);

OtpCodeSchema.index({ phone: 1, purpose: 1, consumed: 1 });

export default mongoose.models.OtpCode || mongoose.model('OtpCode', OtpCodeSchema);