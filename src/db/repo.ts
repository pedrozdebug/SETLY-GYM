// Data access layer. UI code never writes to Dexie directly — everything goes
// through these functions so timestamps, tombstones and derived data
// (set history, personal records) stay consistent.
import { db, SYNC_TABLES, type SyncTable } from './db';
import type {
  BodyWeight, Exercise, PersonalRecord, Preferences, Profile, Routine, RoutineExercise,
  Session, SessionExercise, SetLog,
} from './types';
import { EXERCISES, LIBRARY_VERSION } from '../data/exercises';
import { SPLIT_TEMPLATES } from '../data/templates';
import { uid } from '../lib/id';
import {
  currentRecords, detectPRs, sessionDurationSec, sessionTotals, toSetEntries, RECORD_TYPES,
} from '../lib/analytics';

export const DEFAULT_PROFILE: Profile = {
  id: 'me', name: '', photo: null, birthDate: null, heightCm: null, goal: 'hipertrofia',
  level: 'iniciante', trainingSince: null, onboarded: false, updatedAt: 0,
};

export const DEFAULT_PREFS: Preferences = {
  id: 'prefs', sound: true, vibration: true, autoRest: true, defaultRestSec: 90, weightStep: 2.5, keepAwake: true, updatedAt: 0,
};

const now = () => Date.now();

async function markDeleted(table: SyncTable, id: string | number) {
  await db.tombstones.put({ id: `${table}:${id}`, table, recordId: String(id), deletedAt: now() });
}

// ───────────────────────── bootstrap ─────────────────────────

let initPromise: Promise<void> | null = null;
export function initDatabase(): Promise<void> {
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

async function doInit() {
  await db.transaction('rw', [db.exercises, db.meta, db.profile, db.prefs, db.schedule], async () => {
    const v = (await db.meta.get('libraryVersion'))?.value as number | undefined;
    if (v !== LIBRARY_VERSION) {
      const existing = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
      await db.exercises.bulkPut(
        EXERCISES.map((s) => ({ ...s, videoUrl: existing.get(s.id)?.videoUrl, updatedAt: existing.get(s.id)?.updatedAt ?? 0 })),
      );
      await db.meta.put({ key: 'libraryVersion', value: LIBRARY_VERSION });
    }
    if (!(await db.profile.get('me'))) await db.profile.put(DEFAULT_PROFILE);
    if (!(await db.prefs.get('prefs'))) await db.prefs.put(DEFAULT_PREFS);
    if ((await db.schedule.count()) < 7) {
      for (let d = 0; d < 7; d++) if (!(await db.schedule.get(d))) await db.schedule.put({ id: d, routineId: null, updatedAt: 0 });
    }
  });
  // ask the browser to keep our storage
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
}

// ───────────────────────── profile & prefs ─────────────────────────

export async function saveProfile(patch: Partial<Profile>) {
  const cur = (await db.profile.get('me')) ?? DEFAULT_PROFILE;
  await db.profile.put({ ...cur, ...patch, id: 'me', updatedAt: now() });
}

export async function savePrefs(patch: Partial<Preferences>) {
  const cur = (await db.prefs.get('prefs')) ?? DEFAULT_PREFS;
  await db.prefs.put({ ...cur, ...patch, id: 'prefs', updatedAt: now() });
}

export async function getPrefs(): Promise<Preferences> {
  return (await db.prefs.get('prefs')) ?? DEFAULT_PREFS;
}

// ───────────────────────── body weight ─────────────────────────

export async function addBodyWeight(date: number, weight: number) {
  await db.bodyWeights.put({ id: uid(), date, weight, updatedAt: now() });
}
export async function deleteBodyWeight(id: string) {
  await db.bodyWeights.delete(id);
  await markDeleted('bodyWeights', id);
}
export async function latestBodyWeight(): Promise<BodyWeight | undefined> {
  return db.bodyWeights.orderBy('date').last();
}

// ───────────────────────── exercises ─────────────────────────

export async function saveCustomExercise(data: Omit<Exercise, 'id' | 'updatedAt' | 'custom'> & { id?: string }) {
  const id = data.id ?? `custom-${uid()}`;
  await db.exercises.put({ ...data, id, custom: true, updatedAt: now() });
  return id;
}

export async function setExerciseVideo(id: string, videoUrl: string | undefined) {
  await db.exercises.update(id, { videoUrl, updatedAt: now() });
}

export async function deleteCustomExercise(id: string) {
  const ex = await db.exercises.get(id);
  if (!ex?.custom) throw new Error('Apenas exercícios personalizados podem ser excluídos.');
  const used = await db.sets.where('exerciseId').equals(id).count();
  if (used > 0) throw new Error('Este exercício possui histórico registrado e não pode ser excluído.');
  await db.exercises.delete(id);
  await markDeleted('exercises', id);
  // remove from routines
  const routines = await db.routines.toArray();
  for (const r of routines) {
    if (r.exercises.some((x) => x.exerciseId === id)) {
      await db.routines.put({ ...r, exercises: r.exercises.filter((x) => x.exerciseId !== id), updatedAt: now() });
    }
  }
}

// ───────────────────────── routines ─────────────────────────

export function newRoutineExercise(exerciseId: string, restSec = 90): RoutineExercise {
  return { uid: uid(), exerciseId, sets: 3, repMin: 8, repMax: 12, weight: 0, restSec, notes: '' };
}

export async function saveRoutine(r: Omit<Routine, 'createdAt' | 'updatedAt' | 'order'> & Partial<Pick<Routine, 'createdAt' | 'order'>>) {
  const existing = await db.routines.get(r.id);
  const order = r.order ?? existing?.order ?? (await db.routines.count());
  await db.routines.put({ ...r, order, createdAt: existing?.createdAt ?? r.createdAt ?? now(), updatedAt: now() });
  return r.id;
}

export async function duplicateRoutine(id: string) {
  const r = await db.routines.get(id);
  if (!r) return null;
  const copy: Routine = {
    ...r, id: uid(), name: `${r.name} (cópia)`, order: await db.routines.count(),
    exercises: r.exercises.map((x) => ({ ...x, uid: uid() })), createdAt: now(), updatedAt: now(),
  };
  await db.routines.put(copy);
  return copy.id;
}

export async function deleteRoutine(id: string) {
  await db.transaction('rw', [db.routines, db.schedule, db.tombstones], async () => {
    await db.routines.delete(id);
    await markDeleted('routines', id);
    const days = await db.schedule.toArray();
    for (const d of days) if (d.routineId === id) await db.schedule.put({ ...d, routineId: null, updatedAt: now() });
  });
}

export async function reorderRoutines(ids: string[]) {
  await db.transaction('rw', db.routines, async () => {
    for (let i = 0; i < ids.length; i++) await db.routines.update(ids[i], { order: i, updatedAt: now() });
  });
}

export async function setScheduleDay(day: number, routineId: string | null) {
  await db.schedule.put({ id: day, routineId, updatedAt: now() });
}

export async function applyTemplate(templateId: string, applySchedule: boolean) {
  const t = SPLIT_TEMPLATES.find((x) => x.id === templateId);
  if (!t) throw new Error('Divisão não encontrada');
  const prefs = await getPrefs();
  const base = await db.routines.count();
  const ids: string[] = [];
  await db.transaction('rw', [db.routines, db.schedule], async () => {
    for (let i = 0; i < t.routines.length; i++) {
      const tr = t.routines[i];
      const id = uid();
      ids.push(id);
      await db.routines.put({
        id, name: tr.name, notes: '', order: base + i, createdAt: now(), updatedAt: now(),
        exercises: tr.exercises.map((x) => ({ uid: uid(), exerciseId: x.id, sets: x.sets, repMin: x.repMin, repMax: x.repMax, weight: 0, restSec: x.rest ?? prefs.defaultRestSec, notes: '' })),
      });
    }
    if (applySchedule) {
      for (let d = 0; d < 7; d++) {
        const idx = t.schedule[d];
        await db.schedule.put({ id: d, routineId: idx == null ? null : ids[idx], updatedAt: now() });
      }
    }
  });
  return ids;
}

// ───────────────────────── sessions ─────────────────────────

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first();
}

function makeSets(n: number, weight: number | null): SetLog[] {
  return Array.from({ length: Math.max(1, n) }, () => ({ uid: uid(), weight, reps: null, targetWeight: weight, done: false, completedAt: null, notes: '' }));
}

/** Last weight used for an exercise (top set of the most recent session). */
async function lastWeights(exerciseId: string): Promise<number[] | null> {
  const last = await db.sets.where('[exerciseId+date]').between([exerciseId, -Infinity], [exerciseId, Infinity]).last();
  if (!last) return null;
  const rows = await db.sets.where('sessionId').equals(last.sessionId).filter((s) => s.exerciseId === exerciseId).sortBy('order');
  return rows.map((r) => r.weight);
}

export async function buildSessionExercise(exerciseId: string, cfg?: Partial<RoutineExercise>): Promise<SessionExercise> {
  const prefs = await getPrefs();
  const prev = await lastWeights(exerciseId);
  const nSets = cfg?.sets ?? 3;
  const sets = makeSets(nSets, null).map((s, i) => {
    const w = prev ? prev[Math.min(i, prev.length - 1)] : cfg?.weight ? cfg.weight : null;
    return { ...s, weight: w ?? null, targetWeight: w ?? null };
  });
  return {
    uid: uid(), exerciseId,
    repMin: cfg?.repMin ?? 8, repMax: cfg?.repMax ?? 12,
    restSec: cfg?.restSec ?? prefs.defaultRestSec, notes: cfg?.notes ?? '', sets,
  };
}

export async function startSession(routineId: string | null): Promise<string> {
  const active = await getActiveSession();
  if (active) return active.id;
  let name = 'Treino livre';
  let exercises: SessionExercise[] = [];
  if (routineId) {
    const r = await db.routines.get(routineId);
    if (!r) throw new Error('Rotina não encontrada');
    name = r.name;
    exercises = await Promise.all(r.exercises.map((x) => buildSessionExercise(x.exerciseId, x)));
  }
  const s: Session = {
    id: uid(), routineId, name, status: 'active', startedAt: now(), endedAt: null, pausedMs: 0, pausedAt: null,
    currentIndex: 0, notes: '', exercises, durationSec: 0, volume: 0, setsDone: 0, reps: 0, prs: [], updatedAt: now(),
  };
  await db.sessions.put(s);
  return s.id;
}

export async function persistSession(s: Session) {
  await db.sessions.put({ ...s, updatedAt: now() });
}

export async function discardSession(id: string) {
  await db.sessions.delete(id);
  await markDeleted('sessions', id);
}

/** Recompute stored personal records for the given exercises from the set history. */
export async function recomputeRecords(exerciseIds: string[]) {
  for (const exId of new Set(exerciseIds)) {
    const entries = await db.sets.where('exerciseId').equals(exId).toArray();
    const recs = currentRecords(entries);
    for (const t of RECORD_TYPES) {
      const id = `${exId}:${t}`;
      const r = recs[t];
      if (r) {
        const rec: PersonalRecord = { id, exerciseId: exId, type: t, value: r.value, weight: r.weight, reps: r.reps, date: r.date, sessionId: r.sessionId, updatedAt: now() };
        await db.records.put(rec);
      } else if (await db.records.get(id)) {
        await db.records.delete(id);
        await markDeleted('records', id);
      }
    }
  }
}

export async function finishSession(id: string): Promise<Session> {
  const s = await db.sessions.get(id);
  if (!s) throw new Error('Sessão não encontrada');
  const endedAt = now();
  // drop exercises with no completed set? Keep them but they don't count.
  const finished: Session = { ...s, status: 'done', endedAt };
  if (finished.pausedAt) { finished.pausedMs += endedAt - finished.pausedAt; finished.pausedAt = null; }
  const totals = sessionTotals(finished);
  finished.durationSec = sessionDurationSec(finished, endedAt);
  finished.volume = totals.volume;
  finished.setsDone = totals.setsDone;
  finished.reps = totals.reps;

  const entries = toSetEntries(finished);
  const prs = [];
  const byEx = new Map<string, typeof entries>();
  for (const e of entries) byEx.set(e.exerciseId, [...(byEx.get(e.exerciseId) ?? []), e]);
  for (const [exId, list] of byEx) {
    const previous = (await db.sets.where('exerciseId').equals(exId).toArray()).filter((p) => p.sessionId !== id);
    prs.push(...detectPRs(exId, previous, list));
  }
  finished.prs = prs;
  finished.updatedAt = now();

  await db.transaction('rw', [db.sessions, db.sets, db.records, db.tombstones], async () => {
    await db.sets.where('sessionId').equals(id).delete();
    await db.sets.bulkPut(entries);
    await db.sessions.put(finished);
    await recomputeRecords([...byEx.keys()]);
  });
  return finished;
}

export async function deleteSession(id: string) {
  await db.transaction('rw', [db.sessions, db.sets, db.records, db.tombstones], async () => {
    const sets = await db.sets.where('sessionId').equals(id).toArray();
    await db.sets.where('sessionId').equals(id).delete();
    for (const s of sets) await markDeleted('sets', s.id);
    await db.sessions.delete(id);
    await markDeleted('sessions', id);
    await recomputeRecords(sets.map((s) => s.exerciseId));
  });
}

// ───────────────────────── backup ─────────────────────────

export interface Backup {
  app: 'setly-gym';
  version: 1;
  exportedAt: number;
  data: Record<SyncTable, unknown[]>;
}

export async function exportBackup(): Promise<Backup> {
  const data = {} as Record<SyncTable, unknown[]>;
  for (const t of SYNC_TABLES) data[t] = await db.table(t).toArray();
  return { app: 'setly-gym', version: 1, exportedAt: now(), data };
}

export async function importBackup(b: unknown) {
  const backup = b as Backup;
  if (!backup || backup.app !== 'setly-gym' || !backup.data) throw new Error('Arquivo de backup inválido.');
  await db.transaction('rw', SYNC_TABLES.map((t) => db.table(t)), async () => {
    for (const t of SYNC_TABLES) {
      const rows = backup.data[t];
      if (!Array.isArray(rows)) continue;
      await db.table(t).clear();
      await db.table(t).bulkPut(rows);
    }
  });
}

export async function clearAllData() {
  await db.delete();
  await db.open();
  initPromise = null;
  await initDatabase();
}
