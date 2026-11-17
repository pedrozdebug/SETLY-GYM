import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import { DEFAULT_PREFS, DEFAULT_PROFILE } from '../db/repo';
import type { Exercise } from '../db/types';

export const useProfile = () => useLiveQuery(() => db.profile.get('me'), []) ?? DEFAULT_PROFILE;
export const usePrefs = () => useLiveQuery(() => db.prefs.get('prefs'), []) ?? DEFAULT_PREFS;

export function useExercises() {
  const list = useLiveQuery(() => db.exercises.toArray(), []);
  const map = useMemo(() => new Map<string, Exercise>((list ?? []).map((e) => [e.id, e])), [list]);
  return { list: list ?? [], map, loading: list === undefined };
}

export const useRoutines = () => useLiveQuery(() => db.routines.orderBy('order').toArray(), []);
export const useSchedule = () => useLiveQuery(() => db.schedule.toArray(), []) ?? [];
export const useDoneSessions = () =>
  useLiveQuery(() => db.sessions.where('status').equals('done').reverse().sortBy('startedAt'), []);
export const useActiveSession = () => useLiveQuery(() => db.sessions.where('status').equals('active').first(), []);
