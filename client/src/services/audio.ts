export type SfxId = 'deal' | 'play' | 'trick_win' | 'warning' | 'game_over' | 'round_start';

let audioContext: AudioContext | null = null;
let muted = false;
let volume = 0.65;
const lastPlayedAt = new Map<SfxId, number>();

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!audioContext) {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    audioContext = new Ctx();
  }
  return audioContext;
}

function tone(freq: number, durationMs: number, gainScale = 1, startDelaySec = 0, type: OscillatorType = 'sine') {
  const ctx = getContext();
  if (!ctx || muted || volume <= 0) {
    return;
  }

  const now = ctx.currentTime + startDelaySec;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, now);

  const maxGain = Math.min(0.23, 0.18 * volume * gainScale);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(maxGain, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + durationMs / 1000 + 0.01);
}

function canPlay(id: SfxId): boolean {
  const now = Date.now();
  const minIntervalMs: Record<SfxId, number> = {
    deal: 60,
    play: 120,
    trick_win: 220,
    warning: 350,
    game_over: 1000,
    round_start: 800,
  };
  const prev = lastPlayedAt.get(id) ?? 0;
  if (now - prev < minIntervalMs[id]) {
    return false;
  }
  lastPlayedAt.set(id, now);
  return true;
}

export function unlockAudio(): void {
  const ctx = getContext();
  if (!ctx) {
    return;
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

export function setAudioMuted(nextMuted: boolean): void {
  muted = nextMuted;
}

export function setAudioVolume(nextVolume: number): void {
  volume = Math.max(0, Math.min(1, nextVolume));
}

export function playSfx(id: SfxId): void {
  if (!canPlay(id)) {
    return;
  }
  const ctx = getContext();
  if (!ctx || muted || volume <= 0) {
    return;
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  if (id === 'deal') {
    tone(520, 60, 0.42, 0, 'triangle');
    return;
  }
  if (id === 'play') {
    tone(380, 90, 0.55, 0, 'triangle');
    return;
  }
  if (id === 'trick_win') {
    tone(620, 100, 0.65, 0, 'sine');
    tone(760, 130, 0.65, 0.08, 'sine');
    return;
  }
  if (id === 'warning') {
    tone(260, 130, 0.7, 0, 'sawtooth');
    tone(220, 140, 0.6, 0.11, 'sawtooth');
    return;
  }
  if (id === 'game_over') {
    tone(520, 180, 0.75, 0, 'sine');
    tone(440, 200, 0.75, 0.16, 'sine');
    tone(350, 240, 0.7, 0.33, 'sine');
    return;
  }
  tone(470, 130, 0.55, 0, 'triangle');
}
