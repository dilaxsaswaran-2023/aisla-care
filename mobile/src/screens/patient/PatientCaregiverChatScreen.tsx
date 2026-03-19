import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import FeatherIcons from 'react-native-vector-icons/Feather';

import {apiClient, getErrorMessage} from '../../api/client';
import {colors} from '../../constants/colors';
import type {
  CaregiverContact,
  ChatMessage,
} from '../../types/models';
import {socketService} from '../../services/socketService';

const aislaLogo = require('../../assets/aisla-logo.png');

type PatientCaregiverChatScreenProps = {
  caregiver: CaregiverContact;
  onBack: () => void;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'CG';
  }

  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ChatMessage>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.sender_id === 'string' &&
    typeof candidate.recipient_id === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.message_type === 'string' &&
    typeof candidate.status === 'string' &&
    typeof candidate.created_at === 'string'
  );
}

function isOptimisticMessage(message: ChatMessage): boolean {
  return message.id.startsWith('local-');
}

function findOptimisticMatchIndex(
  messages: ChatMessage[],
  nextMessage: ChatMessage,
): number {
  const nextCreatedAt = new Date(nextMessage.created_at).getTime();

  return messages.findIndex(message => {
    if (!isOptimisticMessage(message)) {
      return false;
    }

    const existingCreatedAt = new Date(message.created_at).getTime();
    const timestampsAreClose =
      Number.isNaN(nextCreatedAt) ||
      Number.isNaN(existingCreatedAt) ||
      Math.abs(existingCreatedAt - nextCreatedAt) <= 15_000;

    return (
      message.sender_id === nextMessage.sender_id &&
      message.recipient_id === nextMessage.recipient_id &&
      message.content === nextMessage.content &&
      message.message_type === nextMessage.message_type &&
      timestampsAreClose
    );
  });
}

function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  const uniqueMessages = new Map<string, ChatMessage>();

  messages.filter(isChatMessage).forEach(message => {
    const key = message._id ?? message.id;
    uniqueMessages.set(key, message);
  });

  return [...uniqueMessages.values()].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();

    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return 0;
    }

    return leftTime - rightTime;
  });
}

function upsertMessage(
  messages: ChatMessage[],
  nextMessage: ChatMessage,
): ChatMessage[] {
  if (!isChatMessage(nextMessage)) {
    return sortMessages(messages);
  }

  const messageIndex = messages.findIndex(
    message =>
      message.id === nextMessage.id ||
      (message._id && nextMessage._id && message._id === nextMessage._id),
  );

  if (messageIndex !== -1) {
    return sortMessages(
      messages.map((message, index) =>
        index === messageIndex ? nextMessage : message,
      ),
    );
  }

  const optimisticMessageIndex = findOptimisticMatchIndex(messages, nextMessage);

  if (optimisticMessageIndex !== -1) {
    return sortMessages(
      messages.map((message, index) =>
        index === optimisticMessageIndex ? nextMessage : message,
      ),
    );
  }

  return sortMessages([...messages, nextMessage]);
}

function applyMessageStatus(
  messages: ChatMessage[],
  messageIds: string[],
  status: ChatMessage['status'],
): ChatMessage[] {
  if (messageIds.length === 0) {
    return messages;
  }

  const messageIdSet = new Set(messageIds);
  return messages.filter(isChatMessage).map(message =>
    messageIdSet.has(message.id) ? {...message, status} : message,
  );
}

export function PatientCaregiverChatScreen({
  caregiver,
  onBack,
}: PatientCaregiverChatScreenProps): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isCaregiverTyping, setIsCaregiverTyping] = useState(false);
  const [error, setError] = useState('');
  const scrollViewRef = useRef<ScrollView | null>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const session = apiClient.getSession();
  const userId = session?.userId ?? '';
  const quickReplies = useMemo(
    () => ['Please call me', 'I need help with my medicine', 'I am okay'],
    [],
  );
  const caregiverId = caregiver.id;
  const caregiverName = caregiver.name;

  useEffect(() => {
    if (!userId) {
      setError('No active session. Please sign in again.');
      setIsLoading(false);
      return;
    }

    socketService.connect({
      userId,
      accessToken: session?.accessToken ?? null,
    });

    const removeConnectListener = socketService.onConnect(() => {
      setError('');
    });
    const removeDisconnectListener = socketService.onDisconnect(() => {
      setIsCaregiverTyping(false);
    });
    const removeNewMessageListener = socketService.onNewMessage(nextMessage => {
      if (!isChatMessage(nextMessage)) {
        if (__DEV__) {
          console.warn('Socket new_message payload invalid.', nextMessage);
        }
        return;
      }

      if (!belongsToConversation(nextMessage)) {
        return;
      }

      setMessages(previousMessages =>
        upsertMessage(previousMessages, nextMessage),
      );
      if (nextMessage.sender_id === caregiverId) {
        setIsCaregiverTyping(false);
        markMessagesRead([nextMessage]);
      }
    });
    const removeMessageStatusListener = socketService.onMessageStatus(
      payload => {
        if (!payload?.message_id || !payload.status) {
          return;
        }

        setMessages(previousMessages =>
          applyMessageStatus(previousMessages, [payload.message_id], payload.status),
        );
      },
    );
    const removeMessagesReadListener = socketService.onMessagesRead(payload => {
      if (
        !payload ||
        !Array.isArray(payload.message_ids) ||
        payload.reader_id !== caregiverId
      ) {
        return;
      }

      setMessages(previousMessages =>
        applyMessageStatus(previousMessages, payload.message_ids, 'read'),
      );
    });
    const removeTypingListener = socketService.onTypingIndicator(payload => {
      if (payload?.user_id === caregiverId) {
        setIsCaregiverTyping(payload.is_typing);
      }
    });
    const removeMessageErrorListener = socketService.onMessageError(payload => {
      if (payload.error) {
        Alert.alert('Chat connection error', payload.error);
      }
    });

    loadChat().catch(() => undefined);

    return () => {
      clearTypingStopTimeout();
      socketService.stopTyping({
        sender_id: userId,
        recipient_id: caregiverId ?? '',
      });
      removeConnectListener();
      removeDisconnectListener();
      removeNewMessageListener();
      removeMessageStatusListener();
      removeMessagesReadListener();
      removeTypingListener();
      removeMessageErrorListener();
      socketService.disconnect();
    };
  }, [caregiverId, session?.accessToken, userId]);

  const clearTypingStopTimeout = () => {
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
  };

  const belongsToConversation = (message: ChatMessage): boolean => {
    if (!caregiverId) {
      return false;
    }

    const participantIds = [message.sender_id, message.recipient_id];
    return participantIds.includes(userId) && participantIds.includes(caregiverId);
  };

  const markMessagesRead = (nextMessages: ChatMessage[]): void => {
    if (!caregiverId) {
      return;
    }

    const unreadMessageIds = nextMessages
      .filter(
        message =>
          message.sender_id === caregiverId &&
          message.recipient_id === userId &&
          message.status !== 'read',
      )
      .map(message => message.id);

    if (unreadMessageIds.length === 0) {
      return;
    }

    setMessages(previousMessages =>
      applyMessageStatus(previousMessages, unreadMessageIds, 'read'),
    );
    socketService.markRead({
      message_ids: unreadMessageIds,
      reader_id: userId,
      sender_id: caregiverId,
    });
  };

  const loadChat = async () => {
    setIsLoading(true);
    setError('');

    try {
      const conversation = await apiClient.getConversation(caregiverId);
      const unreadMessages = conversation.filter(message => {
        return (
          message.sender_id === caregiverId &&
          message.recipient_id === userId &&
          message.status !== 'read'
        );
      });
      const unreadMessageIds = unreadMessages.map(message => message.id);
      const nextMessages = sortMessages(
        applyMessageStatus(conversation, unreadMessageIds, 'read'),
      );

      setMessages(nextMessages);
      if (unreadMessageIds.length > 0) {
        socketService.markRead({
          message_ids: unreadMessageIds,
          reader_id: userId,
          sender_id: caregiverId,
        });
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmedMessage = draft.trim();

    if (!trimmedMessage || !caregiverId || !userId || isSending) {
      return;
    }

    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      sender_id: userId,
      recipient_id: caregiverId,
      content: trimmedMessage,
      message_type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
    };

    setDraft('');
    clearTypingStopTimeout();
    socketService.stopTyping({
      sender_id: userId,
      recipient_id: caregiverId,
    });
    setIsSending(true);
    setMessages(previousMessages => [...previousMessages, optimisticMessage]);

    try {
      const savedMessage = socketService.isConnected()
        ? await socketService.sendMessage({
            sender_id: userId,
            recipient_id: caregiverId,
            content: trimmedMessage,
            message_type: 'text',
          })
        : await apiClient.sendMessage(caregiverId, trimmedMessage);

      if (!isChatMessage(savedMessage)) {
        if (__DEV__) {
          console.warn('Socket send_message ack invalid.', savedMessage);
        }
        await loadChat();
        return;
      }

      setMessages(previousMessages =>
        upsertMessage(
          previousMessages.filter(message => message.id !== optimisticMessage.id),
          savedMessage,
        ),
      );
    } catch (nextError) {
      setMessages(previousMessages =>
        previousMessages.filter(message => message.id !== optimisticMessage.id),
      );
      setDraft(trimmedMessage);
      Alert.alert('Unable to send message', getErrorMessage(nextError));
    } finally {
      setIsSending(false);
    }
  };
  const handleRetryPress = () => {
    loadChat().catch(() => undefined);
  };
  const handleDraftChange = (value: string) => {
    setDraft(value);

    if (!userId || !caregiverId) {
      return;
    }

    clearTypingStopTimeout();
    if (!value.trim()) {
      socketService.stopTyping({
        sender_id: userId,
        recipient_id: caregiverId,
      });
      return;
    }

    socketService.startTyping({
      sender_id: userId,
      recipient_id: caregiverId,
    });
    typingStopTimeoutRef.current = setTimeout(() => {
      typingStopTimeoutRef.current = null;
      socketService.stopTyping({
        sender_id: userId,
        recipient_id: caregiverId,
      });
    }, 1_200);
  };
  const handleSendPress = () => {
    handleSend().catch(() => undefined);
  };

  const renderMessage = (message: ChatMessage) => {
    const isOutgoing = message.sender_id === userId;

    return (
      <View
        key={message.id}
        style={[
          styles.messageRow,
          isOutgoing ? styles.messageRowOutgoing : styles.messageRowIncoming,
        ]}>
        {!isOutgoing ? (
          <View style={styles.messageAvatar}>
            <Text style={styles.messageAvatarText}>
              {getInitials(caregiver.name)}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.messageContent,
            isOutgoing
              ? styles.messageContentOutgoing
              : styles.messageContentIncoming,
          ]}>
          <View
            style={[
              styles.messageBubble,
              isOutgoing
                ? styles.messageBubbleOutgoing
                : styles.messageBubbleIncoming,
            ]}>
            {message.message_type === 'audio' ? (
              <View style={styles.audioMessageRow}>
                <FeatherIcons
                  color={isOutgoing ? '#FFFFFF' : colors.primary}
                  name="mic"
                  size={16}
                />
                <Text
                  style={[
                    styles.audioMessageText,
                    isOutgoing
                      ? styles.audioMessageTextOutgoing
                      : styles.audioMessageTextIncoming,
                  ]}>
                  Voice message
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.messageText,
                  isOutgoing
                    ? styles.messageTextOutgoing
                    : styles.messageTextIncoming,
                ]}>
                {message.content}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.messageMetaRow,
              isOutgoing
                ? styles.messageMetaRowOutgoing
                : styles.messageMetaRowIncoming,
            ]}>
            <Text
              style={[
                styles.messageTime,
                isOutgoing
                  ? styles.messageTimeOutgoing
                  : styles.messageTimeIncoming,
              ]}>
              {formatMessageTime(message.created_at)}
            </Text>
            {isOutgoing ? (
              <>
                <Text
                  style={[
                    styles.messageStatusText,
                    message.status === 'read'
                      ? styles.messageStatusTextRead
                      : styles.messageStatusTextPending,
                  ]}>
                  {message.status === 'read' ? 'Seen' : 'Sent'}
                </Text>
                <FeatherIcons
                  color={
                    message.status === 'read'
                      ? colors.primary
                      : '#89A9BF'
                  }
                  name={message.status === 'read' ? 'check-circle' : 'check'}
                  size={12}
                />
              </>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.statePanel}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.stateTitle}>Loading chat...</Text>
          <Text style={styles.stateBody}>
            Loading your caregiver and messages.
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.statePanel}>
          <Text style={styles.stateTitle}>Unable to load chat</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <Pressable
            accessibilityLabel="Retry chat loading"
            accessibilityRole="button"
            onPress={handleRetryPress}
            style={({pressed}) => [
              styles.retryButton,
              pressed ? styles.pressed : null,
            ]}>
            <FeatherIcons color="#FFFFFF" name="refresh-cw" size={16} />
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({animated: true});
          }}
          showsVerticalScrollIndicator={false}
          style={styles.messagesScroll}>
            {messages.length === 0 ? (
            <View style={styles.emptyConversationCard}>
              <Text style={styles.emptyConversationTitle}>Start the chat</Text>
              <Text style={styles.emptyConversationBody}>
                Send a message to your caregiver and keep your updates in one
                place.
              </Text>
            </View>
          ) : null}

          {messages.filter(isChatMessage).map(renderMessage)}
        </ScrollView>

        <View style={styles.quickReplyRow}>
          {quickReplies.map(reply => (
            <Pressable
              key={reply}
              accessibilityLabel={reply}
              accessibilityRole="button"
              onPress={() => setDraft(reply)}
              style={({pressed}) => [
                styles.quickReplyChip,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={styles.quickReplyText}>{reply}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.composerShell}>
          <View style={styles.composerCard}>
            <TextInput
              multiline
              onChangeText={handleDraftChange}
              placeholder="Type a message to your caregiver"
              placeholderTextColor="#87A0B4"
              style={styles.messageInput}
              value={draft}
            />
            <Pressable
              accessibilityLabel="Send message"
              accessibilityRole="button"
              disabled={!draft.trim() || isSending}
              onPress={handleSendPress}
              style={({pressed}) => [
                styles.sendButton,
                !draft.trim() || isSending ? styles.sendButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}>
              {isSending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <FeatherIcons color="#FFFFFF" name="send" size={18} />
              )}
            </Pressable>
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardArea}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back to home"
            accessibilityRole="button"
            onPress={onBack}
            style={({pressed}) => [
              styles.backButton,
              pressed ? styles.pressed : null,
            ]}>
            <FeatherIcons color={colors.text} name="arrow-left" size={20} />
          </Pressable>

          <View style={styles.topBarCopy}>
            <Text style={styles.topBarTitle}>{caregiverName}</Text>
            <View style={styles.topBarStatusRow}>
              <View style={styles.topBarStatusDot} />
              <Text style={styles.topBarStatusText}>
                {isCaregiverTyping ? 'Typing...' : 'Active'}
              </Text>
            </View>
          </View>

          <View style={styles.logoBadge}>
            <Image
              resizeMode="contain"
              source={aislaLogo}
              style={styles.logoImage}
            />
          </View>
        </View>

        <View style={styles.screenBody}>{renderBody()}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5FBFF',
  },
  keyboardArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#F5FBFF',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  topBarCopy: {
    flex: 1,
    marginHorizontal: 12,
  },
  topBarTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 24,
    color: '#183A5A',
    letterSpacing: -0.6,
  },
  topBarStatusRow: {
    marginTop: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topBarStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  topBarStatusText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    color: '#339859',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  logoImage: {
    width: 34,
    height: 34,
  },
  screenBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 12,
  },
  statePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  stateTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#17375A',
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#678196',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  emptyLogo: {
    width: 82,
    height: 82,
    opacity: 0.95,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingTop: 16,
    paddingBottom: 10,
    gap: 14,
  },
  emptyConversationCard: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#E2F0F8',
  },
  emptyConversationTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#17375A',
  },
  emptyConversationBody: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    color: '#688295',
  },
  messageRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  messageRowIncoming: {
    justifyContent: 'flex-start',
  },
  messageRowOutgoing: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#DFF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAvatarText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: colors.primary,
  },
  messageContent: {
    maxWidth: '78%',
  },
  messageContentIncoming: {
    alignItems: 'flex-start',
  },
  messageContentOutgoing: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageBubbleIncoming: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 10,
    borderWidth: 1,
    borderColor: '#DBEEF9',
  },
  messageBubbleOutgoing: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 10,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 15,
  },
  messageTextIncoming: {
    color: '#17375A',
  },
  messageTextOutgoing: {
    color: '#FFFFFF',
  },
  audioMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioMessageText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  audioMessageTextIncoming: {
    color: colors.primary,
  },
  audioMessageTextOutgoing: {
    color: '#FFFFFF',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  messageMetaRowIncoming: {
    justifyContent: 'flex-start',
  },
  messageMetaRowOutgoing: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageTime: {
    fontSize: 11,
  },
  messageTimeIncoming: {
    color: '#7B92A6',
  },
  messageTimeOutgoing: {
    color: '#7B92A6',
  },
  messageStatusText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 11,
  },
  messageStatusTextPending: {
    color: '#7B92A6',
  },
  messageStatusTextRead: {
    color: colors.primary,
  },
  quickReplyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  quickReplyChip: {
    borderRadius: 999,
    backgroundColor: '#EAF6FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickReplyText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    color: colors.primary,
  },
  composerShell: {
    paddingBottom: Platform.OS === 'ios' ? 8 : 0,
  },
  composerCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#D7EBF7',
    paddingLeft: 18,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  messageInput: {
    flex: 1,
    maxHeight: 120,
    fontSize: 15,
    lineHeight: 22,
    color: '#17375A',
    paddingVertical: 0,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B5D9ED',
  },
  pressed: {
    opacity: 0.85,
  },
});
