import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  user_id?: mongoose.Types.ObjectId;
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: any;
  ip_address?: string;
  created_at: Date;
  updated_at: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    entity_type: { type: String },
    entity_id: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ip_address: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

AuditLogSchema.index({ user_id: 1 });
AuditLogSchema.index({ created_at: -1 });

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
