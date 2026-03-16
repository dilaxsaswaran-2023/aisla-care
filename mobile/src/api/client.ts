import {APP_CONFIG} from '../constants/config';
import type {
  ApiResponse,
  ChatMessage,
  LocationReading,
  PatientRelationshipGroup,
  Reminder,
  UserSession,
} from '../types/models';

type BackendLoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserSession['role'];
    status?: string;
    phone_country?: string | null;
    phone_number?: string | null;
  };
};

type BackendReminder = {
  id: string;
  title: string;
  scheduled_time: string;
  completed_at?: string | null;
};

type BackendRefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

type BackendPatientLocationResponse = {
  success: boolean;
  patient_id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

class ApiClient {
  readonly baseUrl = APP_CONFIG.apiBaseUrl;
  readonly socketUrl = APP_CONFIG.socketUrl;

  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private session: UserSession | null = null;
  private refreshRequest: Promise<void> | null = null;

  private createSession(data: BackendLoginResponse): UserSession {
    return {
      userId: data.user.id,
      email: data.user.email,
      displayName: data.user.full_name,
      role: data.user.role,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      status: data.user.status,
      phoneCountry: data.user.phone_country,
      phoneNumber: data.user.phone_number,
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    needsAuth = false,
    retryOnUnauthorized = needsAuth,
  ): Promise<T> {
    const headers = new Headers(init.headers ?? {});

    if (!headers.has('Content-Type') && init.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    if (needsAuth && this.accessToken) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (
      response.status === 401 &&
      needsAuth &&
      retryOnUnauthorized &&
      this.refreshToken
    ) {
      await this.refreshAccessToken();
      return this.request<T>(path, init, needsAuth, false);
    }

    if (!response.ok) {
      throw new Error(
        typeof data === 'object' &&
        data !== null &&
        'detail' in data &&
        typeof data.detail === 'string'
          ? data.detail
          : typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof data.error === 'string'
          ? data.error
          : `Request failed (${response.status})`,
      );
    }

    return data as T;
  }

  private applyTokenPair(tokens: BackendRefreshResponse): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;

    if (this.session) {
      this.session = {
        ...this.session,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No active session. Please sign in again.');
    }

    if (!this.refreshRequest) {
      const currentRefreshToken = this.refreshToken;

      this.refreshRequest = this.request<BackendRefreshResponse>(
        '/auth/refresh',
        {
          method: 'POST',
          body: JSON.stringify({refreshToken: currentRefreshToken}),
        },
        false,
        false,
      )
        .then(tokens => {
          this.applyTokenPair(tokens);
        })
        .catch(error => {
          this.clearSession();
          throw error;
        })
        .finally(() => {
          this.refreshRequest = null;
        });
    }

    await this.refreshRequest;
  }

  async login(email: string, password: string): Promise<UserSession> {
    const data = await this.request<BackendLoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({email, password}),
    });

    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    this.session = this.createSession(data);

    return this.session;
  }

  hydrateSession(session: UserSession): void {
    this.accessToken = session.accessToken;
    this.refreshToken = session.refreshToken;
    this.session = session;
  }

  async getCurrentUser(): Promise<UserSession> {
    const user = await this.request<BackendLoginResponse['user']>(
      '/auth/me',
      undefined,
      true,
    );

    if (!this.accessToken || !this.refreshToken) {
      throw new Error('No active session. Please sign in again.');
    }

    this.session = {
      userId: user.id,
      email: user.email,
      displayName: user.full_name,
      role: user.role,
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      status: user.status,
      phoneCountry: user.phone_country,
      phoneNumber: user.phone_number,
    };

    return this.session;
  }

  async logout(): Promise<void> {
    if (!this.refreshToken) {
      this.clearSession();
      return;
    }

    try {
      await this.request<{message: string}>(
        '/auth/logout',
        {
          method: 'POST',
          body: JSON.stringify({refreshToken: this.refreshToken}),
        },
        Boolean(this.accessToken),
      );
    } finally {
      this.clearSession();
    }
  }

  getSession(): UserSession | null {
    return this.session;
  }

  clearSession(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.session = null;
    this.refreshRequest = null;
  }

  async getReminders(): Promise<ApiResponse<Reminder[]>> {
    const reminders = await this.request<BackendReminder[]>(
      '/reminders/',
      undefined,
      true,
    );

    return {
      data: reminders.map(reminder => ({
        id: reminder.id,
        label: reminder.title,
        scheduledFor: reminder.scheduled_time,
        status: reminder.completed_at ? 'completed' : 'pending',
      })),
      message: `Loaded from ${this.baseUrl}`,
    };
  }

  async getRelationships(): Promise<PatientRelationshipGroup[]> {
    return this.request<PatientRelationshipGroup[]>(
      '/relationships/',
      undefined,
      true,
    );
  }

  async sendPatientLocation(
    location: LocationReading,
    patientId?: string,
  ): Promise<BackendPatientLocationResponse> {
    return this.request<BackendPatientLocationResponse>(
      '/gps/patient/location',
      {
        method: 'POST',
        body: JSON.stringify({
          patient_id: patientId,
          lat: location.latitude,
          lng: location.longitude,
          accuracy: location.accuracy,
          captured_at: location.capturedAt,
        }),
      },
      true,
    );
  }

  async getConversation(recipientId: string): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>(
      `/messages/${recipientId}`,
      undefined,
      true,
    );
  }

  async sendMessage(
    recipientId: string,
    content: string,
  ): Promise<ChatMessage> {
    return this.request<ChatMessage>(
      '/messages/',
      {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: recipientId,
          content,
          message_type: 'text',
        }),
      },
      true,
    );
  }

  async markMessageRead(messageId: string): Promise<ChatMessage> {
    return this.request<ChatMessage>(
      `/messages/${messageId}/read`,
      {
        method: 'PUT',
      },
      true,
    );
  }
}

export const apiClient = new ApiClient();
export {getErrorMessage};
