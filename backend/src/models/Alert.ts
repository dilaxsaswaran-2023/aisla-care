import mongoose, { Document, Schema } from 'mongoose';

export interface IAlert extends Document {
  patient_id: mongoose.Types.ObjectId;
  alert_type: 'sos' | 'fall' | 'geofence' | 'inactivity' | 'health';
  status: string;
  priority: string;
  title: string;
  message: string;
  latitude?: number;
  longitude?: number;
  created_at: Date;
  updated_at: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    alert_type: { type: String, enum: ['sos', 'fall', 'geofence', 'inactivity', 'health'], required: true },
    status: { type: String, default: 'active' },
    priority: { type: String, default: 'medium' },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

AlertSchema.index({ patient_id: 1 });
AlertSchema.index({ status: 1 });

export default mongoose.model<IAlert>('Alert', AlertSchema);
