export interface UserInfo {
  _id?: string;
  id?: string;
  full_name: string;
  email: string;
  role?: string;
  corporate_id?: string;
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
}
