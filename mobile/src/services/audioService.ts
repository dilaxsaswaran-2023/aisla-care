type SoundLoadCallback = (error?: Error | null) => void;
type SoundModule = {
  new (
    filenameOrFile: number | string,
    basePathOrCallback?: string | SoundLoadCallback,
    callback?: SoundLoadCallback,
  ): SoundInstance;
  setCategory: (category: 'Playback', mixWithOthers?: boolean) => void;
};

type SoundInstance = {
  isLoaded: () => boolean;
  isPlaying: () => boolean;
  play: (onEnd?: (success: boolean) => void) => SoundInstance;
  stop: (callback?: () => void) => SoundInstance;
  setCurrentTime: (seconds: number) => SoundInstance;
  setVolume: (value: number) => SoundInstance;
  setNumberOfLoops: (value: number) => SoundInstance;
  release: () => SoundInstance;
};

let cachedSoundModule: SoundModule | null = null;

const reminderAlarmAsset = require('../assets/sounds/reminder_alarm.wav');

function getSoundModule(): SoundModule | null {
  if (cachedSoundModule) {
    return cachedSoundModule;
  }

  try {
    cachedSoundModule = require('react-native-sound') as SoundModule;
    return cachedSoundModule;
  } catch {
    return null;
  }
}

class AudioService {
  private recording = false;
  private alarmSound: SoundInstance | null = null;
  private alarmLoadingPromise: Promise<SoundInstance | null> | null = null;
  private readonly alarmVolume = 0.62;
  private alarmPlaying = false;

  startRecording(): void {
    this.recording = true;
  }

  stopRecording(): void {
    this.recording = false;
  }

  isRecording(): boolean {
    return this.recording;
  }

  async startAlarm(): Promise<boolean> {
    const alarmSound = await this.getAlarmSound();
    if (!alarmSound) {
      return false;
    }

    if (this.alarmPlaying || alarmSound.isPlaying()) {
      return true;
    }

    alarmSound.setNumberOfLoops(-1);
    alarmSound.setCurrentTime(0);
    alarmSound.setVolume(this.alarmVolume);
    this.alarmPlaying = true;
    alarmSound.play(success => {
      if (!success) {
        this.alarmPlaying = false;
      }
    });
    return true;
  }

  async stopAlarm(): Promise<void> {
    if (!this.alarmSound || !this.alarmPlaying) {
      this.alarmPlaying = false;
      return;
    }

    await new Promise<void>(resolve => {
      this.alarmSound?.stop(() => resolve());
    });

    this.alarmSound.setCurrentTime(0);
    this.alarmPlaying = false;
  }

  async releaseAlarm(): Promise<void> {
    await this.stopAlarm();
    this.alarmSound?.release();
    this.alarmSound = null;
    this.alarmLoadingPromise = null;
  }

  private async getAlarmSound(): Promise<SoundInstance | null> {
    if (this.alarmSound?.isLoaded()) {
      return this.alarmSound;
    }

    if (this.alarmLoadingPromise) {
      return this.alarmLoadingPromise;
    }

    const Sound = getSoundModule();
    if (!Sound) {
      return null;
    }

    try {
      Sound.setCategory('Playback', true);
    } catch {
      // Ignore audio-session errors and try to load the sound anyway.
    }

    this.alarmLoadingPromise = new Promise(resolve => {
      const sound = new Sound(reminderAlarmAsset, error => {
        if (error) {
          this.alarmLoadingPromise = null;
          resolve(null);
          return;
        }

        sound.setNumberOfLoops(-1);
        sound.setVolume(this.alarmVolume);
        this.alarmSound = sound;
        resolve(sound);
      });
    });

    return this.alarmLoadingPromise;
  }
}

export const audioService = new AudioService();
