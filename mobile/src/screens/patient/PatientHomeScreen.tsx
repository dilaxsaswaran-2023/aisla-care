import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import FeatherIcons from 'react-native-vector-icons/Feather';

import {colors} from '../../constants/colors';
import {audioService} from '../../services/audioService';
import {speechService} from '../../services/speechService';
import type {Reminder as AppReminder} from '../../types/models';

const appLogo = require('../../assets/aisla-logo.png');
const buddiBotIcon = require('../../assets/bot.png');
const themeBlue = '#177BC8';
const themeBlueSoft = '#EAF6FF';
const themeGreenSoft = '#1bcf03';
const themeRed = '#D93E32';
const themeRedSoft = '#FFF1EF';
const sosPrompt = 'Are you okay? What do you need?';
const budiiPrompt = "Hi, I'm Budii. Are you okay? What do you need?";
const reminderAlertLeadMs = 60_000;
const reminderAlertTrailMs = 60_000;
const reminderClockTickMs = 1_000;
const reminderAnnouncementIntervalMs = 30_000;
const sosCountdownDurationSeconds = 10;

type PatientHomeScreenProps = {
  onSignOut: () => Promise<void> | void;
  onOpenCaregiverChat: () => void;
  onSendSos: (payload: {
    message?: string;
    voiceTranscription?: string;
  }) => Promise<void> | void;
};

type SpeechResultsEvent = {
  value?: string[];
};

type SpeechErrorEvent = {
  error?: {
    code?: string | number;
    message?: string;
  };
};

type VoiceModule = {
  start: (locale: string, options?: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  destroy: () => Promise<void>;
  isAvailable: () => Promise<0 | 1>;
  removeAllListeners: () => void;
  onSpeechStart?: (event: {error?: boolean}) => void;
  onSpeechEnd?: (event: {error?: boolean}) => void;
  onSpeechError?: (event: SpeechErrorEvent) => void;
  onSpeechResults?: (event: SpeechResultsEvent) => void;
  onSpeechPartialResults?: (event: SpeechResultsEvent) => void;
};

type ReminderCardProps = {
  badge: string;
  title: string;
  time: string;
  description: string;
  alertMessage?: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
  completed?: boolean;
  alerting?: boolean;
  onPress?: () => void;
};

type DashboardTab = 'home' | 'reminders';
type VoiceSurface = 'sos' | 'buddi';

let cachedVoiceModule: VoiceModule | null = null;

function getVoiceModule(): VoiceModule | null {
  if (cachedVoiceModule) {
    return cachedVoiceModule;
  }

  try {
    cachedVoiceModule = require('@react-native-voice/voice')
      .default as VoiceModule;
    return cachedVoiceModule;
  } catch {
    return null;
  }
}

function getSpeechErrorMessage(event?: SpeechErrorEvent): string | null {
  const code = String(event?.error?.code ?? '').toLowerCase();
  const message = String(event?.error?.message ?? '').trim();
  const normalizedMessage = message.toLowerCase();
  const isNoMatchError =
    code.includes('no_match') ||
    code.includes('nomatch') ||
    code === '7' ||
    normalizedMessage.includes('no match');

  if (isNoMatchError) {
    return null;
  }

  return message || 'Speech recognition failed. Please try again.';
}

async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'AISLA needs microphone access to listen when you speak.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function getReminderTimestamp(scheduledFor: string): number | null {
  const scheduledAt = new Date(scheduledFor);

  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return scheduledAt.getTime();
}

function buildReminderDate(
  dayOffset: number,
  hour: number,
  minute: number,
): string {
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + dayOffset);
  scheduledAt.setHours(hour, minute, 0, 0);
  return scheduledAt.toISOString();
}

function formatReminderTime(scheduledFor: string): string {
  const scheduledAt = new Date(scheduledFor);

  if (Number.isNaN(scheduledAt.getTime())) {
    return scheduledFor;
  }

  const today = new Date();
  const isToday =
    scheduledAt.getFullYear() === today.getFullYear() &&
    scheduledAt.getMonth() === today.getMonth() &&
    scheduledAt.getDate() === today.getDate();

  if (isToday) {
    return `Today, ${scheduledAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;
  }

  return scheduledAt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatRemainingTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
}

function formatCountdownSeconds(seconds: number): string {
  return `00:${String(Math.max(0, seconds)).padStart(2, '0')}`;
}

function isReminderAlerting(
  reminder: AppReminder,
  currentTime: number,
): boolean {
  const scheduledTime = getReminderTimestamp(reminder.scheduledFor);

  if (scheduledTime === null || reminder.status === 'completed') {
    return false;
  }

  return (
    currentTime >= scheduledTime - reminderAlertLeadMs &&
    currentTime <= scheduledTime + reminderAlertTrailMs
  );
}

function getReminderAlertMeta(
  reminder: AppReminder,
  currentTime: number,
): string | null {
  const scheduledTime = getReminderTimestamp(reminder.scheduledFor);

  if (scheduledTime === null) {
    return null;
  }

  if (currentTime < scheduledTime) {
    return `Due in ${formatRemainingTime(scheduledTime - currentTime)}`;
  }

  const remainingWindowMs = scheduledTime + reminderAlertTrailMs - currentTime;

  if (remainingWindowMs > 0) {
    return `Alarm ends in ${formatRemainingTime(remainingWindowMs)}`;
  }

  return 'Alarm window ending';
}

function buildReminderAnnouncement(
  reminder: AppReminder,
  currentTime: number,
): string {
  const scheduledTime = getReminderTimestamp(reminder.scheduledFor);
  const title = reminder.label.trim() || 'Care reminder';

  if (scheduledTime === null) {
    return `Reminder. ${title}.`;
  }

  if (currentTime < scheduledTime) {
    return `Reminder. ${title}. This is due in less than one minute.`;
  }

  return `Reminder. ${title}. It is time now.`;
}

function getReminderBadge(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'RM';
  }

  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getReminderDescription(reminder: AppReminder): string {
  if (reminder.status === 'completed') {
    return 'This reminder has been completed and saved to your care log.';
  }

  return 'Scheduled care task from your AISLA reminders.';
}

const dummyReminders: AppReminder[] = [
  {
    id: 'reminder-breathing',
    label: 'Breathing exercise',
    scheduledFor: buildReminderDate(0, 18, 5),
    status: 'pending',
  },
  {
    id: 'reminder-hydration',
    label: 'Drink water',
    scheduledFor: buildReminderDate(0, 16, 50),
    status: 'pending',
  },
  {
    id: 'reminder-medication',
    label: 'Evening medication',
    scheduledFor: buildReminderDate(0, 18, 40),
    status: 'pending',
  },
  {
    id: 'reminder-checkin',
    label: 'Daily caregiver check-in',
    scheduledFor: buildReminderDate(1, 8, 30),
    status: 'pending',
  },
  {
    id: 'reminder-breakfast',
    label: 'Breakfast medication',
    scheduledFor: buildReminderDate(0, 7, 30),
    status: 'completed',
  },
];

function BrandHeader({
  onSignOut,
}: {
  onSignOut: () => Promise<void> | void;
}): React.JSX.Element {
  const handleSignOutPress = () => {
    Promise.resolve(onSignOut()).catch(() => undefined);
  };

  return (
    <View style={styles.topBar}>
      <View style={styles.brandRow}>
        <Image resizeMode="contain" source={appLogo} style={styles.logoImage} />
        <View>
          <Text style={styles.brandText}>AISLA Care</Text>
          <Text style={styles.brandSubtitle}>Elder dashboard</Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel="Sign out"
        accessibilityRole="button"
        onPress={handleSignOutPress}
        style={({pressed}) => [
          styles.signOutButton,
          pressed ? styles.pressed : null,
        ]}>
        <FeatherIcons color={themeBlue} name="log-out" size={22} />
      </Pressable>
    </View>
  );
}

function ReminderCard({
  badge,
  title,
  time,
  description,
  alertMessage,
  badgeBackgroundColor,
  badgeTextColor,
  completed,
  alerting,
  onPress,
}: ReminderCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({pressed}) => [
        styles.reminderCard,
        alerting ? styles.reminderCardAlerting : null,
        onPress && pressed ? styles.pressed : null,
      ]}>
      <View
        style={[
          styles.reminderBadge,
          {backgroundColor: badgeBackgroundColor},
          alerting ? styles.reminderBadgeAlerting : null,
        ]}>
        <Text style={[styles.reminderBadgeText, {color: badgeTextColor}]}>
          {badge}
        </Text>
      </View>

      <View style={styles.reminderBody}>
        <View style={styles.reminderHeaderRow}>
          <Text style={[styles.reminderTitle, styles.reminderTitleHeader]}>
            {title}
          </Text>
          <View
            style={[
              styles.reminderStatus,
              alerting
                ? styles.reminderStatusAlerting
                : completed
                ? styles.reminderStatusComplete
                : styles.reminderStatusPending,
            ]}>
            <Text
              style={[
                styles.reminderStatusText,
                alerting
                  ? styles.reminderStatusTextAlerting
                  : completed
                  ? styles.reminderStatusTextComplete
                  : styles.reminderStatusTextPending,
              ]}>
              {alerting ? 'Alarm active' : completed ? 'Completed' : 'Pending'}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.reminderTime,
            alerting ? styles.reminderTimeAlerting : null,
          ]}>
          {time}
        </Text>
        {alertMessage ? (
          <Text style={styles.reminderAlertMessage}>{alertMessage}</Text>
        ) : null}
        <Text style={styles.reminderDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

function BottomTabButton({
  active,
  icon,
  onPress,
}: {
  active: boolean;
  icon: 'home' | 'clipboard';
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.bottomTabButton,
        active ? styles.bottomTabButtonActive : null,
        pressed ? styles.pressed : null,
      ]}>
      <FeatherIcons
        color={active ? themeBlue : '#89A2B7'}
        name={icon}
        size={22}
      />
    </Pressable>
  );
}

function MicGlyph({active}: {active: boolean}): React.JSX.Element {
  return (
    <View style={styles.micGlyph}>
      <View
        style={[styles.micGlyphHead, active ? styles.micGlyphHeadActive : null]}
      />
      <View
        style={[styles.micGlyphStem, active ? styles.micGlyphStemActive : null]}
      />
      <View
        style={[styles.micGlyphBase, active ? styles.micGlyphBaseActive : null]}
      />
    </View>
  );
}

export function PatientHomeScreen({
  onSignOut,
  onOpenCaregiverChat,
  onSendSos,
}: PatientHomeScreenProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [activeVoiceSurface, setActiveVoiceSurface] =
    useState<VoiceSurface | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [sosError, setSosError] = useState('');
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [silencedReminderId, setSilencedReminderId] = useState<string | null>(
    null,
  );
  const [sosCountdownSeconds, setSosCountdownSeconds] = useState(
    sosCountdownDurationSeconds,
  );
  const [isSubmittingSos, setIsSubmittingSos] = useState(false);
  const [sosSuccessMessage, setSosSuccessMessage] = useState('');
  const sosRequestIdRef = useRef(0);
  const reminderFade = useRef(new Animated.Value(0)).current;
  const lastReminderAnnouncementRef = useRef<string | null>(null);
  const reminderAnnouncementInFlightRef = useRef(false);

  useEffect(() => {
    const voice = getVoiceModule();
    if (!voice) {
      return;
    }

    voice.onSpeechStart = () => {
      setIsListening(true);
      setSosError('');
      audioService.startRecording();
    };
    voice.onSpeechEnd = () => {
      setIsListening(false);
      audioService.stopRecording();
    };
    voice.onSpeechResults = event => {
      const nextTranscript = event.value?.join(' ').trim() ?? '';
      if (nextTranscript) {
        setTranscript(nextTranscript);
      }
    };
    voice.onSpeechPartialResults = event => {
      setPartialTranscript(event.value?.join(' ').trim() ?? '');
    };
    voice.onSpeechError = event => {
      const nextError = getSpeechErrorMessage(event);
      setIsListening(false);
      setSosError(nextError ?? '');
      audioService.stopRecording();
    };

    return () => {
      audioService.stopRecording();
      speechService.stop().catch(() => undefined);
      voice
        .destroy()
        .catch(() => undefined)
        .finally(() => {
          voice.removeAllListeners();
        });
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, reminderClockTickMs);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    return () => {
      Vibration.cancel();
      audioService.releaseAlarm().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (activeVoiceSurface !== 'sos') {
      setSosCountdownSeconds(sosCountdownDurationSeconds);
      return;
    }

    setSosCountdownSeconds(sosCountdownDurationSeconds);
    const timer = setInterval(() => {
      setSosCountdownSeconds(previousSeconds =>
        previousSeconds > 0 ? previousSeconds - 1 : 0,
      );
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, [activeVoiceSurface]);

  const prepareVoiceSurface = (surface: VoiceSurface) => {
    setActiveVoiceSurface(surface);
    setTranscript('');
    setPartialTranscript('');
    setSosError('');
  };

  const beginListening = async () => {
    const voice = getVoiceModule();

    await speechService.stop();

    if (!voice) {
      setSosError(
        'Speech recognition is not available yet. Rebuild the app after installing native dependencies.',
      );
      return;
    }

    const permissionGranted = await requestMicrophonePermission();

    if (!permissionGranted) {
      setSosError('Microphone permission is required to record your message.');
      return;
    }

    try {
      const available = await voice.isAvailable();
      if (!available) {
        setSosError('Speech recognition is not available on this device.');
        return;
      }

      setIsListening(true);
      audioService.startRecording();
      await voice.start('en-US', {
        EXTRA_PARTIAL_RESULTS: true,
        REQUEST_PERMISSIONS_AUTO: false,
      });
    } catch (error) {
      setIsListening(false);
      audioService.stopRecording();
      setSosError(
        error instanceof Error
          ? error.message
          : 'Unable to start speech recognition.',
      );
    }
  };

  const startVoiceFlow = async (surface: VoiceSurface) => {
    const requestId = sosRequestIdRef.current + 1;
    sosRequestIdRef.current = requestId;

    prepareVoiceSurface(surface);

    try {
      await speechService.speak(surface === 'sos' ? sosPrompt : budiiPrompt);
    } catch {
      // Fall through to voice capture even if TTS is unavailable.
    }

    if (requestId !== sosRequestIdRef.current) {
      return;
    }

    await beginListening();
  };

  const stopListening = async () => {
    const voice = getVoiceModule();
    if (!voice) {
      setIsListening(false);
      audioService.stopRecording();
      return;
    }

    try {
      await voice.stop();
    } catch (error) {
      setSosError(
        error instanceof Error
          ? error.message
          : 'Unable to stop speech recognition.',
      );
    } finally {
      setIsListening(false);
      audioService.stopRecording();
    }
  };

  const closeVoiceSurface = async () => {
    const voice = getVoiceModule();
    sosRequestIdRef.current += 1;

    await speechService.stop();

    if (voice) {
      try {
        await voice.cancel();
      } catch {
        // Ignore cancel errors if recognition is already stopped.
      }
    }

    setIsListening(false);
    setPartialTranscript('');
    audioService.stopRecording();
    setIsSubmittingSos(false);
    setSosSuccessMessage('');
    setActiveVoiceSurface(null);
  };

  const displayedTranscript = partialTranscript || transcript;
  const voiceReady = getVoiceModule() !== null;
  const sosSuggestions = [
    'I need help right now.',
    'Please alert my caregiver.',
    'I feel dizzy and need assistance.',
  ] as const;
  const reminders = dummyReminders;

  const applySuggestion = (suggestion: string) => {
    setTranscript(suggestion);
    setPartialTranscript('');
    setSosError('');
  };

  const sortedReminders = [...reminders].sort((left, right) => {
    const leftCompleted = left.status === 'completed';
    const rightCompleted = right.status === 'completed';

    if (leftCompleted !== rightCompleted) {
      return leftCompleted ? 1 : -1;
    }

    const leftTime =
      getReminderTimestamp(left.scheduledFor) ?? Number.MAX_SAFE_INTEGER;
    const rightTime =
      getReminderTimestamp(right.scheduledFor) ?? Number.MAX_SAFE_INTEGER;

    return leftTime - rightTime;
  });
  const activeAlertReminder =
    sortedReminders.find(
      reminder =>
        isReminderAlerting(reminder, currentTime) &&
        reminder.id !== silencedReminderId,
    ) ?? null;
  const upcomingReminder =
    sortedReminders.find(reminder => {
      if (reminder.status === 'completed') {
        return false;
      }

      const scheduledTime = getReminderTimestamp(reminder.scheduledFor);

      return scheduledTime !== null && scheduledTime >= currentTime;
    }) ?? sortedReminders.find(reminder => reminder.status !== 'completed');
  const highlightedReminder = activeAlertReminder ?? upcomingReminder;

  useEffect(() => {
    const silencedReminderStillAlerting = silencedReminderId
      ? sortedReminders.some(
          reminder =>
            reminder.id === silencedReminderId &&
            isReminderAlerting(reminder, currentTime),
        )
      : false;

    if (silencedReminderId && !silencedReminderStillAlerting) {
      setSilencedReminderId(null);
    }
  }, [currentTime, silencedReminderId, sortedReminders]);

  const silenceReminderAlert = (reminderId: string) => {
    setSilencedReminderId(reminderId);
    lastReminderAnnouncementRef.current = null;
    reminderAnnouncementInFlightRef.current = false;
    reminderFade.stopAnimation();
    reminderFade.setValue(0);
    Vibration.cancel();
    speechService.stop().catch(() => undefined);
    audioService.stopAlarm().catch(() => undefined);
  };

  const reminderCards = sortedReminders.map(reminder => {
    const isCardAlerting = activeAlertReminder?.id === reminder.id;

    return {
      id: reminder.id,
      badge: getReminderBadge(reminder.label),
      title: reminder.label,
      time: formatReminderTime(reminder.scheduledFor),
      description: isCardAlerting
        ? 'Alarm audio, blinking, and voice announcement are active for this reminder.'
        : getReminderDescription(reminder),
      alertMessage: isCardAlerting
        ? getReminderAlertMeta(reminder, currentTime) ?? undefined
        : undefined,
      badgeBackgroundColor:
        reminder.status === 'completed'
          ? themeGreenSoft
          : isCardAlerting
          ? themeRedSoft
          : themeBlueSoft,
      badgeTextColor:
        reminder.status === 'completed'
          ? '#3C7E18'
          : isCardAlerting
          ? themeRed
          : themeBlue,
      completed: reminder.status === 'completed',
      alerting: isCardAlerting,
      onPress: isCardAlerting
        ? () => silenceReminderAlert(reminder.id)
        : undefined,
    };
  });

  useEffect(() => {
    if (!activeAlertReminder) {
      reminderFade.stopAnimation();
      reminderFade.setValue(0);
      return;
    }

    reminderFade.setValue(0);
    const fadeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(reminderFade, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(reminderFade, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
    );

    fadeLoop.start();

    return () => {
      fadeLoop.stop();
      reminderFade.stopAnimation();
      reminderFade.setValue(0);
    };
  }, [activeAlertReminder, reminderFade]);

  useEffect(() => {
    if (!activeAlertReminder) {
      lastReminderAnnouncementRef.current = null;
      reminderAnnouncementInFlightRef.current = false;
      Vibration.cancel();
      audioService.stopAlarm().catch(() => undefined);
      return;
    }

    Vibration.cancel();
    Vibration.vibrate([0, 700, 400], true);
    audioService.startAlarm().catch(() => undefined);

    return () => {
      Vibration.cancel();
      audioService.stopAlarm().catch(() => undefined);
    };
  }, [activeAlertReminder]);

  useEffect(() => {
    if (!activeAlertReminder) {
      lastReminderAnnouncementRef.current = null;
      reminderAnnouncementInFlightRef.current = false;
      return;
    }

    if (activeVoiceSurface || isListening) {
      return;
    }

    const scheduledTime = getReminderTimestamp(
      activeAlertReminder.scheduledFor,
    );
    if (scheduledTime === null) {
      return;
    }

    const announcementSlot = Math.floor(
      Math.max(0, currentTime - (scheduledTime - reminderAlertLeadMs)) /
        reminderAnnouncementIntervalMs,
    );
    const announcementKey = `${activeAlertReminder.id}:${announcementSlot}`;

    if (
      lastReminderAnnouncementRef.current === announcementKey ||
      reminderAnnouncementInFlightRef.current
    ) {
      return;
    }

    lastReminderAnnouncementRef.current = announcementKey;
    reminderAnnouncementInFlightRef.current = true;
    speechService
      .speak(buildReminderAnnouncement(activeAlertReminder, currentTime))
      .catch(() => undefined)
      .finally(() => {
        reminderAnnouncementInFlightRef.current = false;
      });
  }, [activeAlertReminder, activeVoiceSurface, currentTime, isListening]);

  const fixedReminderLabel = activeAlertReminder
    ? 'Reminder alarm active'
    : 'Upcoming reminder';
  const fixedReminderMeta = highlightedReminder
    ? activeAlertReminder
      ? getReminderAlertMeta(highlightedReminder, currentTime) ??
        formatReminderTime(highlightedReminder.scheduledFor)
      : formatReminderTime(highlightedReminder.scheduledFor)
    : 'Check back later';
  const handleFixedReminderPress = () => {
    if (activeAlertReminder) {
      silenceReminderAlert(activeAlertReminder.id);
      return;
    }

    setActiveTab('reminders');
  };

  const openSosPrompt = () => {
    startVoiceFlow('sos').catch(() => undefined);
  };
  const openBudiiModal = () => {
    startVoiceFlow('buddi').catch(() => undefined);
  };
  const closeVoiceSurfaceSafely = () => {
    closeVoiceSurface().catch(() => undefined);
  };
  const handleMicPress = () => {
    if (isListening) {
      stopListening().catch(() => undefined);
      return;
    }

    beginListening().catch(() => undefined);
  };

  const submitSosAlert = async () => {
    if (isSubmittingSos) {
      return;
    }

    const message = displayedTranscript.trim();

    setIsSubmittingSos(true);
    setSosError('');
    setSosSuccessMessage('');

    try {
      await onSendSos({
        message: message || 'Patient triggered SOS button',
        voiceTranscription: message || undefined,
      });
      setSosSuccessMessage('SOS alert sent to your care team.');
      setTimeout(() => {
        closeVoiceSurface().catch(() => undefined);
      }, 1200);
    } catch (error) {
      setSosError(
        error instanceof Error
          ? error.message
          : 'Unable to send SOS alert right now.',
      );
    } finally {
      setIsSubmittingSos(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BrandHeader onSignOut={onSignOut} />

      <View style={styles.screenBody}>
        <View pointerEvents="box-none" style={styles.fixedSosContainer}>
          <Pressable
            accessibilityLabel={
              activeAlertReminder ? 'Silence reminder alarm' : 'Open reminders'
            }
            accessibilityRole="button"
            onPress={handleFixedReminderPress}
            style={({pressed}) => [
              styles.fixedReminderButton,
              activeAlertReminder ? styles.fixedReminderButtonAlerting : null,
              pressed ? styles.pressed : null,
            ]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.fixedReminderButtonFadeOverlay,
                activeAlertReminder
                  ? styles.fixedReminderButtonFadeOverlayAlerting
                  : null,
                {opacity: reminderFade},
              ]}
            />
            <View
              style={[
                styles.fixedReminderButtonIcon,
                activeAlertReminder
                  ? styles.fixedReminderButtonIconAlerting
                  : null,
              ]}>
              <FeatherIcons
                color={activeAlertReminder ? themeRed : themeBlue}
                name="bell"
                size={18}
              />
            </View>
            <View style={styles.fixedReminderButtonCopy}>
              <Text
                style={[
                  styles.fixedReminderButtonLabel,
                  activeAlertReminder
                    ? styles.fixedReminderButtonLabelAlerting
                    : null,
                ]}>
                {fixedReminderLabel}
              </Text>
              <Text numberOfLines={2} style={styles.fixedReminderButtonTitle}>
                {highlightedReminder?.label ?? 'No upcoming reminders'}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.fixedReminderButtonMeta,
                  activeAlertReminder
                    ? styles.fixedReminderButtonMetaAlerting
                    : null,
                ]}>
                {fixedReminderMeta}
              </Text>
            </View>
            <FeatherIcons color="#7A95AA" name="chevron-right" size={18} />
          </Pressable>

          <Pressable
            accessibilityLabel="Open SOS voice prompt"
            accessibilityRole="button"
            onPress={openSosPrompt}
            style={({pressed}) => [
              styles.topSosButton,
              pressed ? styles.pressed : null,
            ]}>
            <Text style={styles.topSosButtonText}>SOS</Text>
          </Pressable>
          {activeTab === 'reminders' ? (
            <View pointerEvents="none" style={styles.fixedReminderHeader}>
              <Text style={styles.sectionTitle}>Reminders</Text>
              <Text style={styles.sectionSubtitle}>
                Upcoming care tasks and completed check-ins.
              </Text>
            </View>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            activeTab === 'home' ? styles.homeContent : null,
            activeTab === 'reminders' ? styles.remindersContent : null,
          ]}
          scrollEnabled={activeTab === 'reminders'}
          showsVerticalScrollIndicator={activeTab === 'reminders'}>
          {activeTab === 'home' ? (
            <>
              <Pressable
                accessibilityLabel="Talk to Buddi"
                accessibilityRole="button"
                onPress={openBudiiModal}
                style={({pressed}) => [
                  styles.buddiActionButton,
                  voiceReady
                    ? styles.buddiActionButtonReady
                    : styles.buddiActionButtonOffline,
                  pressed ? styles.pressed : null,
                ]}>
                <View style={styles.buddiActionContent}>
                  <Image
                    resizeMode="contain"
                    source={buddiBotIcon}
                    style={styles.buddiActionIcon}
                  />
                  <Text style={styles.buddiActionTitle}>Talk to Buddi</Text>
                </View>
              </Pressable>

              <View style={styles.assuranceCard}>
                <Text style={styles.assuranceEyebrow}>Safety status</Text>
                <Text style={styles.assuranceTitle}>
                  You&apos;re safe and connected
                </Text>
                <Text style={styles.assuranceBody}>
                  Your caregiver near you.
                </Text>
                <Pressable
                  accessibilityLabel="Chat with Annie"
                  accessibilityRole="button"
                  onPress={onOpenCaregiverChat}
                  style={({pressed}) => [
                    styles.assuranceActionButton,
                    pressed ? styles.pressed : null,
                  ]}>
                  <FeatherIcons
                    color="#FFFFFF"
                    name="message-circle"
                    size={18}
                  />
                  <Text style={styles.assuranceActionText}>
                    Chat with Annie
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.remindersList}>
                {reminderCards.length > 0 ? (
                  reminderCards.map(item => (
                    <ReminderCard key={item.id} {...item} />
                  ))
                ) : (
                  <View style={styles.remindersEmptyState}>
                    <Text style={styles.remindersEmptyTitle}>
                      No reminders yet
                    </Text>
                    <Text style={styles.remindersEmptyBody}>
                      Add reminders to your care plan and they will appear here.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      <View style={styles.bottomTabBar}>
        <BottomTabButton
          active={activeTab === 'home'}
          icon="home"
          onPress={() => setActiveTab('home')}
        />
        <BottomTabButton
          active={activeTab === 'reminders'}
          icon="clipboard"
          onPress={() => setActiveTab('reminders')}
        />
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeVoiceSurfaceSafely}
        statusBarTranslucent
        transparent
        visible={activeVoiceSurface === 'sos'}>
        <Pressable
          onPress={closeVoiceSurfaceSafely}
          style={styles.modalBackdrop}>
          <Pressable onPress={() => {}} style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderSpacer} />
              <Text style={styles.modalCountdownText}>
                {formatCountdownSeconds(sosCountdownSeconds)}
              </Text>
              <Pressable
                onPress={closeVoiceSurfaceSafely}
                style={({pressed}) => [
                  styles.modalCloseButton,
                  pressed ? styles.pressed : null,
                ]}>
                <FeatherIcons color="#6A7E8F" name="x" size={22} />
              </Pressable>
            </View>

            <View style={styles.modalContentBlock}>
              <Text style={styles.modalTitle}>
                Are you okay? What do you need?
              </Text>
              {displayedTranscript || sosError ? (
                <Text
                  style={[
                    styles.sosTranscriptText,
                    sosError ? styles.transcriptError : null,
                  ]}>
                  {displayedTranscript || sosError}
                </Text>
              ) : null}
            </View>

            <View style={styles.modalMicDock}>
              <Text style={styles.modalMicLabel}>
                {isListening ? 'Listening now...' : 'Tap to start listening'}
              </Text>
              <View style={styles.modalMicHalo}>
                <Pressable
                  onPress={handleMicPress}
                  style={({pressed}) => [
                    styles.modalMicButton,
                    isListening ? styles.modalMicButtonActive : null,
                    pressed ? styles.pressed : null,
                  ]}>
                  <MicGlyph active={isListening} />
                </Pressable>
              </View>

              {sosSuccessMessage ? (
                <Text style={styles.sosSuccessText}>{sosSuccessMessage}</Text>
              ) : null}

              <Pressable
                disabled={isSubmittingSos}
                onPress={() => {
                  submitSosAlert().catch(() => undefined);
                }}
                style={({pressed}) => [
                  styles.sosSubmitButton,
                  isSubmittingSos ? styles.sosSubmitButtonDisabled : null,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.sosSubmitButtonText}>
                  {isSubmittingSos ? 'Sending...' : 'Send SOS Alert'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeVoiceSurfaceSafely}
        transparent
        visible={activeVoiceSurface === 'buddi'}>
        <Pressable
          onPress={closeVoiceSurfaceSafely}
          style={styles.buddiModalBackdrop}>
          <Pressable onPress={() => {}} style={styles.buddiModalSheet}>
            <View style={styles.buddiModalGlowPink} />
            <View style={styles.buddiModalGlowBlue} />

            <View style={styles.buddiModalHeaderRow}>
              <View style={styles.buddiModalHeaderSpacer} />
              <Pressable
                onPress={closeVoiceSurfaceSafely}
                style={({pressed}) => [
                  styles.buddiModalCloseButton,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.buddiModalCloseButtonText}>X</Text>
              </Pressable>
            </View>

            <View style={styles.buddiModalContentBlock}>
              <View style={styles.buddiModalHeader}>
                <Text style={styles.buddiModalTitle}>
                  Hi, how can I help you?
                </Text>
                <Text style={styles.buddiModalSubtitle}>
                  Suggestions on what to ask from AISLA Care
                </Text>
              </View>

              <View style={styles.buddiSuggestionList}>
                {sosSuggestions.map((suggestion, index) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => applySuggestion(suggestion)}
                    style={({pressed}) => [
                      styles.buddiSuggestionCard,
                      index === 0 ? styles.buddiSuggestionCardCompact : null,
                      pressed ? styles.pressed : null,
                    ]}>
                    <Text style={styles.buddiSuggestionCardText}>
                      {suggestion}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {displayedTranscript || sosError ? (
                <View style={styles.buddiTranscriptCard}>
                  <Text
                    style={[
                      styles.transcriptText,
                      sosError ? styles.transcriptError : null,
                    ]}>
                    {displayedTranscript || sosError}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.buddiModalMicDock}>
              <Text style={styles.buddiModalMicLabel}>
                {isListening ? 'Listening now...' : 'Tap to start listening'}
              </Text>
              <View style={styles.buddiModalMicHalo}>
                <Pressable
                  onPress={handleMicPress}
                  style={({pressed}) => [
                    styles.modalMicButton,
                    isListening ? styles.modalMicButtonActive : null,
                    pressed ? styles.pressed : null,
                  ]}>
                  <MicGlyph active={isListening} />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FBFD',
  },
  topBar: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: '#F8FBFD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 45,
    height: 45,
  },
  brandText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 21,
    color: '#17375A',
    // letterSpacing: -0.6,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#5B7691',
    marginTop: -6,
  },
  signOutButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenBody: {
    flex: 1,
    position: 'relative',
  },
  content: {
    paddingHorizontal: 24,
    gap: 18,
  },
  homeContent: {
    paddingTop: 375,
    paddingBottom: 12,
  },
  remindersContent: {
    paddingTop: 490,
    paddingBottom: 120,
  },
  fixedSosContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  fixedReminderButton: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    marginBottom: 16,
    minHeight: 82,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7EBF7',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  fixedReminderButtonAlerting: {
    borderColor: '#F1B7B1',
    backgroundColor: '#FFF8F7',
    shadowColor: '#8A2D24',
    shadowOpacity: 0.18,
  },
  fixedReminderButtonFadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: themeBlueSoft,
  },
  fixedReminderButtonFadeOverlayAlerting: {
    backgroundColor: '#FFD7D2',
    borderWidth: 1,
    borderColor: '#F1B7B1',
  },
  fixedReminderButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: themeBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedReminderButtonIconAlerting: {
    backgroundColor: themeRedSoft,
  },
  fixedReminderButtonCopy: {
    flex: 1,
    gap: 2,
  },
  fixedReminderButtonLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 11,
    color: themeBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fixedReminderButtonLabelAlerting: {
    color: themeRed,
  },
  fixedReminderButtonTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    lineHeight: 20,
    color: '#17375A',
  },
  fixedReminderButtonMeta: {
    fontSize: 13,
    color: '#6A7E8F',
  },
  fixedReminderButtonMetaAlerting: {
    color: '#B4372A',
  },
  fixedReminderHeader: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 4,
  },
  bottomTabBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#F8FBFD',
    borderTopWidth: 1,
    borderTopColor: '#D8ECFA',
  },
  bottomTabButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabButtonActive: {
    opacity: 1,
  },
  topSosButton: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 1000,
    backgroundColor: themeRed,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7A1F17',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 8,
  },
  topSosButtonText: {
    fontFamily: 'Poppins-ExtraBold',
    color: '#FFFFFF',
    fontSize: 54,
    letterSpacing: -0.4,
  },
  buddiActionButton: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiActionButtonReady: {
    backgroundColor: themeBlue,
  },
  buddiActionButtonOffline: {
    backgroundColor: '#7A2430',
  },
  buddiActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  buddiActionIcon: {
    width: 30,
    height: 30,
  },
  buddiActionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    paddingTop: 9,
  },
  sectionTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 25,
    color: '#17375A',
    letterSpacing: -0.8,
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6A7E8F',
  },
  remindersList: {
    gap: 12,
  },
  remindersEmptyState: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCEEF8',
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 6,
  },
  remindersEmptyTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 17,
    color: '#17375A',
  },
  remindersEmptyBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#678196',
  },
  reminderCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3EEF6',
    shadowColor: '#274A67',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 3,
  },
  reminderCardAlerting: {
    borderColor: '#F0B2AA',
    backgroundColor: '#FFF8F7',
    shadowColor: '#8A2D24',
    shadowOpacity: 0.14,
  },
  reminderBadge: {
    width: 70,
    height: 70,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBadgeAlerting: {
    borderWidth: 1,
    borderColor: '#F0B2AA',
  },
  reminderBadgeText: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 18,
  },
  reminderBody: {
    flex: 1,
    gap: 4,
  },
  reminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reminderStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reminderStatusPending: {
    backgroundColor: themeBlueSoft,
  },
  reminderStatusComplete: {
    backgroundColor: themeGreenSoft,
  },
  reminderStatusAlerting: {
    backgroundColor: '#FDE2DE',
  },
  reminderStatusText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 12,
  },
  reminderStatusTextPending: {
    color: themeBlue,
  },
  reminderStatusTextComplete: {
    color: '#FFFFFF',
  },
  reminderStatusTextAlerting: {
    color: themeRed,
  },
  reminderTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 19,
    lineHeight: 24,
    color: '#17375A',
    letterSpacing: -0.4,
  },
  reminderTitleHeader: {
    flex: 1,
    marginRight: 8,
  },
  reminderTime: {
    fontSize: 14,
    color: '#6A7E8F',
  },
  reminderTimeAlerting: {
    color: '#B4372A',
  },
  reminderAlertMessage: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: themeRed,
  },
  reminderDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: '#567185',
  },
  assuranceCard: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: '#EEF8FF',
    borderWidth: 1,
    borderColor: '#D4EBFA',
    gap: 8,
  },
  assuranceEyebrow: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
    color: themeBlue,
  },
  assuranceTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 23,
    lineHeight: 28,
    color: '#17375A',
    letterSpacing: -0.7,
  },
  assuranceBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#567185',
  },
  assuranceActionButton: {
    alignSelf: 'flex-end',
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#17375A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assuranceActionText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(241, 247, 251, 0.82)',
  },
  modalSheet: {
    flex: 1,
    justifyContent: 'space-between',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  modalHeaderSpacer: {
    width: 42,
    height: 42,
  },
  modalCountdownText: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 45,
    color: themeRed,
    letterSpacing: -0.4,
  },
  modalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.66)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContentBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 24,
  },
  modalTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 32,
    lineHeight: 42,
    color: '#17375A',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  transcriptText: {
    fontSize: 18,
    lineHeight: 29,
    color: '#17375A',
    textAlign: 'left',
  },
  sosTranscriptText: {
    marginTop: 20,
    fontSize: 18,
    lineHeight: 28,
    color: '#17375A',
    textAlign: 'center',
  },
  transcriptError: {
    color: themeRed,
  },
  transcriptPlaceholder: {
    color: '#93A8B7',
  },
  modalMicDock: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 56,
    paddingTop: 20,
    gap: 12,
  },
  modalMicLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#567185',
  },
  modalMicHalo: {
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMicButton: {
    width: 55,
    height: 55,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F7C7C1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  modalMicButtonActive: {
    backgroundColor: '#FFF3F1',
    borderColor: themeRed,
  },
  buddiModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 40, 57, 0.42)',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 18,
  },
  buddiModalSheet: {
    position: 'relative',
    backgroundColor: '#F5EEF8',
    borderRadius: 32,
    minHeight: '88%',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  buddiModalGlowPink: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 197, 222, 0.44)',
    left: -40,
    bottom: -88,
  },
  buddiModalGlowBlue: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(188, 211, 255, 0.44)',
    right: -72,
    bottom: -120,
  },
  buddiModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  buddiModalHeaderSpacer: {
    width: 42,
    height: 42,
  },
  buddiModalCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiModalCloseButtonText: {
    fontFamily: 'Poppins-Medium',
    color: '#6A7E8F',
    fontSize: 20,
  },
  buddiModalContentBlock: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  buddiModalHeader: {
    gap: 14,
  },
  buddiModalTitle: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 26,
    lineHeight: 34,
    color: '#17375A',
    letterSpacing: -0.6,
  },
  buddiModalSubtitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    lineHeight: 25,
    color: '#6A7E8F',
  },
  sosSubmitButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D93E32',
    paddingHorizontal: 18,
  },
  sosSubmitButtonDisabled: {
    opacity: 0.65,
  },
  sosSubmitButtonText: {
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
    fontSize: 15,
  },
  sosSuccessText: {
    marginTop: 12,
    color: '#1D7A28',
    fontSize: 14,
    textAlign: 'center',
  },
  buddiSuggestionList: {
    marginTop: 26,
    gap: 14,
  },
  buddiSuggestionCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3EAF1',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  buddiSuggestionCardCompact: {
    width: '58%',
  },
  buddiSuggestionCardText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    lineHeight: 25,
    color: '#1E2B38',
  },
  buddiTranscriptCard: {
    marginTop: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D8ECFA',
    backgroundColor: 'rgba(255,255,255,0.78)',
    paddingHorizontal: 20,
    paddingVertical: 24,
    minHeight: 130,
    justifyContent: 'flex-start',
  },
  buddiModalMicDock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 20,
    gap: 14,
  },
  buddiModalMicHalo: {
    width: 78,
    height: 78,
    borderRadius: 999,
    backgroundColor: 'rgba(235, 200, 226, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddiModalMicLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#567185',
  },
  micGlyph: {
    width: 14,
    alignItems: 'center',
  },
  micGlyphHead: {
    width: 10,
    height: 14,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: themeRed,
  },
  micGlyphHeadActive: {
    borderColor: '#B9291E',
  },
  micGlyphStem: {
    width: 2,
    height: 8,
    backgroundColor: themeRed,
    borderRadius: 999,
  },
  micGlyphStemActive: {
    backgroundColor: '#B9291E',
  },
  micGlyphBase: {
    width: 10,
    height: 2,
    borderRadius: 999,
    backgroundColor: themeRed,
    marginTop: 2,
  },
  micGlyphBaseActive: {
    backgroundColor: '#B9291E',
  },
  pressed: {
    opacity: 0.85,
  },
});
