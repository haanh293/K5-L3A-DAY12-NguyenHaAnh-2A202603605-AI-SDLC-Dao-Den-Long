/**
 * Procedural Web Audio Engine (BGM + all Phase 2 SFX).
 * Purely client-side — never imported by src/core/ or headless.
 */
export class SoundEffects {
  private ctx: AudioContext | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  muted = false;
  volume = 0.7;

  private ensureContext(): AudioContext | null {
    if (this.muted || this.volume <= 0) return null;
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
    gainLevel = 0.12,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    const v = Math.max(0.0002, gainLevel * this.volume);
    gain.gain.setValueAtTime(0.0002, now);
    gain.gain.exponentialRampToValueAtTime(v, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  startBgm(): void {
    if (this.bgmTimer !== null || typeof window === 'undefined') return;
    // Gentle nocturnal pentatonic melody
    const melody = [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 220.0];
    this.bgmTimer = window.setInterval(() => {
      if (this.muted || this.volume <= 0 || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      const note = melody[this.bgmStep % melody.length];
      this.bgmStep++;
      this.playTone(note, 1.35, 'sine', 0.035);
      if (this.bgmStep % 2 === 0) {
        this.playTone(note * 0.5, 1.6, 'triangle', 0.022);
      }
    }, 1500);
  }

  stopBgm(): void {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  motePicked(carried: number): void {
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = notes[(Math.max(1, carried) - 1) % notes.length];
    this.playTone(freq, 0.2, 'sine', 0.11);
    this.playTone(freq * 1.5, 0.15, 'triangle', 0.05, 0.03);
  }

  charmPicked(): void {
    [587.33, 739.99, 880.0, 1174.66].forEach((f, idx) =>
      this.playTone(f, 0.3, 'sine', 0.1, idx * 0.05)
    );
  }

  jump(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.14);
    gain.gain.setValueAtTime(0.09 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  dash(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.18);
    gain.gain.setValueAtTime(0.14 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  deposit(): void {
    this.playTone(440, 0.18, 'triangle', 0.1);
    this.playTone(554.37, 0.22, 'sine', 0.09, 0.05);
  }

  lanternLit(): void {
    this.playTone(392.0, 0.65, 'sine', 0.12, 0);
    this.playTone(493.88, 0.65, 'sine', 0.1, 0.07);
    this.playTone(587.33, 0.75, 'triangle', 0.1, 0.14);
    this.playTone(783.99, 0.85, 'sine', 0.11, 0.21);
  }

  pulse(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.35);
    gain.gain.setValueAtTime(0.16 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playerHit(): void {
    this.playTone(155, 0.28, 'sawtooth', 0.1);
    this.playTone(105, 0.32, 'triangle', 0.12, 0.05);
  }

  shadeSpawned(): void {
    this.playTone(130.81, 0.45, 'sawtooth', 0.06);
    this.playTone(123.47, 0.5, 'sine', 0.07, 0.08);
  }

  countdownTick(): void {
    this.playTone(880, 0.09, 'square', 0.06);
  }

  windWarning(): void {
    this.playTone(310, 0.5, 'sine', 0.06);
    this.playTone(370, 0.6, 'triangle', 0.05, 0.15);
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
