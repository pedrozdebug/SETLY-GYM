// Aggregations over finished sessions used by the dashboard and reports.
import type { Exercise, MuscleGroup, Routine, ScheduleDay, Session } from '../db/types';
import { addDays, DAY, startOfDay, startOfWeek } from './date';
import { isCompleted } from './analytics';

export interface Overview {
  sessions: number;
  durationSec: number;
  volume: number;
  sets: number;
  reps: number;
  avgDurationSec: number;
  perWeek: number;
}

export function inRange(sessions: Session[], from: number, to: number) {
  return sessions.filter((s) => s.status === 'done' && s.startedAt >= from && s.startedAt <= to);
}

export function overview(sessions: Session[], from?: number, to?: number): Overview {
  const n = sessions.length;
  const durationSec = sessions.reduce((a, s) => a + s.durationSec, 0);
  const volume = sessions.reduce((a, s) => a + s.volume, 0);
  const sets = sessions.reduce((a, s) => a + s.setsDone, 0);
  const reps = sessions.reduce((a, s) => a + s.reps, 0);
  let perWeek = 0;
  if (n) {
    const start = from ?? Math.min(...sessions.map((s) => s.startedAt));
    const end = to ?? Date.now();
    const weeks = Math.max(1, (end - start) / (7 * DAY));
    perWeek = n / weeks;
  }
  return { sessions: n, durationSec, volume, sets, reps, avgDurationSec: n ? durationSec / n : 0, perWeek };
}

export interface WeekBucket { start: number; count: number; volume: number; reps: number; durationSec: number; sets: number }

export function weeklySeries(sessions: Session[], from: number, to: number): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) buckets.push({ start: w, count: 0, volume: 0, reps: 0, durationSec: 0, sets: 0 });
  for (const s of sessions) {
    const w = startOfWeek(s.startedAt);
    const b = buckets.find((x) => x.start === w);
    if (!b) continue;
    b.count++; b.volume += s.volume; b.reps += s.reps; b.durationSec += s.durationSec; b.sets += s.setsDone;
  }
  return buckets;
}

export function muscleDistribution(sessions: Session[], exMap: Map<string, Exercise>): { group: MuscleGroup; sets: number; sessions: number }[] {
  const sets = new Map<MuscleGroup, number>();
  const sess = new Map<MuscleGroup, Set<string>>();
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const info = exMap.get(ex.exerciseId);
      if (!info) continue;
      const done = ex.sets.filter(isCompleted).length;
      if (!done) continue;
      sets.set(info.primary, (sets.get(info.primary) ?? 0) + done);
      if (!sess.has(info.primary)) sess.set(info.primary, new Set());
      sess.get(info.primary)!.add(s.id);
    }
  }
  return [...sets.entries()].map(([group, n]) => ({ group, sets: n, sessions: sess.get(group)?.size ?? 0 })).sort((a, b) => b.sets - a.sets);
}

/**
 * Training streak in days. A day keeps the streak alive when the user trained,
 * or when it is a planned rest day in the weekly schedule. Today never breaks
 * the streak (the day is not over yet).
 */
export function trainingStreak(sessions: Session[], schedule: ScheduleDay[]): number {
  const trained = new Set(sessions.filter((s) => s.status === 'done').map((s) => startOfDay(s.startedAt)));
  if (!trained.size) return 0;
  const hasPlan = schedule.some((d) => d.routineId);
  const isRest = (t: number) => hasPlan && !schedule.find((d) => d.id === new Date(t).getDay())?.routineId;
  let streak = 0;
  let day = startOfDay(Date.now());
  if (!trained.has(day)) day = addDays(day, -1);
  for (let i = 0; i < 3650; i++) {
    if (trained.has(day)) streak++;
    else if (!isRest(day)) break;
    day = addDays(day, -1);
  }
  return streak;
}

export interface NextWorkout { routine: Routine; date: number; isToday: boolean }

export function nextScheduled(schedule: ScheduleDay[], routines: Routine[], sessions: Session[]): NextWorkout | null {
  const today = startOfDay(Date.now());
  const doneToday = sessions.some((s) => s.status === 'done' && startOfDay(s.startedAt) === today);
  for (let i = doneToday ? 1 : 0; i < 8; i++) {
    const d = addDays(today, i);
    const rid = schedule.find((x) => x.id === new Date(d).getDay())?.routineId;
    const r = rid ? routines.find((x) => x.id === rid) : undefined;
    if (r) return { routine: r, date: d, isToday: i === 0 };
  }
  return null;
}

export function previousPeriod(from: number, to: number): [number, number] {
  const len = to - from;
  return [from - len - 1, from - 1];
}
