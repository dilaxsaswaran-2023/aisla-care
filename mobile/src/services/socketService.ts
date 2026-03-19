import {io, type Socket} from 'socket.io-client';

import {APP_CONFIG} from '../constants/config';
import type {ChatMessage, MessageStatus} from '../types/models';

type SocketConnectOptions = {
  userId: string;
  accessToken?: string | null;
};

type SendMessagePayload = {
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type?: ChatMessage['message_type'];
  file_url?: string | null;
  file_metadata?: Record<string, unknown> | null;
};

type MessageStatusPayload = {
  message_id: string;
  status: MessageStatus;
};

type MessagesReadPayload = {
  message_ids: string[];
  reader_id: string;
};

type TypingIndicatorPayload = {
  user_id: string;
  is_typing: boolean;
};

type MarkReadPayload = {
  message_ids: string[];
  reader_id: string;
  sender_id: string;
};

type TypingPayload = {
  sender_id: string;
  recipient_id: string;
};

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;

  connect(options: SocketConnectOptions): Socket {
    if (this.socket && this.userId === options.userId) {
      if (!this.socket.connected) {
        this.socket.connect();
      }

      return this.socket;
    }

    this.disconnect();

    this.userId = options.userId;
    this.socket = io(APP_CONFIG.socketUrl, {
      autoConnect: false,
      auth: options.accessToken ? {token: options.accessToken} : undefined,
      reconnection: true,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join_room', options.userId);
    });

    this.socket.connect();
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.userId = null;
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }

  onConnect(listener: () => void): () => void {
    return this.attach('connect', listener);
  }

  onDisconnect(listener: () => void): () => void {
    return this.attach('disconnect', listener);
  }

  onNewMessage(listener: (message: ChatMessage) => void): () => void {
    return this.attach('new_message', listener);
  }

  onMessageStatus(
    listener: (payload: MessageStatusPayload) => void,
  ): () => void {
    return this.attach('message_status', listener);
  }

  onMessagesRead(listener: (payload: MessagesReadPayload) => void): () => void {
    return this.attach('messages_read', listener);
  }

  onTypingIndicator(
    listener: (payload: TypingIndicatorPayload) => void,
  ): () => void {
    return this.attach('typing_indicator', listener);
  }

  onMessageError(listener: (payload: {error?: string}) => void): () => void {
    return this.attach('message_error', listener);
  }

  async sendMessage(payload: SendMessagePayload): Promise<ChatMessage | null> {
    const socket = this.requireSocket();
    const response = await (socket
      .timeout(10_000)
      .emitWithAck('send_message', {
        ...payload,
        message_type: payload.message_type ?? 'text',
      }) as Promise<ChatMessage | ChatMessage[] | null | undefined>);

    if (Array.isArray(response)) {
      return response[0] ?? null;
    }

    return response ?? null;
  }

  markRead(payload: MarkReadPayload): void {
    this.socket?.emit('mark_read', payload);
  }

  startTyping(payload: TypingPayload): void {
    this.socket?.emit('typing_start', payload);
  }

  stopTyping(payload: TypingPayload): void {
    this.socket?.emit('typing_stop', payload);
  }

  private requireSocket(): Socket {
    if (!this.socket) {
      throw new Error('Socket connection is not ready.');
    }

    return this.socket;
  }

  private attach<EventPayload>(
    eventName: string,
    listener: (payload: EventPayload) => void,
  ): () => void {
    const socket = this.socket;
    if (!socket) {
      return () => undefined;
    }

    socket.on(eventName, listener);
    return () => {
      socket.off(eventName, listener);
    };
  }
}

export const socketService = new SocketService();
export type {
  MarkReadPayload,
  MessageStatusPayload,
  MessagesReadPayload,
  SendMessagePayload,
  TypingIndicatorPayload,
};
