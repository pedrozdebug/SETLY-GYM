// Pure calculation helpers: totals, personal records and progression analysis.
import { fmtW } from './format';
import type { PRHit, RecordType, Session, SessionExercise, SetEntry, SetLog } from '../db/types';

export const RECORD_TYPES: RecordType[] = ['maxWeight', 'maxReps', 'maxSetVolume', 'maxExerciseVolume'];

export function isCompleted(s: SetLog): boolean {
  return s.done && s.reps != null && s.reps > 0;
}

export function setVolume(weight: number | null, reps: number | null): number {
  return (weight ?? 0) * (reps ?? 0);
}

/** Epley estimated 1RM. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface Totals {
  volume: number;
  setsDone: number;
  reps: number;
  exercisesDone: number;
}

export function exerciseTotals(ex: SessionExercise): Totals {
  let volume = 0, setsDone = 0, reps = 0;
  for (const s of ex.sets) {
    if (!isCompleted(s)) continue;
    setsDone++;
    reps += s.reps ?? 0;
    volume += setVolume(s.weight, s.reps);
  }
  return { volume, setsDone, reps, exercisesDone: setsDone > 0 ? 1 : 0 };
}

export function sessionTotals(session: Pick<Session, 'exercises'>): Totals {
  const t: Totals = { volume: 0, setsDone: 0, reps: 0, exercisesDone: 0 };
  for (const ex of session.exercises) {
    const e = exerciseTotals(ex);
    t.volume += e.volume; t.setsDone += e.setsDone; t.reps += e.reps; t.exercisesDone += e.exercisesDone;
  }
  return t;
}

export function sessionDurationSec(s: Pick<Session, 'startedAt' | 'endedAt' | 'pausedMs' | 'pausedAt'>, now = Date.now()): number {
  const end = s.endedAt ?? now;
  const pausedExtra = s.pausedAt ? end - s.pausedAt : 0;
  return Math.max(0, Math.round((end - s.startedAt - s.pausedMs - pausedExtra) / 1000));
}

/** Flatten completed sets of a session into SetEntry rows. */
export function toSetEntries(session: Session): SetEntry[] {
  const out: SetEntry[] = [];
  const date = session.startedAt;
  session.exercises.forEach((ex, ei) => {
    ex.sets.forEach((s, si) => {
      if (!isCompleted(s)) return;
      const weight = s.weight ?? 0;
      const reps = s.reps ?? 0;
      out.push({
        id: `${session.id}:${s.uid}`,
        sessionId: session.id,
        exerciseId: ex.exerciseId,
        date,
        order: ei * 100 + si,
        weight,
        reps,
        volume: weight * reps,
        updatedAt: Date.now(),
      });
    });
  });
  return out;
}

export interface ExerciseSessionStat {
  sessionId: string;
  date: number;
  topWeight: number;
  topWeightReps: number;
  maxReps: number;
  bestSetVolume: number;
  bestE1RM: number;
  volume: number;
  sets: number;
  reps: number;
  setsDetail: { weight: number; reps: number }[];
}

/** Aggregate set entries of ONE exercise per session, sorted by date asc. */
export function perSession(entries: SetEntry[]): ExerciseSessionStat[] {
  const map = new Map<string, ExerciseSessionStat>();
  const sorted = [...entries].sort((a, b) => a.date - b.date || a.order - b.order);
  for (const e of sorted) {
    let s = map.get(e.sessionId);
    if (!s) {
      s = { sessionId: e.sessionId, date: e.date, topWeight: 0, topWeightReps: 0, maxReps: 0, bestSetVolume: 0, bestE1RM: 0, volume: 0, sets: 0, reps: 0, setsDetail: [] };
      map.set(e.sessionId, s);
    }
    if (e.weight > s.topWeight || (e.weight === s.topWeight && e.reps > s.topWeightReps)) {
      s.topWeight = e.weight; s.topWeightReps = e.reps;
    }
    s.maxReps = Math.max(s.maxReps, e.reps);
    s.bestSetVolume = Math.max(s.bestSetVolume, e.volume);
    s.bestE1RM = Math.max(s.bestE1RM, e1rm(e.weight, e.reps));
    s.volume += e.volume;
    s.sets++;
    s.reps += e.reps;
    s.setsDetail.push({ weight: e.weight, reps: e.reps });
  }
  return [...map.values()].sort((a, b) => a.date - b.date);
}

export interface RecordValue {
  type: RecordType;
  value: number;
  weight: number;
  reps: number;
  date: number;
  sessionId: string;
}

function candidates(entries: SetEntry[], type: RecordType): RecordValue[] {
  if (type === 'maxExerciseVolume') {
    return perSession(entries).map((s) => ({ type, value: s.volume, weight: s.topWeight, reps: s.reps, date: s.date, sessionId: s.sessionId }));
  }
  return [...entries]
    .sort((a, b) => a.date - b.date || a.order - b.order)
    .map((e) => ({
      type,
      value: type === 'maxWeight' ? e.weight : type === 'maxReps' ? e.reps : e.volume,
      weight: e.weight,
      reps: e.reps,
      date: e.date,
      sessionId: e.sessionId,
    }));
}

/** Chronological list of every time a record was beaten (first value included). */
export function recordHistory(entries: SetEntry[], type: RecordType): RecordValue[] {
  const out: RecordValue[] = [];
  let best = 0;
  for (const c of candidates(entries, type)) {
    if (c.value > best) {
      // within the same session keep only the final best
      if (out.length && out[out.length - 1].sessionId === c.sessionId) out.pop();
      out.push(c);
      best = c.value;
    }
  }
  return out;
}

export function currentRecords(entries: SetEntry[]): Partial<Record<RecordType, RecordValue>> {
  const res: Partial<Record<RecordType, RecordValue>> = {};
  for (const t of RECORD_TYPES) {
    const h = recordHistory(entries, t);
    if (h.length) res[t] = h[h.length - 1];
  }
  return res;
}

/** PRs achieved by `newEntries` (one session) compared with all `previous` entries of the same exercise. */
export function detectPRs(exerciseId: string, previous: SetEntry[], newEntries: SetEntry[]): PRHit[] {
  if (!newEntries.length || !previous.length) return []; // first time doing an exercise is not a "record"
  const prev = currentRecords(previous);
  const now = currentRecords([...previous, ...newEntries]);
  const hits: PRHit[] = [];
  const sid = newEntries[0].sessionId;
  for (const t of RECORD_TYPES) {
    const n = now[t];
    const p = prev[t];
    if (n && n.sessionId === sid && n.value > (p?.value ?? 0) && n.value > 0) {
      hits.push({ exerciseId, type: t, value: n.value, previous: p?.value ?? null, weight: n.weight, reps: n.reps });
    }
  }
  return hits;
}

export type TrendKind = 'carga' | 'repeticoes' | 'volume' | 'e1rm';

export interface ProgressionAnalysis {
  sessions: number;
  last?: ExerciseSessionStat;
  previous?: ExerciseSessionStat;
  improvements: { kind: TrendKind; label: string; delta: number }[];
  /** Sessions since the last time any metric (top weight, reps at top weight, e1RM or volume) set a new best. */
  sessionsWithoutProgress: number;
  lastProgressDate: number | null;
  stagnant: boolean;
}

export function analyzeProgression(stats: ExerciseSessionStat[], stagnationThreshold = 3): ProgressionAnalysis {
  const res: ProgressionAnalysis = { sessions: stats.length, improvements: [], sessionsWithoutProgress: 0, lastProgressDate: null, stagnant: false };
  if (!stats.length) return res;
  const last = stats[stats.length - 1];
  const previous = stats[stats.length - 2];
  res.last = last; res.previous = previous;

  if (previous) {
    if (last.topWeight > previous.topWeight) res.improvements.push({ kind: 'carga', label: 'Aumento de carga', delta: last.topWeight - previous.topWeight });
    else if (last.topWeight === previous.topWeight && last.topWeightReps > previous.topWeightReps)
      res.improvements.push({ kind: 'repeticoes', label: 'Mais repetições com a mesma carga', delta: last.topWeightReps - previous.topWeightReps });
    if (last.reps > previous.reps && last.topWeight >= previous.topWeight)
      res.improvements.push({ kind: 'repeticoes', label: 'Mais repetições totais', delta: last.reps - previous.reps });
    if (last.volume > previous.volume) res.improvements.push({ kind: 'volume', label: 'Volume maior', delta: last.volume - previous.volume });
    if (last.bestE1RM > previous.bestE1RM + 0.01) res.improvements.push({ kind: 'e1rm', label: '1RM estimado maior', delta: last.bestE1RM - previous.bestE1RM });
  }

  // Walk forward and track bests; any new best counts as progress.
  let bestW = -1, bestRepsAtW = -1, bestE = -1, bestV = -1;
  let lastProgressIdx = 0;
  stats.forEach((s, i) => {
    let progressed = false;
    if (s.topWeight > bestW) { bestW = s.topWeight; bestRepsAtW = s.topWeightReps; progressed = true; }
    else if (s.topWeight === bestW && s.topWeightReps > bestRepsAtW) { bestRepsAtW = s.topWeightReps; progressed = true; }
    if (s.bestE1RM > bestE + 0.01) { bestE = s.bestE1RM; progressed = true; }
    if (s.volume > bestV) { bestV = s.volume; progressed = true; }
    if (progressed) lastProgressIdx = i;
  });
  res.sessionsWithoutProgress = stats.length - 1 - lastProgressIdx;
  res.lastProgressDate = stats[lastProgressIdx].date;
  res.stagnant = res.sessionsWithoutProgress >= stagnationThreshold;
  return res;
}

/**
 * Double-progression suggestion: if every working set of the last session hit
 * the top of the rep range, suggest increasing the load.
 */
export function suggestNext(last: ExerciseSessionStat | undefined, repMax: number, step: number): { weight: number; message: string } | null {
  if (!last || !last.setsDetail.length) return null;
  const top = last.topWeight;
  const atTop = last.setsDetail.filter((s) => s.weight === top);
  if (top > 0 && atTop.length && atTop.every((s) => s.reps >= repMax)) {
    return { weight: top + step, message: `Você bateu ${repMax} reps em todas as séries com ${fmtW(top)} kg. Tente ${fmtW(top + step)} kg.` };
  }
  if (top > 0) return { weight: top, message: `Mantenha ${fmtW(top)} kg e busque mais repetições até ${repMax}.` };
  return null;
}
