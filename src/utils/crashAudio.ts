/**
 * Lightweight Web Audio API Synthesizer for Crash Game
 * Self-contained, non-blocking, zero external asset dependencies.
 */

class CrashSoundEffects {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private flightOsc: OscillatorNode | null = null;
  private flightGain: GainNode | null = null;

  constructor() {
    // Restore mute preference
    const saved = localStorage.getItem('crash_audio_muted');
    if (saved !== null) {
      this.isMuted = saved === 'true';
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('crash_audio_muted', String(this.isMuted));
    if (this.isMuted) {
      this.stopFlightHum();
    }
    return this.isMuted;
  }

  /**
   * Countdown tick beep
   */
  public playCountdownTick(lastTick: boolean = false) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(lastTick ? 880 : 540, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (lastTick ? 0.25 : 0.08));

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + (lastTick ? 0.25 : 0.08));
    } catch {
      // Audio autoplay policy guard
    }
  }

  /**
   * Rocket Launch / takeoff whoosh
   */
  public playLaunch() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.4);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);

      this.startFlightHum();
    } catch {}
  }

  /**
   * Subtle rising flight hum during active flight
   */
  public startFlightHum() {
    if (this.isMuted) return;
    try {
      this.stopFlightHum();
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      this.flightOsc = this.ctx.createOscillator();
      this.flightGain = this.ctx.createGain();

      this.flightOsc.type = 'triangle';
      this.flightOsc.frequency.setValueAtTime(140, now);

      this.flightGain.gain.setValueAtTime(0.001, now);
      this.flightGain.gain.linearRampToValueAtTime(0.025, now + 0.3);

      this.flightOsc.connect(this.flightGain);
      this.flightGain.connect(this.ctx.destination);

      this.flightOsc.start(now);
    } catch {}
  }

  /**
   * Modulate flight hum pitch as multiplier increases
   */
  public updateMultiplierPitch(multiplier: number) {
    if (this.isMuted || !this.flightOsc || !this.ctx) return;
    try {
      // Frequency ramps up smoothly with multiplier
      const clamped = Math.min(100, Math.max(1, multiplier));
      const targetFreq = 140 + Math.log2(clamped) * 70;
      this.flightOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    } catch {}
  }

  public stopFlightHum() {
    try {
      if (this.flightGain && this.ctx) {
        this.flightGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
      }
      setTimeout(() => {
        if (this.flightOsc) {
          try {
            this.flightOsc.stop();
            this.flightOsc.disconnect();
          } catch {}
          this.flightOsc = null;
        }
      }, 60);
    } catch {}
  }

  /**
   * Cash Out victory chime
   */
  public playCashOut() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.001, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.4);
      });
    } catch {}
  }

  /**
   * Crash Explosion thud
   */
  public playCrash() {
    this.stopFlightHum();
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // Low frequency punch
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }
}

export const crashAudio = new CrashSoundEffects();
