import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  type ViewStyle,
  View,
} from 'react-native';

import {colors} from '../../constants/colors';
import {audioService} from '../../services/audioService';

type Role = 'admin' | 'caregiver' | 'family' | 'patient';
type ScreenId = 'landing' | 'auth' | Role;
type PortalCardData = {
  role: Role;
  title: string;
  description: string;
  badge: string;
  tone: 'info' | 'success' | 'warning';
};
type NavItem = {
  label: string;
  badge: string;
  active?: boolean;
};
type CardTone = 'info' | 'success' | 'warning' | 'danger';
type SpeechResultsEvent = {
  value?: string[];
};
type SpeechErrorEvent = {
  error?: {
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

let cachedVoiceModule: VoiceModule | null = null;

function getVoiceModule(): VoiceModule | null {
  if (cachedVoiceModule) {
    return cachedVoiceModule;
  }

  try {
    cachedVoiceModule = require('@react-native-voice/voice').default as VoiceModule;
    return cachedVoiceModule;
  } catch {
    return null;
  }
}

const portalCards: PortalCardData[] = [
  {
    role: 'admin',
    title: 'Admin',
    description: 'System configuration, user management & audit logs',
    badge: 'SH',
    tone: 'warning',
  },
  {
    role: 'caregiver',
    title: 'Caregiver',
    description: 'Monitor patients, manage alerts, coordinate care plans',
    badge: 'CG',
    tone: 'info',
  },
  {
    role: 'family',
    title: 'Family',
    description: 'View patient status, location & caregiver updates',
    badge: 'FA',
    tone: 'info',
  },
  {
    role: 'patient',
    title: 'Patient',
    description: 'Access help, reminders, Budii AI assistant & SOS',
    badge: 'PT',
    tone: 'success',
  },
];

const drawerItems: Record<Exclude<Role, 'patient'>, NavItem[]> = {
  admin: [
    {label: 'Overview', badge: 'OV', active: true},
    {label: 'Users', badge: 'US'},
    {label: 'Relationships', badge: 'RE'},
    {label: 'Monitoring', badge: 'MO'},
    {label: 'Consent', badge: 'CO'},
    {label: 'Audit Logs', badge: 'AL'},
  ],
  caregiver: [
    {label: 'Overview', badge: 'OV', active: true},
    {label: 'Patients', badge: 'PT'},
    {label: 'Messages', badge: 'MS'},
    {label: 'Devices', badge: 'DV'},
    {label: 'Location', badge: 'LO'},
    {label: 'Tasks', badge: 'TK'},
    {label: 'Alerts', badge: 'AR'},
  ],
  family: [
    {label: 'Status', badge: 'ST', active: true},
    {label: 'Location', badge: 'LO'},
    {label: 'Messages', badge: 'MS'},
  ],
};

function toneBackground(tone: CardTone): string {
  if (tone === 'success') {
    return colors.successSoft;
  }

  if (tone === 'warning') {
    return colors.warningSoft;
  }

  if (tone === 'danger') {
    return colors.dangerSoft;
  }

  return colors.infoSoft;
}

function toneBorder(tone: CardTone): string {
  if (tone === 'success') {
    return colors.successBorder;
  }

  if (tone === 'warning') {
    return colors.warningBorder;
  }

  if (tone === 'danger') {
    return colors.dangerSoft;
  }

  return colors.infoBorder;
}

function toneText(tone: CardTone): string {
  if (tone === 'success') {
    return colors.success;
  }

  if (tone === 'warning') {
    return colors.warning;
  }

  if (tone === 'danger') {
    return colors.danger;
  }

  return colors.info;
}

function getSpeechErrorMessage(event?: SpeechErrorEvent): string {
  return event?.error?.message ?? 'Speech recognition failed. Please try again.';
}

async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'AISLA needs microphone access to capture your emergency message.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function Brand({roleLabel}: {roleLabel?: string}): React.JSX.Element {
  return (
    <View style={styles.brand}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>A</Text>
      </View>
      <View>
        <Text style={styles.brandTitle}>AISLA</Text>
        {roleLabel ? <Text style={styles.brandRole}>{roleLabel}</Text> : null}
      </View>
    </View>
  );
}

function TopBar({
  rightLabel,
  onRightPress,
}: {
  rightLabel: string;
  onRightPress: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.topBar}>
      <Brand />
      <Pressable
        onPress={onRightPress}
        style={({pressed}) => [
          styles.topAction,
          pressed ? styles.pressed : null,
        ]}>
        <Text style={styles.topActionText}>{rightLabel}</Text>
      </Pressable>
    </View>
  );
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <View style={[styles.card, style]}>{children}</View>;
}

function PortalTile({
  portal,
  onPress,
}: {
  portal: PortalCardData;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.portalTile, pressed ? styles.pressed : null]}>
      <View
        style={[
          styles.portalBadgeBox,
          {backgroundColor: toneBackground(portal.tone)},
        ]}>
        <Text style={[styles.portalBadgeText, {color: toneText(portal.tone)}]}>
          {portal.badge}
        </Text>
      </View>
      <Text style={styles.portalTileTitle}>{portal.title}</Text>
      <Text style={styles.portalTileBody}>{portal.description}</Text>
      <Text style={styles.portalTileLink}>Open portal</Text>
    </Pressable>
  );
}

function AuthField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedSoft}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.primaryButton,
        pressed ? styles.pressed : null,
      ]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
      <Text style={styles.primaryButtonArrow}>{'->'}</Text>
    </Pressable>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  badge,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  badge: string;
  tone: CardTone;
}): React.JSX.Element {
  return (
    <Card>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryLabel}>{label}</Text>
        <View
          style={[
            styles.summaryBadge,
            {backgroundColor: toneBackground(tone)},
          ]}>
          <Text style={[styles.summaryBadgeText, {color: toneText(tone)}]}>
            {badge}
          </Text>
        </View>
      </View>
      <Text style={[styles.summaryValue, {color: toneText(tone)}]}>{value}</Text>
      <Text style={styles.summaryHint}>{hint}</Text>
    </Card>
  );
}

function ActionRow({
  badge,
  title,
  description,
}: {
  badge: string;
  title: string;
  description: string;
}): React.JSX.Element {
  return (
    <Pressable style={({pressed}) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={styles.actionLeft}>
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{badge}</Text>
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionBody}>{description}</Text>
        </View>
      </View>
      <Text style={styles.actionChevron}>{'>'}</Text>
    </Pressable>
  );
}

function ReminderRow({
  title,
  time,
  description,
  completed,
}: {
  title: string;
  time: string;
  description: string;
  completed?: boolean;
}): React.JSX.Element {
  const tone: CardTone = completed ? 'success' : 'warning';

  return (
    <View
      style={[
        styles.reminderRow,
        {
          backgroundColor: toneBackground(tone),
          borderColor: toneBorder(tone),
        },
      ]}>
      <View style={styles.reminderIcon}>
        <Text style={[styles.reminderIconText, {color: toneText(tone)}]}>
          {completed ? 'OK' : 'AL'}
        </Text>
      </View>
      <View style={styles.reminderCopy}>
        <Text
          style={[
            styles.reminderTitle,
            completed ? styles.reminderTitleDone : null,
          ]}>
          {title}
        </Text>
        <Text style={styles.reminderTime}>{time}</Text>
        <Text style={styles.reminderBody}>{description}</Text>
      </View>
      {!completed ? (
        <View style={styles.doneButton}>
          <Text style={styles.doneButtonText}>Done</Text>
        </View>
      ) : null}
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Card>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

function DrawerScreen({
  roleLabel,
  title,
  subtitle,
  items,
  action,
  onHome,
  onSignOut,
  children,
}: {
  roleLabel: string;
  title: string;
  subtitle: string;
  items: NavItem[];
  action?: string;
  onHome: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const {width} = useWindowDimensions();
  const [open, setOpen] = useState(true);
  const drawerWidth = Math.min(width * 0.78, 320);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.drawerRoot}>
        <ScrollView contentContainerStyle={styles.drawerContent}>
          {!open ? (
            <Pressable
              onPress={() => setOpen(true)}
              style={({pressed}) => [
                styles.drawerMenuButton,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={styles.drawerMenuText}>Menu</Text>
            </Pressable>
          ) : null}

          <View style={styles.screenHeader}>
            <View style={styles.screenHeaderCopy}>
              <Text style={styles.screenTitle}>{title}</Text>
              <Text style={styles.screenSubtitle}>{subtitle}</Text>
            </View>
            {action ? (
              <Pressable
                onPress={() => setOpen(false)}
                style={({pressed}) => [
                  styles.headerButton,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.headerButtonText}>{action}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.screenBody}>{children}</View>
        </ScrollView>

        {open ? <Pressable style={styles.scrim} onPress={() => setOpen(false)} /> : null}

        <View
          style={[
            styles.drawerPanel,
            {
              width: drawerWidth,
              transform: [{translateX: open ? 0 : -drawerWidth}],
            },
          ]}>
          <View style={styles.drawerHeader}>
            <Brand roleLabel={roleLabel} />
          </View>
          <View style={styles.drawerBody}>
            <Text style={styles.drawerLabel}>Navigation</Text>
            <View style={styles.drawerList}>
              {items.map(item => (
                <View
                  key={item.label}
                  style={[
                    styles.drawerItem,
                    item.active ? styles.drawerItemActive : null,
                  ]}>
                  <View
                    style={[
                      styles.drawerItemBadge,
                      item.active ? styles.drawerItemBadgeActive : null,
                    ]}>
                    <Text
                      style={[
                        styles.drawerItemBadgeText,
                        item.active ? styles.drawerItemBadgeTextActive : null,
                      ]}>
                      {item.badge}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.drawerItemText,
                      item.active ? styles.drawerItemTextActive : null,
                    ]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.drawerFooter}>
            <Pressable
              onPress={onHome}
              style={({pressed}) => [
                styles.drawerFooterButton,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={styles.drawerFooterText}>Home</Text>
            </Pressable>
            <Pressable
              onPress={onSignOut}
              style={({pressed}) => [
                styles.drawerFooterButton,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={styles.drawerFooterText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>

        {open ? (
          <Pressable
            onPress={() => setOpen(false)}
            style={[styles.drawerToggle, {left: drawerWidth - 22}]}>
            <Text style={styles.drawerToggleText}>{'<'}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function LandingScreen({
  onSignIn,
  onSelectPortal,
}: {
  onSignIn: () => void;
  onSelectPortal: (role: Role) => void;
}): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar rightLabel="Sign In" onRightPress={onSignIn} />
      <ScrollView contentContainerStyle={styles.landingContent}>
        <View style={styles.hero}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>
              Integrated Supporting Living Assistant
            </Text>
          </View>
          <Text style={styles.heroTitle}>
            Compassionate care, powered by technology
          </Text>
          <Text style={styles.heroBody}>
            Select your portal below to access real-time monitoring,
            communication, and AI-powered support.
          </Text>
        </View>

        <View style={styles.portalList}>
          {portalCards.map(portal => (
            <PortalTile
              key={portal.role}
              portal={portal}
              onPress={() => onSelectPortal(portal.role)}
            />
          ))}
        </View>

        <Text style={styles.footerNote}>
          Secure access for admins, caregivers, families, and patients.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AuthScreen({
  role,
  onBack,
  onSubmit,
}: {
  role: Role;
  onBack: () => void;
  onSubmit: () => void;
}): React.JSX.Element {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const selected = portalCards.find(portal => portal.role === role) ?? portalCards[3];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.authContent}>
        <Brand />

        <View style={styles.authCopy}>
          <Text style={styles.authTitle}>
            {signup ? 'Create your account' : 'Welcome back'}
          </Text>
          <Text style={styles.authBody}>
            {signup
              ? 'Get started with your care dashboard'
              : 'Sign in to access your care dashboard'}
          </Text>
          <View
            style={[
              styles.portalContext,
              {backgroundColor: toneBackground(selected.tone)},
            ]}>
            <Text
              style={[
                styles.portalContextText,
                {color: toneText(selected.tone)},
              ]}>
              {selected.title} portal
            </Text>
          </View>
        </View>

        <Card style={styles.formCard}>
          {signup ? (
            <AuthField
              label="Full Name"
              placeholder="Your full name"
              value={name}
              onChangeText={setName}
            />
          ) : null}
          <AuthField
            label="Email"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
          />
          <AuthField
            label="Password"
            placeholder="********"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <PrimaryButton
            label={signup ? 'Create Account' : 'Sign In'}
            onPress={onSubmit}
          />
        </Card>

        <Pressable
          onPress={() => setSignup(value => !value)}
          style={({pressed}) => [pressed ? styles.pressed : null]}>
          <Text style={styles.switchText}>
            {signup ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.switchAccent}>
              {signup ? 'Sign in' : 'Sign up'}
            </Text>
          </Text>
        </Pressable>

        <Pressable
          onPress={onBack}
          style={({pressed}) => [
            styles.secondaryButton,
            pressed ? styles.pressed : null,
          ]}>
          <Text style={styles.secondaryButtonText}>Back to portals</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function AdminScreen({
  onHome,
  onSignOut,
}: {
  onHome: () => void;
  onSignOut: () => void;
}): React.JSX.Element {
  return (
    <DrawerScreen
      roleLabel="Admin"
      title="Admin Overview"
      subtitle="System health and user statistics"
      items={drawerItems.admin}
      onHome={onHome}
      onSignOut={onSignOut}>
      <SummaryCard
        label="Caregivers"
        value="0"
        hint="Click to view"
        badge="CG"
        tone="info"
      />
      <SummaryCard
        label="Patients"
        value="0"
        hint="Click to view"
        badge="PT"
        tone="success"
      />
      <SummaryCard
        label="Family Members"
        value="0"
        hint="Click to view"
        badge="FM"
        tone="info"
      />
      <SummaryCard
        label="System Health"
        value="Good"
        hint="Click to view"
        badge="OK"
        tone="success"
      />
    </DrawerScreen>
  );
}

function CaregiverScreen({
  onHome,
  onSignOut,
}: {
  onHome: () => void;
  onSignOut: () => void;
}): React.JSX.Element {
  return (
    <DrawerScreen
      roleLabel="Caregiver"
      title="Overview"
      subtitle="Real-time snapshot of your care operations"
      items={drawerItems.caregiver}
      action="Alerts"
      onHome={onHome}
      onSignOut={onSignOut}>
      <SummaryCard
        label="Active Patients"
        value="0"
        hint="No patients assigned"
        badge="PT"
        tone="info"
      />
      <SummaryCard
        label="Active Alerts"
        value="1"
        hint="Requires attention"
        badge="AL"
        tone="warning"
      />
      <SummaryCard
        label="Budii Interactions"
        value="12"
        hint="Today"
        badge="AI"
        tone="success"
      />
      <SummaryCard
        label="Connected Devices"
        value="8"
        hint="All active"
        badge="DV"
        tone="info"
      />
      <Section title="Recent Alerts">
        <View style={styles.alertRow}>
          <Text style={styles.alertTitle}>Medication check-in missed</Text>
          <Text style={styles.alertMeta}>2 mins ago</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.alertRow}>
          <Text style={styles.alertTitle}>Kitchen motion detected</Text>
          <Text style={styles.alertMeta}>12 mins ago</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.alertRow}>
          <Text style={styles.alertTitle}>GPS device battery low</Text>
          <Text style={styles.alertMeta}>28 mins ago</Text>
        </View>
      </Section>
    </DrawerScreen>
  );
}

function FamilyScreen({
  onHome,
  onSignOut,
}: {
  onHome: () => void;
  onSignOut: () => void;
}): React.JSX.Element {
  return (
    <DrawerScreen
      roleLabel="Family"
      title="Status"
      subtitle="Margaret Smith - your mother"
      items={drawerItems.family}
      action="Call"
      onHome={onHome}
      onSignOut={onSignOut}>
      <SummaryCard
        label="Current Status"
        value="Safe & Well"
        hint="Last updated 5 mins ago"
        badge="ST"
        tone="success"
      />
      <SummaryCard
        label="Location"
        value="Home"
        hint="Living room - 2 mins ago"
        badge="LO"
        tone="info"
      />
      <Section title="Today's Activity">
        <View style={styles.activityRow}>
          <View style={[styles.activityDot, {backgroundColor: colors.success}]} />
          <View style={styles.activityCopy}>
            <Text style={styles.activityTitle}>Morning medication taken</Text>
            <Text style={styles.activityMeta}>8:15 AM</Text>
          </View>
        </View>
        <View style={styles.activityRow}>
          <View style={[styles.activityDot, {backgroundColor: colors.info}]} />
          <View style={styles.activityCopy}>
            <Text style={styles.activityTitle}>Chatted with Budii assistant</Text>
            <Text style={styles.activityMeta}>10:30 AM</Text>
          </View>
        </View>
        <View style={styles.activityRow}>
          <View style={[styles.activityDot, {backgroundColor: colors.warning}]} />
          <View style={styles.activityCopy}>
            <Text style={styles.activityTitle}>Lunch reminder acknowledged</Text>
            <Text style={styles.activityMeta}>12:10 PM</Text>
          </View>
        </View>
      </Section>
    </DrawerScreen>
  );
}

function PatientScreen({
  onHome,
  onSignOut,
}: {
  onHome: () => void;
  onSignOut: () => void;
}): React.JSX.Element {
  const [sosOpen, setSosOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [sosError, setSosError] = useState('');

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
      setIsListening(false);
      setSosError(getSpeechErrorMessage(event));
      audioService.stopRecording();
    };

    return () => {
      audioService.stopRecording();
      void voice.destroy().finally(() => {
        voice.removeAllListeners();
      });
    };
  }, []);

  const startListening = async () => {
    const voice = getVoiceModule();

    setSosOpen(true);
    setTranscript('');
    setPartialTranscript('');
    setSosError('');

    if (!voice) {
      setSosError(
        'Speech recognition is not available yet. Rebuild the app after installing native dependencies.',
      );
      return;
    }

    const permissionGranted = await requestMicrophonePermission();

    if (!permissionGranted) {
      setSosError('Microphone permission is required to record your SOS message.');
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
        error instanceof Error ? error.message : 'Unable to start speech recognition.',
      );
    }
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
        error instanceof Error ? error.message : 'Unable to stop speech recognition.',
      );
    } finally {
      setIsListening(false);
      audioService.stopRecording();
    }
  };

  const closeSosModal = async () => {
    const voice = getVoiceModule();

    if (voice) {
      try {
        await voice.cancel();
      } catch {
        // Ignore cancel errors when the recognizer is already stopped.
      }
    }

    setIsListening(false);
    setPartialTranscript('');
    audioService.stopRecording();
    setSosOpen(false);
  };

  const displayedTranscript = partialTranscript || transcript;

  return (
    <SafeAreaView style={styles.safeArea}>
      <TopBar rightLabel="Sign Out" onRightPress={onSignOut} />
      <ScrollView contentContainerStyle={styles.patientContent}>
        <View style={styles.patientHero}>
          <Text style={styles.patientTitle}>Welcome back</Text>
          <Text style={styles.patientSubtitle}>
            How can we help you today?
          </Text>
        </View>

        <Card>
          <Pressable
            onPress={() => {
              void startListening();
            }}
            style={({pressed}) => [styles.sosButton, pressed ? styles.pressed : null]}>
            <Text style={styles.sosText}>SOS - NEED HELP</Text>
          </Pressable>
          <Text style={styles.sosHint}>
            Press if you need immediate assistance
          </Text>
        </Card>

        <ActionRow
          badge="CH"
          title="Chat with Caregiver"
          description="Send text messages"
        />
        <ActionRow
          badge="VC"
          title="Call Caregiver"
          description="Start a voice call"
        />

        <Section title="Your Reminders">
          <ReminderRow
            title="Morning Medication"
            time="Mar 9, 3:41 PM"
            description="Take blood pressure tablets with water"
          />
          <ReminderRow
            title="Lunch Time"
            time="Mar 9, 4:41 PM"
            description="Prepared meal in fridge"
          />
          <ReminderRow
            title="Afternoon Walk"
            time="Mar 9, 6:41 PM"
            description="15 minute walk around the garden"
          />
          <ReminderRow
            title="Morning Check in"
            time="Mar 9, 12:41 PM"
            description="Daily wellness check completed"
            completed
          />
        </Section>

        <Section title="My Care Team">
          <Text style={styles.emptyText}>
            No care team members assigned yet
          </Text>
        </Section>

        <View style={styles.assurance}>
          <Text style={styles.assuranceTitle}>You're Safe & Connected</Text>
          <Text style={styles.assuranceBody}>
            Your caregiver can see your location and is always available to
            help.
          </Text>
        </View>

        <Pressable
          onPress={onHome}
          style={({pressed}) => [
            styles.secondaryButton,
            pressed ? styles.pressed : null,
          ]}>
          <Text style={styles.secondaryButtonText}>Back to portals</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={sosOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          void closeSosModal();
        }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>Emergency Voice Capture</Text>
                <Text style={styles.modalBody}>
                  Speak clearly and AISLA will convert your message to text.
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  isListening ? styles.statusPillListening : styles.statusPillIdle,
                ]}>
                {isListening ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : null}
                <Text
                  style={[
                    styles.statusPillText,
                    isListening
                      ? styles.statusPillTextListening
                      : styles.statusPillTextIdle,
                  ]}>
                  {isListening ? 'Listening' : 'Ready'}
                </Text>
              </View>
            </View>

            <View style={styles.transcriptCard}>
              <Text style={styles.transcriptLabel}>Transcript</Text>
              <Text
                style={[
                  styles.transcriptText,
                  !displayedTranscript ? styles.transcriptPlaceholder : null,
                ]}>
                {displayedTranscript || 'Your spoken emergency message will appear here.'}
              </Text>
            </View>

            {sosError ? <Text style={styles.sosErrorText}>{sosError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  if (isListening) {
                    void stopListening();
                    return;
                  }

                  void startListening();
                }}
                style={({pressed}) => [
                  styles.primaryButton,
                  styles.modalPrimaryButton,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.primaryButtonText}>
                  {isListening ? 'Stop Listening' : 'Listen Again'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void closeSosModal();
                }}
                style={({pressed}) => [
                  styles.secondaryButton,
                  styles.modalSecondaryButton,
                  pressed ? styles.pressed : null,
                ]}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export function PortalExperienceScreen(): React.JSX.Element {
  const [screen, setScreen] = useState<ScreenId>('landing');
  const [role, setRole] = useState<Role>('patient');

  const openAuth = (nextRole: Role) => {
    setRole(nextRole);
    setScreen('auth');
  };

  const goHome = () => {
    setScreen('landing');
  };

  if (screen === 'landing') {
    return (
      <LandingScreen
        onSignIn={() => openAuth('patient')}
        onSelectPortal={openAuth}
      />
    );
  }

  if (screen === 'auth') {
    return <AuthScreen role={role} onBack={goHome} onSubmit={() => setScreen(role)} />;
  }

  if (screen === 'admin') {
    return <AdminScreen onHome={goHome} onSignOut={goHome} />;
  }

  if (screen === 'caregiver') {
    return <CaregiverScreen onHome={goHome} onSignOut={goHome} />;
  }

  if (screen === 'family') {
    return <FamilyScreen onHome={goHome} onSignOut={goHome} />;
  }

  return <PatientScreen onHome={goHome} onSignOut={goHome} />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    height: 74,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topAction: {
    minWidth: 110,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  topActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 8},
    elevation: 4,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.surface,
    marginTop: -2,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
  },
  brandRole: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedSoft,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: 24,
    gap: 16,
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 2,
  },
  portalTile: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    gap: 16,
  },
  portalBadgeBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalBadgeText: {
    fontSize: 21,
    fontWeight: '800',
  },
  portalTileTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.9,
  },
  portalTileBody: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.muted,
  },
  portalTileLink: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  field: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 18,
    fontSize: 18,
    color: colors.text,
  },
  primaryButton: {
    height: 62,
    borderRadius: 18,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.surface,
  },
  primaryButtonArrow: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.surface,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  summaryLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  summaryBadge: {
    minWidth: 42,
    height: 34,
    borderRadius: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  summaryValue: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.4,
  },
  summaryHint: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.muted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 22,
  },
  actionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.info,
  },
  actionCopy: {
    flex: 1,
    gap: 6,
  },
  actionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  actionBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  actionChevron: {
    fontSize: 28,
    lineHeight: 28,
    color: colors.mutedSoft,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderIconText: {
    fontSize: 14,
    fontWeight: '800',
  },
  reminderCopy: {
    flex: 1,
    gap: 4,
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  reminderTitleDone: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  reminderTime: {
    fontSize: 15,
    color: colors.muted,
  },
  reminderBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  doneButton: {
    minWidth: 88,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.7,
  },
  sectionBody: {
    gap: 14,
  },
  drawerRoot: {
    flex: 1,
  },
  drawerContent: {
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 120,
    gap: 20,
  },
  drawerMenuButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  drawerMenuText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  screenHeaderCopy: {
    flex: 1,
    gap: 8,
  },
  screenTitle: {
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1.5,
  },
  screenSubtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.muted,
  },
  screenBody: {
    gap: 16,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.drawer,
  },
  drawerHeader: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.drawerBorder,
  },
  drawerBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 18,
  },
  drawerLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    color: colors.drawerMuted,
  },
  drawerList: {
    gap: 10,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
  },
  drawerItemActive: {
    backgroundColor: colors.drawerActive,
  },
  drawerItemBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.drawerBadge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItemBadgeActive: {
    backgroundColor: colors.primarySoft,
  },
  drawerItemBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.drawerMuted,
  },
  drawerItemBadgeTextActive: {
    color: colors.primary,
  },
  drawerItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.drawerText,
  },
  drawerItemTextActive: {
    color: colors.primary,
  },
  drawerFooter: {
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.drawerBorder,
  },
  drawerFooterButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.drawerFooterButton,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  drawerFooterText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  drawerToggle: {
    position: 'absolute',
    top: 78,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  drawerToggleText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.muted,
    marginTop: -1,
  },
  landingContent: {
    paddingHorizontal: 26,
    paddingTop: 42,
    paddingBottom: 48,
    gap: 26,
  },
  hero: {
    alignItems: 'center',
    gap: 18,
    paddingTop: 24,
  },
  heroPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  heroTitle: {
    fontSize: 54,
    lineHeight: 56,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -2.1,
    textAlign: 'center',
  },
  heroBody: {
    maxWidth: 330,
    fontSize: 20,
    lineHeight: 34,
    color: colors.muted,
    textAlign: 'center',
  },
  portalList: {
    gap: 18,
  },
  footerNote: {
    fontSize: 14,
    color: colors.mutedSoft,
    textAlign: 'center',
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 28,
  },
  authCopy: {
    gap: 10,
  },
  authTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1.1,
  },
  authBody: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.muted,
  },
  portalContext: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  portalContextText: {
    fontSize: 13,
    fontWeight: '700',
  },
  formCard: {
    gap: 18,
  },
  switchText: {
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'center',
    color: colors.muted,
  },
  switchAccent: {
    color: colors.primary,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerButton: {
    minWidth: 88,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  headerButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  alertRow: {
    gap: 6,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  alertMeta: {
    fontSize: 14,
    color: colors.muted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 14,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 7,
  },
  activityCopy: {
    flex: 1,
    gap: 6,
  },
  activityTitle: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.text,
  },
  activityMeta: {
    fontSize: 15,
    color: colors.muted,
  },
  patientContent: {
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 40,
    gap: 18,
  },
  patientHero: {
    gap: 8,
  },
  patientTitle: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -1.3,
  },
  patientSubtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.muted,
  },
  sosButton: {
    minHeight: 132,
    borderRadius: 24,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sosText: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.surface,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  sosHint: {
    fontSize: 17,
    textAlign: 'center',
    color: colors.muted,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 26,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  assurance: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    backgroundColor: colors.infoSoft,
    padding: 24,
    gap: 10,
  },
  assuranceTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.6,
  },
  assuranceBody: {
    fontSize: 17,
    lineHeight: 28,
    color: colors.muted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    justifyContent: 'flex-end',
    padding: 18,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    gap: 18,
  },
  modalHeader: {
    gap: 14,
  },
  modalHeaderCopy: {
    gap: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.8,
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.muted,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillListening: {
    backgroundColor: colors.dangerSoft,
  },
  statusPillIdle: {
    backgroundColor: colors.infoSoft,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusPillTextListening: {
    color: colors.danger,
  },
  statusPillTextIdle: {
    color: colors.info,
  },
  transcriptCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    padding: 18,
    gap: 10,
    minHeight: 180,
  },
  transcriptLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  transcriptText: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.text,
  },
  transcriptPlaceholder: {
    color: colors.mutedSoft,
  },
  sosErrorText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.danger,
  },
  modalActions: {
    gap: 12,
  },
  modalPrimaryButton: {
    width: '100%',
  },
  modalSecondaryButton: {
    width: '100%',
  },
  pressed: {
    opacity: 0.84,
  },
});
