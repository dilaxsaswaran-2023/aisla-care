import {APP_CONFIG} from '../constants/config';
import type {ApiResponse, Reminder} from '../types/models';

const mockReminders: Reminder[] = [
  {
    id: 'reminder-1',
    label: 'Morning medication',
    scheduledFor: '2026-03-09T08:30:00.000Z',
    status: 'pending',
  },
  {
    id: 'reminder-2',
    label: 'Hydration check',
    scheduledFor: '2026-03-09T10:00:00.000Z',
    status: 'pending',
  },
];

class ApiClient {
  readonly baseUrl = APP_CONFIG.apiBaseUrl;

  async getReminders(): Promise<ApiResponse<Reminder[]>> {
    return {
      data: mockReminders,
      message: `Using mock data from ${this.baseUrl}`,
    };
  }
}

export const apiClient = new ApiClient();
