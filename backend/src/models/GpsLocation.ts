import mongoose, { Document, Schema } from 'mongoose';

export interface IGpsLocation extends Document {
  user_id: mongoose.Types.ObjectId;
  latitude: number;
  longitude: number;
  accuracy: number;
  created_at: Date;
  updated_at: Date;
}

const GpsLocationSchema = new Schema<IGpsLocation>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

GpsLocationSchema.index({ user_id: 1, created_at: -1 });

export default mongoose.model<IGpsLocation>('GpsLocation', GpsLocationSchema);
