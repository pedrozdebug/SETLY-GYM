import 'fake-indexeddb/auto';
import { describe, expect, it, beforeAll } from 'vitest';
import { db } from '../src/db/db';
import {
  applyTemplate, deleteSession, duplicateRoutine, finishSession, getActiveSession, initDatabase,
  persistSession, saveRoutine, startSession, newRoutineExercise, deleteRoutine, setScheduleDay,
} from '../src/db/repo';
import { analyzeProgression, detectPRs, e1rm, perSession, recordHistory, sessionTotals } from '../src/lib/analytics';
import { nextScheduled, trainingStreak } from '../src/lib/stats';
import { parseVideoUrl } from '../src/lib/video';
import { toCsv } from '../src/lib/export';
import { EXERCISES } from '../src/data/exercises';
import { SPLIT_TEMPLATES } from '../src/data/templates';
import type { Session } from '../src/db/types';

async function logAll(sessionId: string, weight: number, reps: number) {
  const s = (await db.sessions.get(sessionId))!;
  const next: Session = { ...s, exercises: s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => ({ ...x, weight, reps, done: true, completedAt: Date.now() })) })) };
  await persistSession(next);
}

describe('library data', () => {
  it('has unique ids, all groups covered and templates reference valid exercises', () => {
    const ids = new Set(EXERCISES.map((e) => e.id));
    expect(ids.size).toBe(EXERCISES.length);
    const groups = new Set(EXERCISES.map((e) => e.primary));
    expect(groups.size).toBe(11);
    for (const e of EXERCISES) {
      expect(e.instructions.length).toBeGreaterThan(0);
      expect(e.tips.length).toBeGreaterThan(0);
      expect(e.mistakes.length).toBeGreaterThan(0);
    }
    for (const t of SPLIT_TEMPLATES) for (const r of t.routines) for (const x of r.exercises) expect(ids.has(x.id), `${t.id}:${x.id}`).toBe(true);
  });
});

describe('analytics', () => {
  it('e1rm epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(Math.round(e1rm(100, 10))).toBe(133);
  });
  it('stagnation and improvements', () => {
    const mk = (sid: string, date: number, w: number, r: number) => ({ id: sid + date, sessionId: sid, exerciseId: 'x', date, order: 0, weight: w, reps: r, volume: w * r, updatedAt: 0 });
    const stats = perSession([mk('a', 1, 50, 10), mk('b', 2, 52.5, 8), mk('c', 3, 50, 8), mk('d', 4, 50, 8), mk('e', 5, 50, 8)]);
    const a = analyzeProgression(stats);
    expect(a.sessionsWithoutProgress).toBe(3);
    expect(a.stagnant).toBe(true);
    const b = analyzeProgression(perSession([mk('a', 1, 50, 10), mk('b', 2, 50, 12)]));
    expect(b.improvements.map((i) => i.kind)).toContain('repeticoes');
    expect(recordHistory([mk('a', 1, 50, 10), mk('b', 2, 55, 5)], 'maxWeight').map((r) => r.value)).toEqual([50, 55]);
    expect(detectPRs('x', [], [mk('a', 1, 50, 10)])).toEqual([]);
  });
  it('video parser accepts trusted providers only', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=abcdefghijk')?.kind).toBe('youtube');
    expect(parseVideoUrl('https://youtu.be/abcdefghijk')?.kind).toBe('youtube');
    expect(parseVideoUrl('https://www.youtube.com/shorts/abcdefghijk')?.kind).toBe('youtube');
    expect(parseVideoUrl('https://vimeo.com/123456789')?.kind).toBe('vimeo');
    expect(parseVideoUrl('http://youtube.com/watch?v=abcdefghijk')).toBeNull();
    expect(parseVideoUrl('https://evil.com/x')).toBeNull();
  });
  it('csv escapes', () => {
    expect(toCsv([['a;b', 'c"d', 1]])).toBe('﻿"a;b";"c""d";1');
  });
});

describe('full workout flow (IndexedDB)', () => {
  beforeAll(async () => { await initDatabase(); });

  it('seeds library, profile, prefs and schedule', async () => {
    expect(await db.exercises.count()).toBe(EXERCISES.length);
    expect(await db.schedule.count()).toBe(7);
    expect((await db.prefs.get('prefs'))?.defaultRestSec).toBe(90);
  });

  it('creates routine, trains twice, detects PRs, recomputes on delete', async () => {
    const ex1 = newRoutineExercise('supino-reto-barra');
    ex1.sets = 3; ex1.weight = 60; ex1.restSec = 120;
    const ex2 = newRoutineExercise('remada-curvada-barra');
    await saveRoutine({ id: 'r1', name: 'Push A', notes: '', exercises: [ex1, ex2] });
    await setScheduleDay(new Date().getDay(), 'r1');

    // session 1
    const s1 = await startSession('r1');
    expect(await startSession('r1')).toBe(s1); // only one active at a time
    const active = await getActiveSession();
    expect(active?.exercises[0].sets).toHaveLength(3);
    expect(active?.exercises[0].sets[0].weight).toBe(60); // initial load from routine
    await logAll(s1, 60, 10);
    const done1 = await finishSession(s1);
    expect(done1.status).toBe('done');
    expect(done1.setsDone).toBe(6);
    expect(done1.volume).toBe(60 * 10 * 6);
    expect(done1.prs).toEqual([]); // first time is not a PR
    expect(await db.sets.count()).toBe(6);
    expect((await db.records.get('supino-reto-barra:maxWeight'))?.value).toBe(60);

    // session 2 pre-fills with last weights
    const s2 = await startSession('r1');
    const a2 = (await db.sessions.get(s2))!;
    expect(a2.exercises[0].sets[0].weight).toBe(60);
    await logAll(s2, 62.5, 10);
    const done2 = await finishSession(s2);
    const types = done2.prs.filter((p) => p.exerciseId === 'supino-reto-barra').map((p) => p.type).sort();
    expect(types).toEqual(['maxExerciseVolume', 'maxSetVolume', 'maxWeight']);
    expect((await db.records.get('supino-reto-barra:maxWeight'))?.value).toBe(62.5);
    expect(sessionTotals(done2).setsDone).toBe(6);

    const all = await db.sessions.where('status').equals('done').toArray();
    expect(trainingStreak(all, await db.schedule.toArray())).toBeGreaterThanOrEqual(1);
    expect(nextScheduled(await db.schedule.toArray(), await db.routines.toArray(), all)?.isToday).toBe(false);

    await deleteSession(done2.id);
    expect((await db.records.get('supino-reto-barra:maxWeight'))?.value).toBe(60);
    expect(await db.sets.count()).toBe(6);
  });

  it('duplicates, deletes routines and applies templates', async () => {
    const copy = await duplicateRoutine('r1');
    expect((await db.routines.get(copy!))?.name).toBe('Push A (cópia)');
    await deleteRoutine('r1');
    expect((await db.schedule.toArray()).some((d) => d.routineId === 'r1')).toBe(false);
    const ids = await applyTemplate('ppl', true);
    expect(ids).toHaveLength(3);
    expect((await db.schedule.get(1))?.routineId).toBe(ids[0]);
    expect(await db.tombstones.where('id').equals('routines:r1').count()).toBe(1);
  });
});
