import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '@/lib/api';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5030';

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket || !_socket.connected) {
    const token = getToken();
    _socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      auth: token ? { token } : undefined,
    });
  }
  return _socket;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: 'text' | 'audio';
  file_url?: string | null;
  file_metadata?: Record<string, unknown> | null;
  status: 'sent' | 'delivered' | 'read';
  read_at?: string | null;
  is_deleted?: boolean;
  created_at: string;
}

interface UseSocketOptions {
  userId: string | null;
  onNewMessage?: (msg: ChatMessage) => void;
  onChatNotification?: (data: {
    sender_id: string;
    recipient_id: string;
    content: string;
    message_type: 'text' | 'audio';
    created_at?: string;
  }) => void;
  onMessageStatus?: (data: { message_id: string; status: string }) => void;
  onMessagesRead?: (data: { message_ids: string[]; reader_id: string }) => void;
  onTyping?: (data: { user_id: string; is_typing: boolean }) => void;
  onUserOnline?: (data: { user_id: string }) => void;
  onUserOffline?: (data: { user_id: string }) => void;
}

export function useSocket({
  userId,
  onNewMessage,
  onChatNotification,
  onMessageStatus,
  onMessagesRead,
  onTyping,
  onUserOnline,
  onUserOffline,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const socket = getSocket();
    socketRef.current = socket;

    const joinOwnRoom = () => {
      socket.emit('join_room', userId);
    };

    // Join the user's personal room
    joinOwnRoom();
    socket.on('connect', joinOwnRoom);

    if (onNewMessage) socket.on('new_message', onNewMessage);
    if (onChatNotification) socket.on('chat_notification', onChatNotification);
    if (onMessageStatus) socket.on('message_status', onMessageStatus);
    if (onMessagesRead) socket.on('messages_read', onMessagesRead);
    if (onTyping) socket.on('typing_indicator', onTyping);
    if (onUserOnline) socket.on('user_online', onUserOnline);
    if (onUserOffline) socket.on('user_offline', onUserOffline);

    return () => {
      socket.off('connect', joinOwnRoom);
      if (onNewMessage) socket.off('new_message', onNewMessage);
      if (onChatNotification) socket.off('chat_notification', onChatNotification);
      if (onMessageStatus) socket.off('message_status', onMessageStatus);
      if (onMessagesRead) socket.off('messages_read', onMessagesRead);
      if (onTyping) socket.off('typing_indicator', onTyping);
      if (onUserOnline) socket.off('user_online', onUserOnline);
      if (onUserOffline) socket.off('user_offline', onUserOffline);
    };
  }, [
    userId,
    onNewMessage,
    onChatNotification,
    onMessageStatus,
    onMessagesRead,
    onTyping,
    onUserOnline,
    onUserOffline,
  ]);

  const sendMessage = useCallback(
    (data: {
      recipient_id: string;
      content: string;
      message_type?: 'text' | 'audio';
      file_url?: string;
      file_metadata?: Record<string, unknown>;
      sender_id: string;
    }): Promise<ChatMessage | null> => {
      return new Promise((resolve) => {
        if (!socketRef.current) {
          resolve(null);
          return;
        }
        socketRef.current.emit('send_message', data, (response?: ChatMessage) => {
          resolve(response ?? null);
        });
      });
    },
    []
  );

  const sendTypingStart = useCallback((senderId: string, recipientId: string) => {
    socketRef.current?.emit('typing_start', { sender_id: senderId, recipient_id: recipientId });
  }, []);

  const sendTypingStop = useCallback((senderId: string, recipientId: string) => {
    socketRef.current?.emit('typing_stop', { sender_id: senderId, recipient_id: recipientId });
  }, []);

  const sendMarkRead = useCallback(
    (messageIds: string[], readerId: string, senderId: string) => {
      socketRef.current?.emit('mark_read', {
        message_ids: messageIds,
        reader_id: readerId,
        sender_id: senderId,
      });
    },
    []
  );

  const getUserOnlineStatus = useCallback((targetUserId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }
      socketRef.current.emit(
        'get_user_online_status',
        { user_id: targetUserId },
        (response?: { online?: boolean }) => resolve(Boolean(response?.online))
      );
    });
  }, []);

  return { sendMessage, sendTypingStart, sendTypingStop, sendMarkRead, getUserOnlineStatus };
}
