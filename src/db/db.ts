import Dexie, { type Table } from 'dexie';
import type {
  BodyWeight, Exercise, MetaEntry, PersonalRecord, Preferences, Profile, Routine,
  ScheduleDay, Session, SetEntry, Tombstone,
} from './types';

export class SetlyDB extends Dexie {
  exercises!: Table<Exercise, string>;
  routines!: Table<Routine, string>;
  schedule!: Table<ScheduleDay, number>;
  sessions!: Table<Session, string>;
  sets!: Table<SetEntry, string>;
  records!: Table<PersonalRecord, string>;
  bodyWeights!: Table<BodyWeight, string>;
  profile!: Table<Profile, string>;
  prefs!: Table<Preferences, string>;
  tombstones!: Table<Tombstone, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'setly-gym') {
    super(name);
    this.version(1).stores({
      exercises: 'id, primary, equipment, type, updatedAt',
      routines: 'id, order, updatedAt',
      schedule: 'id, updatedAt',
      sessions: 'id, status, startedAt, routineId, updatedAt',
      sets: 'id, sessionId, exerciseId, date, [exerciseId+date], updatedAt',
      records: 'id, exerciseId, type, updatedAt',
      bodyWeights: 'id, date, updatedAt',
      profile: 'id',
      prefs: 'id',
      tombstones: 'id, deletedAt',
      meta: 'key',
    });
  }
}

export const db = new SetlyDB();

/** Tables that participate in sync, in dependency order. */
export const SYNC_TABLES = [
  'exercises', 'routines', 'schedule', 'sessions', 'sets', 'records', 'bodyWeights', 'profile', 'prefs',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
