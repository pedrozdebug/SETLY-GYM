// Rest countdown based on absolute timestamps so it stays correct when the
// tab is backgrounded or the app is reopened (state persisted in localStorage).
import { useCallback, useEffect, useRef, useState } from 'react';

export interface RestState {
  total: number; // seconds
  endsAt: number | null; // running
  remainingWhenPaused: number | null; // paused
  label: string;
  alerted: boolean;
}

const KEY = 'setly.rest';

function load(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestState) : null;
  } catch {
    return null;
  }
}
function save(s: RestState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* storage full or disabled */ }
}

export function clearRestTimer() { save(null); }

export function remainingOf(s: RestState, now = Date.now()): number {
  if (s.remainingWhenPaused != null) return s.remainingWhenPaused;
  if (s.endsAt == null) return 0;
  return Math.max(0, (s.endsAt - now) / 1000);
}

export function useRestTimer(onFinish: () => void) {
  const [state, setState] = useState<RestState | null>(() => load());
  const [, setTick] = useState(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const update = useCallback((s: RestState | null) => { setState(s); save(s); }, []);

  useEffect(() => {
    if (!state || state.remainingWhenPaused != null) return;
    const t = setInterval(() => {
      setTick((x) => x + 1);
      if (state.endsAt && Date.now() >= state.endsAt && !state.alerted) {
        const next = { ...state, alerted: true };
        update(next);
        finishRef.current();
      }
    }, 250);
    return () => clearInterval(t);
  }, [state, update]);

  // If the timer expired while the app was closed, don't alert again on reopen — just show it ended.
  useEffect(() => {
    const s = load();
    if (s && s.endsAt && Date.now() - s.endsAt > 60_000) update(null);
  }, [update]);

  const start = useCallback((seconds: number, label: string) => {
    if (seconds <= 0) return;
    update({ total: seconds, endsAt: Date.now() + seconds * 1000, remainingWhenPaused: null, label, alerted: false });
  }, [update]);

  const pause = useCallback(() => {
    if (!state || state.remainingWhenPaused != null) return;
    update({ ...state, remainingWhenPaused: remainingOf(state), endsAt: null });
  }, [state, update]);

  const resume = useCallback(() => {
    if (!state || state.remainingWhenPaused == null) return;
    update({ ...state, endsAt: Date.now() + state.remainingWhenPaused * 1000, remainingWhenPaused: null });
  }, [state, update]);

  const adjust = useCallback((delta: number) => {
    if (!state) return;
    const rem = Math.max(0, remainingOf(state) + delta);
    const total = Math.max(state.total + delta, rem, 1);
    if (state.remainingWhenPaused != null) update({ ...state, total, remainingWhenPaused: rem });
    else update({ ...state, total, endsAt: Date.now() + rem * 1000, alerted: rem > 0 ? false : state.alerted });
  }, [state, update]);

  const skip = useCallback(() => update(null), [update]);

  const remaining = state ? remainingOf(state) : 0;
  return {
    state,
    remaining,
    running: !!state && state.remainingWhenPaused == null && remaining > 0,
    paused: !!state && state.remainingWhenPaused != null,
    finished: !!state && remaining <= 0,
    start, pause, resume, adjust, skip,
  };
}
