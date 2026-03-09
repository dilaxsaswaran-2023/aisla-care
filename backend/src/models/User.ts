import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'caregiver' | 'patient' | 'family';
  avatar_url?: string;
  phone_country?: string;
  phone_number?: string;
  address?: string;
  status?: 'invited' | 'active' | 'disabled';
  caregiver_type?: string;
  caregiver_subtype?: string;
  caregiver_id?: string; // For patients - reference to their caregiver
  family_ids?: string[]; // For patients - references to family members (many-to-many)
  corporate_id?: string; // Reference to the admin/super_admin who manages this user
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    full_name: { type: String, required: true },
    role: { type: String, enum: ['super_admin', 'admin', 'caregiver', 'patient', 'family'], required: true },
    avatar_url: { type: String },
    phone_country: { type: String },
    phone_number: { type: String },
    status: { type: String, enum: ['invited', 'active', 'disabled'], default: 'active' },
    caregiver_type: { type: String },
    caregiver_subtype: { type: String },
    address: { type: String },
    caregiver_id: { type: Schema.Types.ObjectId, ref: 'User' }, // Reference to caregiver for patients
    family_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }], // References to family members for patients (many-to-many)
    corporate_id: { type: Schema.Types.ObjectId, ref: 'User' }, // Reference to the admin/super_admin who manages this user
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export default mongoose.model<IUser>('User', UserSchema);
