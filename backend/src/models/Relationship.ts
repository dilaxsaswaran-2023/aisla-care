import mongoose, { Document, Schema } from 'mongoose';

export interface IRelationship extends Document {
  patient_id: mongoose.Types.ObjectId;
  related_user_id: mongoose.Types.ObjectId;
  relationship_type: 'caregiver' | 'family';
  created_by?: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const RelationshipSchema = new Schema<IRelationship>(
  {
    patient_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    related_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    relationship_type: { type: String, enum: ['caregiver', 'family'], required: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

RelationshipSchema.index({ patient_id: 1, related_user_id: 1 }, { unique: true });

export default mongoose.model<IRelationship>('Relationship', RelationshipSchema);
