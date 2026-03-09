import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '@/lib/api';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5030';

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket || !_socket.connected) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
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
  onMessageStatus?: (data: { message_id: string; status: string }) => void;
  onMessagesRead?: (data: { message_ids: string[]; reader_id: string }) => void;
  onTyping?: (data: { user_id: string; is_typing: boolean }) => void;
  onUserOnline?: (data: { user_id: string }) => void;
  onUserOffline?: (data: { user_id: string }) => void;
}

export function useSocket({
  userId,
  onNewMessage,
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

    // Join the user's personal room
    socket.emit('join_room', userId);

    if (onNewMessage) socket.on('new_message', onNewMessage);
    if (onMessageStatus) socket.on('message_status', onMessageStatus);
    if (onMessagesRead) socket.on('messages_read', onMessagesRead);
    if (onTyping) socket.on('typing_indicator', onTyping);
    if (onUserOnline) socket.on('user_online', onUserOnline);
    if (onUserOffline) socket.on('user_offline', onUserOffline);

    return () => {
      if (onNewMessage) socket.off('new_message', onNewMessage);
      if (onMessageStatus) socket.off('message_status', onMessageStatus);
      if (onMessagesRead) socket.off('messages_read', onMessagesRead);
      if (onTyping) socket.off('typing_indicator', onTyping);
      if (onUserOnline) socket.off('user_online', onUserOnline);
      if (onUserOffline) socket.off('user_offline', onUserOffline);
    };
  }, [userId]);

  const sendMessage = useCallback(
    (data: {
      recipient_id: string;
      content: string;
      message_type?: 'text' | 'audio';
      file_url?: string;
      file_metadata?: Record<string, unknown>;
      sender_id: string;
    }) => {
      socketRef.current?.emit('send_message', data);
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

  return { sendMessage, sendTypingStart, sendTypingStop, sendMarkRead };
}
