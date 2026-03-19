export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'caregiver'
  | 'patient'
  | 'family';
export type ReminderStatus = 'pending' | 'completed' | 'skipped';
export type AlertStatus = 'triggered' | 'acknowledged' | 'resolved';
export type MessageType = 'text' | 'audio';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface UserSession {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
  status?: string;
  phoneCountry?: string | null;
  phoneNumber?: string | null;
}

export interface Reminder {
  id: string;
  label: string;
  scheduledFor: string;
  status: ReminderStatus;
}

export interface MedicationSchedule {
  id: string;
  medicineName: string;
  scheduledTime: string;
  scheduledFor: string;
  isActive: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationReading extends Coordinates {
  accuracy: number | null;
  capturedAt: string;
}

export interface AppState {
  session: UserSession | null;
  reminders: Reminder[];
  alertStatus: AlertStatus | null;
}

export interface ApiResponse<T> {
  data: T;
  message: string;
}

export interface RelationshipMember {
  _id: string;
  full_name: string;
  email: string;
  role?: UserRole;
}

export interface CaregiverContact {
  id: string;
  name: string;
  email: string;
}

export interface PatientRelationshipGroup {
  caregiver?: RelationshipMember;
  patients: Array<{
    patient: RelationshipMember;
    family_members: RelationshipMember[];
  }>;
}

export interface ChatMessage {
  id: string;
  _id?: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: MessageType;
  file_url?: string | null;
  file_metadata?: Record<string, unknown> | null;
  status: MessageStatus;
  read_at?: string | null;
  is_deleted?: boolean;
  created_at: string;
  updated_at?: string | null;
}
