class AudioService {
  private recording = false;

  startRecording(): void {
    this.recording = true;
  }

  stopRecording(): void {
    this.recording = false;
  }

  isRecording(): boolean {
    return this.recording;
  }
}

export const audioService = new AudioService();
