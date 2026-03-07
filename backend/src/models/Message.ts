import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  sender_id: mongoose.Types.ObjectId;
  recipient_id: mongoose.Types.ObjectId;
  content: string;
  message_type: string;
  created_at: Date;
  updated_at: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    sender_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipient_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    message_type: { type: String, default: 'text' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

MessageSchema.index({ sender_id: 1, recipient_id: 1 });
MessageSchema.index({ created_at: -1 });

export default mongoose.model<IMessage>('Message', MessageSchema);
