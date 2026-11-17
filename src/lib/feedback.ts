// Sound, vibration and screen wake lock helpers.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Must be called from a user gesture at least once (iOS) so later beeps can play. */
export function unlockAudio() {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  g.gain.value = 0;
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + 0.01);
}

export function beep(pattern: { f: number; d: number; gap?: number }[] = [{ f: 880, d: 0.15, gap: 0.08 }, { f: 880, d: 0.15, gap: 0.08 }, { f: 1320, d: 0.35 }]) {
  const a = audio();
  if (!a) return;
  let t = a.currentTime + 0.02;
  for (const p of pattern) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = p.f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + p.d + 0.02);
    t += p.d + (p.gap ?? 0);
  }
}

export function tick() {
  beep([{ f: 660, d: 0.06 }]);
}

export function vibrate(pattern: number | number[] = [200, 100, 200, 100, 400]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}

let wakeLock: WakeLockSentinel | null = null;
export async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch { /* not allowed */ }
}
export async function releaseWakeLock() {
  try { await wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
}
