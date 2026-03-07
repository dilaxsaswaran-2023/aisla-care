import mongoose, { Document, Schema } from 'mongoose';

export interface IConsentRecord extends Document {
  patient_id: mongoose.Types.ObjectId;
  consent_type: string;
  granted_to: mongoose.Types.ObjectId;
  status: 'active' | 'revoked' | 'expired';
  granted_at: Date;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const ConsentRecordSchema = new Schema<IConsentRecord>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    consent_type: { type: String, required: true },
    granted_to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
    granted_at: { type: Date, default: Date.now },
    expires_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model<IConsentRecord>('ConsentRecord', ConsentRecordSchema);
