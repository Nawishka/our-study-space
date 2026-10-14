export type FeedbackKind = "task" | "submission" | "plan" | "reward";

// Original, quiet sine-tone phrases. No files, network requests or music loops.
export class GentleAudio {
  private context: AudioContext | null = null;
  private voices: OscillatorNode[] = [];
  unlock() {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended")
        void this.context.resume().catch(() => {});
    } catch {
      /* Audio unavailable: visual confirmation is always provided. */
    }
  }
  stop() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.voices = [];
  }
  play(kind: FeedbackKind) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return;
    this.stop();
    const notes = {
      task: [523.25, 659.25],
      submission: [440, 554.37, 659.25],
      plan: [659.25],
      reward: [392, 493.88, 587.33, 783.99],
    }[kind];
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + index * 0.13;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.025, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.24);
      this.voices.push(oscillator);
    });
  }
  dispose() {
    this.stop();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}
