import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Mic, MicOff, Phone, Check, CheckCheck, Circle, Trash2, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSocket, ChatMessage } from '@/hooks/useSocket';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5030';

interface ChatInterfaceProps {
  recipientId: string;
  recipientName: string;
}

type RecordingState = 'idle' | 'recording' | 'uploading';

const MessageStatus = ({ status, isSender }: { status: string; isSender: boolean }) => {
  if (!isSender) return null;
  if (status === 'read') return <CheckCheck className="w-3 h-3 text-blue-400 inline ml-1" />;
  if (status === 'delivered') return <CheckCheck className="w-3 h-3 opacity-60 inline ml-1" />;
  return <Check className="w-3 h-3 opacity-60 inline ml-1" />;
};

const AudioPlayer = ({ url, metadata }: { url: string; metadata?: Record<string, unknown> | null }) => {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio controls src={fullUrl} className="h-8 max-w-[220px]" preload="metadata" />
      {metadata?.duration && (
        <span className="text-xs opacity-70">{Math.round(Number(metadata.duration))}s</span>
      )}
    </div>
  );
};

const ChatInterface = ({ recipientId, recipientName }: ChatInterfaceProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Socket callbacks ─────────────────────────────────────────────────────
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (
      (msg.sender_id === recipientId && msg.recipient_id === user?.id) ||
      (msg.sender_id === user?.id && msg.recipient_id === recipientId)
    ) {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }
  }, [recipientId, user?.id]);

  const handleMessageStatus = useCallback(
    ({ message_id, status }: { message_id: string; status: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message_id ? { ...m, status: status as ChatMessage['status'] } : m))
      );
    },
    []
  );

  const handleMessagesRead = useCallback(
    ({ message_ids }: { message_ids: string[]; reader_id: string }) => {
      setMessages((prev) =>
        prev.map((m) => (message_ids.includes(m.id) ? { ...m, status: 'read' } : m))
      );
    },
    []
  );

  const handleTyping = useCallback(
    ({ user_id, is_typing }: { user_id: string; is_typing: boolean }) => {
      if (user_id === recipientId) setIsTyping(is_typing);
    },
    [recipientId]
  );

  const handleUserOnline = useCallback(
    ({ user_id }: { user_id: string }) => {
      if (user_id === recipientId) setIsRecipientOnline(true);
    },
    [recipientId]
  );

  const handleUserOffline = useCallback(
    ({ user_id }: { user_id: string }) => {
      if (user_id === recipientId) setIsRecipientOnline(false);
    },
    [recipientId]
  );

  const { sendMessage, sendTypingStart, sendTypingStop, sendMarkRead } = useSocket({
    userId: user?.id || null,
    onNewMessage: handleNewMessage,
    onMessageStatus: handleMessageStatus,
    onMessagesRead: handleMessagesRead,
    onTyping: handleTyping,
    onUserOnline: handleUserOnline,
    onUserOffline: handleUserOffline,
  });

  // ── Load history on mount / recipient change ─────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadMessages();
  }, [user, recipientId]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Mark incoming messages as read when conversation is open ─────────────
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const unread = messages
      .filter((m) => m.sender_id === recipientId && m.status !== 'read')
      .map((m) => m.id);
    if (unread.length > 0) {
      sendMarkRead(unread, user.id, recipientId);
      // Also persist via REST
      unread.forEach((id) => api.put(`/messages/${id}/read`).catch(() => {}));
    }
  }, [messages, user, recipientId]);

  const loadMessages = async () => {
    if (!user) return;
    try {
      const data = (await api.get(`/messages/${recipientId}`)) as ChatMessage[];
      setMessages(data || []);
    } catch {
      console.error('Error loading messages');
    }
  };

  // ── Text sending ─────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!newMessage.trim() || !user) return;
    setLoading(true);

    // Optimistic message
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      sender_id: user.id,
      recipient_id: recipientId,
      content: newMessage,
      message_type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const messageContent = newMessage;
    setNewMessage('');
    setLoading(false);

    // Send via Socket.IO (real-time + persistent)
    sendMessage({
      sender_id: user.id,
      recipient_id: recipientId,
      content: messageContent,
      message_type: 'text',
    });
  };

  // ── Typing indicators ────────────────────────────────────────────────────
  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (!user) return;
    sendTypingStart(user.id, recipientId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTypingStop(user.id, recipientId), 1500);
  };

  // ── Audio recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(blob);
      };

      mr.start(250);
      setRecordingState('recording');
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: 'Microphone access denied', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setRecordingState('uploading');
  };

  const uploadAudio = async (blob: Blob) => {
    if (!user) return;
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('recipient_id', recipientId);
    try {
      const res = (await api.postForm('/messages/upload-audio', form)) as ChatMessage;
      setMessages((prev) => [...prev, res]);
    } catch {
      toast({ title: 'Failed to send audio', variant: 'destructive' });
    } finally {
      setRecordingState('idle');
      setRecordingSeconds(0);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    try {
      await api.delete(`/messages/${msgId}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      toast({ title: 'Failed to delete message', variant: 'destructive' });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-care-border">
      {/* Header */}
      <div className="p-4 border-b border-care-border bg-gradient-to-r from-primary/5 to-primary-glow/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{recipientName}</h3>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Circle
                className={`w-2 h-2 fill-current ${isRecipientOnline ? 'text-green-500' : 'text-gray-400'}`}
              />
              {isRecipientOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast({ title: 'Voice Call', description: 'Voice calling coming soon' })}>
            <Phone className="w-4 h-4 mr-2" />
            Call
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isSender = message.sender_id === user?.id;
            return (
              <div key={message.id} className={`flex group ${isSender ? 'justify-end' : 'justify-start'}`}>
                <div className="flex items-end gap-1">
                  {/* Delete button (sender only) */}
                  {isSender && (
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                      title="Delete message"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}

                  <div
                    className={`max-w-[70%] p-3 rounded-2xl ${
                      isSender
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.message_type === 'audio' && message.file_url ? (
                      <AudioPlayer url={message.file_url} metadata={message.file_metadata} />
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <MessageStatus status={message.status} isSender={isSender} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted px-4 py-2 rounded-2xl text-sm text-muted-foreground italic">
                {recipientName} is typing…
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="p-4 border-t border-care-border">
        {recordingState === 'recording' && (
          <div className="flex items-center gap-2 mb-2 text-sm text-red-500">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Recording… {recordingSeconds}s
          </div>
        )}
        {recordingState === 'uploading' && (
          <div className="text-xs text-muted-foreground mb-2">Uploading audio…</div>
        )}
        <div className="flex gap-2">
          {/* Mic / Stop recording */}
          <Button
            variant={recordingState === 'recording' ? 'destructive' : 'outline'}
            size="icon"
            onClick={recordingState === 'recording' ? stopRecording : startRecording}
            disabled={recordingState === 'uploading'}
            title={recordingState === 'recording' ? 'Stop recording' : 'Record audio'}
          >
            {recordingState === 'recording' ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>

          <Input
            value={newMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message…"
            disabled={loading || recordingState !== 'idle'}
          />
          <Button onClick={handleSend} disabled={loading || !newMessage.trim() || recordingState !== 'idle'}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
