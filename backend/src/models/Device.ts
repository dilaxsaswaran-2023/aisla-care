import mongoose, { Document, Schema } from 'mongoose';

export interface IDevice extends Document {
  patient_id: mongoose.Types.ObjectId;
  device_type: 'camera' | 'pir_sensor' | 'door_sensor' | 'wearable' | 'smart_plug';
  name: string;
  location: string;
  stream_url?: string;
  is_active: boolean;
  last_reading_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    device_type: { type: String, enum: ['camera', 'pir_sensor', 'door_sensor', 'wearable', 'smart_plug'], required: true },
    name: { type: String, required: true },
    location: { type: String, default: '' },
    stream_url: { type: String },
    is_active: { type: Boolean, default: true },
    last_reading_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model<IDevice>('Device', DeviceSchema);
