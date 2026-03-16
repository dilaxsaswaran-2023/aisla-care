import {Platform} from 'react-native';

type TtsEventName = 'tts-finish' | 'tts-cancel' | 'tts-error';
type TtsEvent = {
  utteranceId: string | number;
};

type TtsSubscription = {
  remove: () => void;
};

type TtsModule = {
  getInitStatus: () => Promise<'success'>;
  setDucking: (enabled: boolean) => Promise<'success'>;
  setDefaultLanguage: (language: string) => Promise<'success'>;
  setDefaultRate: (rate: number, skipTransform?: boolean) => Promise<'success'>;
  setIgnoreSilentSwitch?: (
    behavior: 'inherit' | 'ignore' | 'obey',
  ) => Promise<boolean>;
  speak: (utterance: string) => string | number;
  stop: () => Promise<boolean>;
  addEventListener: (
    type: TtsEventName,
    handler: (event: TtsEvent) => void,
  ) => TtsSubscription;
};

let cachedTtsModule: TtsModule | null = null;

function getTtsModule(): TtsModule | null {
  if (cachedTtsModule) {
    return cachedTtsModule;
  }

  try {
    cachedTtsModule = require('react-native-tts').default as TtsModule;
    return cachedTtsModule;
  } catch {
    return null;
  }
}

class SpeechService {
  private initialized = false;

  isAvailable(): boolean {
    return getTtsModule() !== null;
  }

  async stop(): Promise<void> {
    const tts = getTtsModule();
    if (!tts) {
      return;
    }

    try {
      await tts.stop();
    } catch {
      // Ignore stop failures if no utterance is active.
    }
  }

  async speak(text: string): Promise<void> {
    const tts = getTtsModule();
    if (!tts) {
      return;
    }

    await this.ensureReady(tts);
    await this.stop();

    await new Promise<void>(resolve => {
      const utteranceId = tts.speak(text);
      const subscriptions: TtsSubscription[] = [];

      const cleanup = () => {
        clearTimeout(fallbackTimeout);
        subscriptions.forEach(subscription => {
          try {
            subscription.remove();
          } catch {
            // Ignore subscription cleanup failures.
          }
        });
        resolve();
      };

      const handleFinish = (event: TtsEvent) => {
        if (event.utteranceId !== utteranceId) {
          return;
        }

        cleanup();
      };

      const fallbackTimeout = setTimeout(cleanup, 5500);

      subscriptions.push(tts.addEventListener('tts-finish', handleFinish));
      subscriptions.push(tts.addEventListener('tts-cancel', handleFinish));
      subscriptions.push(tts.addEventListener('tts-error', handleFinish));
    });
  }

  private async ensureReady(tts: TtsModule): Promise<void> {
    if (this.initialized) {
      return;
    }

    await tts.getInitStatus();
    await tts.setDucking(true).catch(() => undefined);
    await tts.setDefaultLanguage('en-US').catch(() => undefined);
    await tts.setDefaultRate(0.47).catch(() => undefined);

    if (Platform.OS === 'ios' && tts.setIgnoreSilentSwitch) {
      await tts.setIgnoreSilentSwitch('ignore').catch(() => undefined);
    }

    this.initialized = true;
  }
}

export const speechService = new SpeechService();
