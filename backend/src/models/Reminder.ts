import mongoose, { Document, Schema } from 'mongoose';

export interface IReminder extends Document {
  patient_id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  scheduled_time: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String },
    scheduled_time: { type: Date, required: true },
    completed_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model<IReminder>('Reminder', ReminderSchema);
