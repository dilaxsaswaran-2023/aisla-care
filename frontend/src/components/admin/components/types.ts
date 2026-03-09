export interface UserInfo {
  _id?: string;
  id?: string;
  full_name: string;
  email: string;
  role?: string;
  corporate_id?: string;
  phone_country?: string;
  phone_number?: string;
  status?: 'invited' | 'active' | 'disabled';
}

export interface PatientWithFamily {
  patient: UserInfo;
  family_members: UserInfo[];
}

export interface CaregiverRelationship {
  caregiver: UserInfo;
  patients: PatientWithFamily[];
}

export interface UserRow {
  id: string;
  full_name: string;
  role: string;
  phone_country?: string;
  phone_number?: string;
}
