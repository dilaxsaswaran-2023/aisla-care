export type UserRole = 'elderly' | 'caregiver';
export type ReminderStatus = 'pending' | 'completed' | 'skipped';
export type AlertStatus = 'triggered' | 'acknowledged' | 'resolved';

export interface UserSession {
  userId: string;
  displayName: string;
  role: UserRole;
}

export interface Reminder {
  id: string;
  label: string;
  scheduledFor: string;
  status: ReminderStatus;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
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
