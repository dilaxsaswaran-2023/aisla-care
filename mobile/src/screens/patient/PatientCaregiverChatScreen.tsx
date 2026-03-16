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
import type {ChatMessage, RelationshipMember} from '../../types/models';

const aislaLogo = require('../../assets/aisla-logo.png');

type PatientCaregiverChatScreenProps = {
  onBack: () => void;
};

type CaregiverContact = {
  id: string;
  name: string;
  email: string;
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

function extractCaregiver(
  relationships: Array<{
    caregiver?: RelationshipMember;
  }>,
): CaregiverContact | null {
  for (const relationship of relationships) {
    if (relationship.caregiver?._id) {
      return {
        id: relationship.caregiver._id,
        name: relationship.caregiver.full_name || 'Caregiver',
        email: relationship.caregiver.email || '',
      };
    }
  }

  return null;
}

export function PatientCaregiverChatScreen({
  onBack,
}: PatientCaregiverChatScreenProps): React.JSX.Element {
  const [caregiver, setCaregiver] = useState<CaregiverContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const scrollViewRef = useRef<ScrollView | null>(null);
  const session = apiClient.getSession();
  const userId = session?.userId ?? '';
  const quickReplies = useMemo(
    () => ['Please call me', 'I need help with my medicine', 'I am okay'],
    [],
  );

  useEffect(() => {
    loadChat();
  }, []);

  const loadChat = async () => {
    setIsLoading(true);
    setError('');

    try {
      const relationships = await apiClient.getRelationships();
      const nextCaregiver = extractCaregiver(relationships);

      setCaregiver(nextCaregiver);

      if (!nextCaregiver) {
        setMessages([]);
        return;
      }

      const conversation = await apiClient.getConversation(nextCaregiver.id);
      setMessages(conversation);

      const unreadMessages = conversation.filter(
        message =>
          message.sender_id === nextCaregiver.id && message.status !== 'read',
      );

      if (unreadMessages.length > 0) {
        Promise.allSettled(
          unreadMessages.map(message => apiClient.markMessageRead(message.id)),
        ).catch(() => undefined);

        setMessages(previousMessages =>
          previousMessages.map(message =>
            unreadMessages.some(
              unreadMessage => unreadMessage.id === message.id,
            )
              ? {...message, status: 'read'}
              : message,
          ),
        );
      }
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    const trimmedMessage = draft.trim();

    if (!trimmedMessage || !caregiver || !userId || isSending) {
      return;
    }

    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      sender_id: userId,
      recipient_id: caregiver.id,
      content: trimmedMessage,
      message_type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
    };

    setDraft('');
    setIsSending(true);
    setMessages(previousMessages => [...previousMessages, optimisticMessage]);

    try {
      const savedMessage = await apiClient.sendMessage(
        caregiver.id,
        trimmedMessage,
      );

      setMessages(previousMessages =>
        previousMessages.map(message =>
          message.id === optimisticMessage.id ? savedMessage : message,
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
              {getInitials(caregiver?.name ?? 'Caregiver')}
            </Text>
          </View>
        ) : null}

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

          <View style={styles.messageMetaRow}>
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
              <FeatherIcons
                color={
                  message.status === 'read'
                    ? '#D9F5FF'
                    : 'rgba(255,255,255,0.72)'
                }
                name={message.status === 'read' ? 'check-circle' : 'check'}
                size={12}
              />
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
          <Text style={styles.stateTitle}>Opening care chat</Text>
          <Text style={styles.stateBody}>
            Loading your caregiver connection and recent messages.
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

    if (!caregiver) {
      return (
        <View style={styles.statePanel}>
          <Image
            resizeMode="contain"
            source={aislaLogo}
            style={styles.emptyLogo}
          />
          <Text style={styles.stateTitle}>No caregiver connected yet</Text>
          <Text style={styles.stateBody}>
            Once a caregiver is assigned, your care chat will appear here.
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.heroCard}>
          <View style={styles.heroAvatar}>
            <Text style={styles.heroAvatarText}>
              {getInitials(caregiver.name)}
            </Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroLabel}>Care giver chat</Text>
            <Text style={styles.heroTitle}>{caregiver.name}</Text>
            <Text style={styles.heroBody}>
              AISLA mobile care chat keeps your caregiver one message away.
            </Text>
          </View>
          <View style={styles.heroStatusPill}>
            <View style={styles.heroStatusDot} />
            <Text style={styles.heroStatusText}>Active</Text>
          </View>
        </View>

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

          {messages.map(renderMessage)}
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
              onChangeText={setDraft}
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
            <Text style={styles.topBarEyebrow}>AISLA Mobile</Text>
            <Text style={styles.topBarTitle}>Care Chat</Text>
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
    paddingTop: 10,
    paddingBottom: 18,
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
    marginHorizontal: 16,
  },
  topBarEyebrow: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topBarTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 24,
    color: '#183A5A',
    letterSpacing: -0.6,
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
    gap: 16,
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEEF9',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  heroAvatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#DFF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 18,
    color: colors.primary,
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 21,
    color: '#17375A',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#648094',
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#EDF9F1',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  heroStatusText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
    color: '#339859',
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
  messageBubble: {
    maxWidth: '78%',
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
    lineHeight: 22,
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
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
  },
  messageTime: {
    fontSize: 11,
  },
  messageTimeIncoming: {
    color: '#7B92A6',
  },
  messageTimeOutgoing: {
    color: 'rgba(255,255,255,0.72)',
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
