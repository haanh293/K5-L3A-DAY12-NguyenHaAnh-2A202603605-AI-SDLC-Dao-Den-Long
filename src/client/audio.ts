/**
 * Lightweight procedural Web Audio synthesizer for Đảo Đèn Lồng.
 * Purely client-side creative touch — never imported by src/core/ or headless.
 */
export class SoundEffects {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined' && 'AudioContext' in window) {
      this.ctx = new AudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  motePicked(carried: number): void {
    // Pentatonic ascending chime
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = notes[(carried - 1) % notes.length];
    this.playTone(freq, 0.22, 'sine', 0.11);
    this.playTone(freq * 1.5, 0.18, 'triangle', 0.05, 0.03);
  }

  deposit(): void {
    this.playTone(440, 0.2, 'triangle', 0.1);
    this.playTone(554.37, 0.25, 'sine', 0.09, 0.06);
  }

  lanternLit(): void {
    // Warm fairy-tale chord
    this.playTone(392.0, 0.7, 'sine', 0.12, 0);
    this.playTone(493.88, 0.7, 'sine', 0.1, 0.07);
    this.playTone(587.33, 0.8, 'triangle', 0.1, 0.14);
    this.playTone(783.99, 0.9, 'sine', 0.1, 0.21);
  }

  pulse(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playerHit(): void {
    this.playTone(150, 0.28, 'sawtooth', 0.1);
    this.playTone(110, 0.32, 'triangle', 0.12, 0.05);
  }

  gameOver(won: boolean): void {
    if (won) {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) =>
        this.playTone(f, 0.5, 'sine', 0.12, idx * 0.11)
      );
    } else {
      [349.23, 311.13, 261.63].forEach((f, idx) =>
        this.playTone(f, 0.45, 'triangle', 0.1, idx * 0.15)
      );
    }
  }
}
