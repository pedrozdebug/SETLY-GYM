import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Check, ChevronLeft, ChevronRight, Flag, History, Info, Minus, MoreVertical, Pause, Play, Plus,
  SkipForward, Timer, Trash2, X, Lightbulb,
} from 'lucide-react';
import { db } from '../db/db';
import { buildSessionExercise, discardSession, finishSession, getActiveSession, persistSession } from '../db/repo';
import type { Session, SessionExercise, SetLog } from '../db/types';
import { useExercises, usePrefs } from '../hooks/data';
import { clearRestTimer, useRestTimer } from '../hooks/useRestTimer';
import { perSession, sessionDurationSec, sessionTotals, suggestNext, type ExerciseSessionStat } from '../lib/analytics';
import { beep, releaseWakeLock, requestWakeLock, unlockAudio, vibrate } from '../lib/feedback';
import { fmtClock, fmtDateShort, fmtVolume, fmtW, repRange } from '../lib/format';
import { uid } from '../lib/id';
import { backgroundSync } from '../lib/sync';
import { MUSCLE_LABEL } from '../data/labels';
import { NumInput, Sheet, useConfirm, useToast } from '../components/ui/ui';
import { ExercisePicker } from '../components/ExercisePicker';

// Serialize writes so rapid edits never land out of order.
let writeQueue: Promise<unknown> = Promise.resolve();
function queueSave(s: Session) {
  writeQueue = writeQueue.then(() => persistSession(s)).catch((e) => console.error('[workout] save failed', e));
  return writeQueue;
}

function useHistory(exerciseIds: string[], sessionId: string | undefined) {
  const key = [...new Set(exerciseIds)].sort().join('|');
  return useLiveQuery(async () => {
    const res: Record<string, ExerciseSessionStat[]> = {};
    for (const id of key ? key.split('|') : []) {
      const entries = (await db.sets.where('exerciseId').equals(id).toArray()).filter((e) => e.sessionId !== sessionId);
      res[id] = perSession(entries);
    }
    return res;
  }, [key, sessionId]) ?? {};
}

function RestPanel({ timer, onClose }: { timer: ReturnType<typeof useRestTimer>; onClose: () => void }) {
  const { state, remaining, paused, finished } = timer;
  if (!state) return null;
  const r = 74;
  const c = 2 * Math.PI * r;
  const pct = state.total ? remaining / state.total : 0;
  return (
    <div className={`rest-panel${finished ? ' finished' : ''}`} role="timer" aria-live="polite">
      <div className="rest-inner">
        <div className="row-between">
          <div>
            <div className="eyebrow accent">{finished ? 'Descanso concluído' : paused ? 'Pausado' : 'Descanso'}</div>
            <div className="xs muted truncate" style={{ maxWidth: 240 }}>{state.label}</div>
          </div>
          <button className="icon-btn sm" aria-label="Minimizar cronômetro" onClick={onClose}><ChevronRight style={{ transform: 'rotate(90deg)' }} /></button>
        </div>
        <div className="ring">
          <svg viewBox="0 0 168 168" width="168" height="168">
            <circle cx="84" cy="84" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
            <circle cx="84" cy="84" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
          </svg>
          <div className="ring-time"><div><b>{fmtClock(Math.ceil(remaining))}</b><span className="xs dim">de {fmtClock(state.total)}</span></div></div>
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <button className="btn" onClick={() => timer.adjust(-15)} aria-label="Remover 15 segundos"><Minus /> 15s</button>
          {finished ? null : paused
            ? <button className="btn btn-primary" onClick={timer.resume}><Play /> Retomar</button>
            : <button className="btn" onClick={timer.pause}><Pause /> Pausar</button>}
          <button className="btn" onClick={() => timer.adjust(15)} aria-label="Adicionar 15 segundos"><Plus /> 15s</button>
        </div>
        <button className={`btn btn-block mt-3 ${finished ? 'btn-primary' : 'btn-ghost'}`} onClick={timer.skip}>
          {finished ? <><Check /> Próxima série</> : <><SkipForward /> Pular descanso</>}
        </button>
      </div>
    </div>
  );
}

export default function ActiveWorkout() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const prefs = usePrefs();
  const { map } = useExercises();
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [, setTick] = useState(0);
  const [restOpen, setRestOpen] = useState(true);
  const [picker, setPicker] = useState<'add' | 'replace' | null>(null);
  const [menu, setMenu] = useState(false);
  const [setMenuFor, setSetMenuFor] = useState<{ ex: number; set: number } | null>(null);
  const [info, setInfo] = useState(false);
  const [editEx, setEditEx] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  const timer = useRestTimer(() => {
    if (prefs.sound) beep();
    if (prefs.vibration) vibrate();
    setRestOpen(true);
    setTimeout(() => { if (document.visibilityState === 'visible') timer.skip(); }, 6000);
  });

  useEffect(() => {
    (async () => {
      const s = await getActiveSession();
      if (!s) { nav('/', { replace: true }); return; }
      setSession(s); sessionRef.current = s; setLoaded(true);
    })();
  }, [nav]);

  // clock
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // keep screen awake while training
  useEffect(() => {
    if (!prefs.keepAwake) return;
    void requestWakeLock();
    const onVis = () => { if (document.visibilityState === 'visible') void requestWakeLock(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void releaseWakeLock(); };
  }, [prefs.keepAwake]);

  const commit = useCallback((fn: (s: Session) => Session) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const next = fn(cur);
    sessionRef.current = next;
    setSession(next);
    void queueSave(next);
  }, []);

  const history = useHistory(session?.exercises.map((e) => e.exerciseId) ?? [], session?.id);

  const totals = useMemo(() => (session ? sessionTotals(session) : null), [session]);

  if (!loaded || !session || !totals) return <div className="splash"><div className="spinner" /></div>;

  const idx = Math.min(session.currentIndex, Math.max(0, session.exercises.length - 1));
  const cur: SessionExercise | undefined = session.exercises[idx];
  const curInfo = cur ? map.get(cur.exerciseId) : undefined;
  const next = session.exercises[idx + 1];
  const curHist = cur ? history[cur.exerciseId] ?? [] : [];
  const lastStat = curHist[curHist.length - 1];
  const suggestion = cur ? suggestNext(lastStat, cur.repMax, prefs.weightStep) : null;
  const plannedSets = session.exercises.reduce((a, e) => a + e.sets.length, 0);
  const elapsed = sessionDurationSec(session);
  const paused = session.pausedAt != null;

  const updateEx = (i: number, fn: (e: SessionExercise) => SessionExercise) =>
    commit((s) => ({ ...s, exercises: s.exercises.map((e, k) => (k === i ? fn(e) : e)) }));
  const updateSet = (ei: number, si: number, patch: Partial<SetLog>) =>
    updateEx(ei, (e) => ({ ...e, sets: e.sets.map((x, k) => (k === si ? { ...x, ...patch } : x)) }));
  const goTo = (i: number) => commit((s) => ({ ...s, currentIndex: Math.max(0, Math.min(i, s.exercises.length - 1)) }));

  const toggleSet = (si: number) => {
    if (!cur) return;
    unlockAudio();
    const set = cur.sets[si];
    if (set.done) { updateSet(idx, si, { done: false, completedAt: null }); return; }
    const prevSet = lastStat?.setsDetail[si] ?? lastStat?.setsDetail[lastStat.setsDetail.length - 1];
    const reps = set.reps ?? prevSet?.reps ?? cur.repMax;
    const weight = set.weight ?? prevSet?.weight ?? 0;
    if (!reps || reps <= 0) { toast('Informe as repetições', 'error'); return; }
    const sets = cur.sets.map((x, k) => (k === si ? { ...x, reps, weight, done: true, completedAt: Date.now() } : x));
    // propagate weight to following empty sets
    for (let k = si + 1; k < sets.length; k++) if (!sets[k].done && sets[k].weight == null) sets[k] = { ...sets[k], weight };
    const allDone = sets.every((x) => x.done);
    commit((s) => ({
      ...s,
      exercises: s.exercises.map((e, k) => (k === idx ? { ...e, sets } : e)),
      currentIndex: allDone && idx < s.exercises.length - 1 ? idx + 1 : s.currentIndex,
    }));
    if (prefs.vibration) vibrate(30);
    const isLastOverall = allDone && idx === session.exercises.length - 1;
    if (prefs.autoRest && cur.restSec > 0 && !isLastOverall) {
      timer.start(cur.restSec, allDone && next ? `Próximo: ${map.get(next.exerciseId)?.namePt ?? ''}` : `${curInfo?.namePt ?? ''} · série ${si + 2}`);
      setRestOpen(true);
    }
  };

  const addSet = () => {
    if (!cur) return;
    const last = cur.sets[cur.sets.length - 1];
    updateEx(idx, (e) => ({ ...e, sets: [...e.sets, { uid: uid(), weight: last?.weight ?? null, reps: null, targetWeight: last?.weight ?? null, done: false, completedAt: null, notes: '' }] }));
  };

  const togglePause = () => commit((s) => (s.pausedAt
    ? { ...s, pausedMs: s.pausedMs + (Date.now() - s.pausedAt), pausedAt: null }
    : { ...s, pausedAt: Date.now() }));

  const finish = async () => {
    if (finishing) return;
    if (totals.setsDone === 0) {
      if (await confirm({ title: 'Nenhuma série concluída', message: 'Não há séries registradas. Deseja descartar este treino?', confirmLabel: 'Descartar', danger: true })) {
        await writeQueue; await discardSession(session.id); clearRestTimer(); nav('/', { replace: true });
      }
      return;
    }
    const pending = plannedSets - totals.setsDone;
    const ok = await confirm({
      title: 'Finalizar treino?',
      message: pending > 0 ? `${pending} série${pending > 1 ? 's' : ''} não ${pending > 1 ? 'foram concluídas' : 'foi concluída'} e não ${pending > 1 ? 'serão contabilizadas' : 'será contabilizada'}.` : 'Ótimo trabalho! Todas as séries foram concluídas.',
      confirmLabel: 'Finalizar',
    });
    if (!ok) return;
    setFinishing(true);
    try {
      await writeQueue;
      const done = await finishSession(session.id);
      clearRestTimer();
      timer.skip();
      void backgroundSync();
      nav(`/historico/${done.id}?resumo=1`, { replace: true });
    } catch (e) {
      toast((e as Error).message, 'error');
      setFinishing(false);
    }
  };

  const discard = async () => {
    setMenu(false);
    if (await confirm({ title: 'Descartar treino?', message: 'Todas as séries registradas nesta sessão serão apagadas.', confirmLabel: 'Descartar', danger: true })) {
      await writeQueue; await discardSession(session.id); clearRestTimer(); timer.skip(); nav('/', { replace: true });
    }
  };

  const doneInCur = cur ? cur.sets.filter((s) => s.done).length : 0;

  return (
    <div className="workout">
      <header className="workout-top">
        <div className="row" style={{ maxWidth: 720, margin: '0 auto' }}>
          <button className="icon-btn" aria-label="Minimizar treino" onClick={() => nav('/')}><ChevronLeft /></button>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="xs muted truncate">{session.name}</div>
            <div className="elapsed" aria-label="Tempo decorrido">{fmtClock(elapsed)}{paused && <span className="xs dim" style={{ marginLeft: 8 }}>pausado</span>}</div>
          </div>
          <button className="icon-btn bordered" aria-label={paused ? 'Retomar cronômetro do treino' : 'Pausar cronômetro do treino'} onClick={togglePause}>{paused ? <Play /> : <Pause />}</button>
          <button className="icon-btn" aria-label="Mais opções" onClick={() => setMenu(true)}><MoreVertical /></button>
          <button className="btn btn-primary btn-sm" onClick={finish} disabled={finishing}><Flag /> Finalizar</button>
        </div>
        <div style={{ maxWidth: 720, margin: '8px auto 0' }}>
          <div className="row-between xs muted mono-num" style={{ marginBottom: 6 }}>
            <span>{totals.setsDone}/{plannedSets} séries</span>
            <span>{fmtVolume(totals.volume)} · {totals.reps} reps</span>
          </div>
          <div className="progress"><div style={{ width: `${plannedSets ? (totals.setsDone / plannedSets) * 100 : 0}%` }} /></div>
          <div className="ex-tabs" role="tablist" aria-label="Exercícios do treino">
            {session.exercises.map((e, i) => {
              const complete = e.sets.length > 0 && e.sets.every((s) => s.done);
              return (
                <button key={e.uid} role="tab" aria-selected={i === idx} className={`ex-tab${i === idx ? ' current' : ''}${complete ? ' complete' : ''}`} onClick={() => goTo(i)} title={map.get(e.exerciseId)?.namePt}>
                  {complete && <Check width={12} />}{i + 1}
                </button>
              );
            })}
            <button className="ex-tab" onClick={() => setPicker('add')} aria-label="Adicionar exercício"><Plus width={12} /></button>
          </div>
        </div>
      </header>

      <main className="workout-body">
        {!cur ? (
          <div className="empty">
            <div className="empty-icon"><Plus /></div>
            <h3>Treino livre</h3>
            <p>Adicione o primeiro exercício para começar a registrar suas séries.</p>
            <button className="btn btn-primary" onClick={() => setPicker('add')}><Plus /> Adicionar exercício</button>
          </div>
        ) : (
          <>
            <section>
              <div className="eyebrow">Exercício {idx + 1} de {session.exercises.length}{curInfo ? ` · ${MUSCLE_LABEL[curInfo.primary]}` : ''}</div>
              <div className="row mt-1" style={{ alignItems: 'flex-start' }}>
                <h1 style={{ fontSize: 22, flex: 1 }}>{curInfo?.namePt ?? 'Exercício removido'}</h1>
                <button className="icon-btn bordered sm" aria-label="Instruções do exercício" onClick={() => setInfo(true)}><Info /></button>
              </div>
              <div className="row wrap mt-2" style={{ gap: 6 }}>
                <span className="tag accent">{repRange(cur.repMin, cur.repMax)} reps</span>
                <button className="tag" style={{ cursor: 'pointer' }} onClick={() => setEditEx(true)} aria-label="Editar descanso e metas"><Timer width={12} /> {fmtClock(cur.restSec)} descanso</button>
                <span className="tag">{doneInCur} feitas · {cur.sets.length - doneInCur} restantes</span>
              </div>
              {cur.notes && <p className="small muted mt-2">📝 {cur.notes}</p>}
            </section>

            {suggestion && (
              <div className="card card-tight row mt-4" style={{ borderColor: 'var(--accent-line)', gap: 10 }}>
                <Lightbulb width={16} className="accent" style={{ flexShrink: 0 }} />
                <span className="xs muted">{suggestion.message}</span>
              </div>
            )}

            <section className="mt-4">
              <div className="set-head"><span>Série</span><span className="center">Anterior</span><span className="center">Kg</span><span className="center">Reps</span><span /></div>
              {cur.sets.map((s, si) => {
                const prev = lastStat?.setsDetail[si];
                return (
                  <div key={s.uid} className={`set-row${s.done ? ' done' : ''}`}>
                    <button className="set-n" onClick={() => setSetMenuFor({ ex: idx, set: si })} aria-label={`Opções da série ${si + 1}`}>{si + 1}</button>
                    <span className="prev">{prev ? `${fmtW(prev.weight)}×${prev.reps}` : '—'}</span>
                    <NumInput className="input set-input" decimal value={s.weight} min={0} max={1000} placeholder={prev ? String(prev.weight) : '0'} onChange={(v) => updateSet(idx, si, { weight: v })} aria-label={`Carga da série ${si + 1}`} />
                    <NumInput className="input set-input" value={s.reps} min={0} max={999} placeholder={String(prev?.reps ?? cur.repMax)} onChange={(v) => updateSet(idx, si, { reps: v })} aria-label={`Repetições da série ${si + 1}`} />
                    <button className={`set-check${s.done ? ' on' : ''}`} onClick={() => toggleSet(si)} aria-pressed={s.done} aria-label={s.done ? `Desmarcar série ${si + 1}` : `Concluir série ${si + 1}`}><Check /></button>
                    {s.notes && <span className="xs dim" style={{ gridColumn: '2 / -1' }}>📝 {s.notes}</span>}
                  </div>
                );
              })}
              <button className="btn btn-ghost btn-block mt-2" onClick={addSet}><Plus /> Adicionar série</button>
            </section>

            <section className="card mt-4">
              <div className="card-title"><h3 className="row"><History width={14} /> Histórico neste exercício</h3>{curInfo && <button className="xs accent" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => nav(`/progresso/${cur.exerciseId}`)}>Ver evolução</button>}</div>
              {curHist.length ? (
                <div className="list">
                  {curHist.slice(-3).reverse().map((h) => (
                    <div className="list-row" key={h.sessionId}>
                      <span className="xs dim mono-num" style={{ width: 44 }}>{fmtDateShort(h.date)}</span>
                      <span className="small grow mono-num" style={{ lineHeight: 1.6 }}>{h.setsDetail.map((d) => `${fmtW(d.weight)}×${d.reps}`).join('  ')}</span>
                      <span className="xs muted mono-num">{fmtVolume(h.volume)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="muted small">Primeira vez registrando este exercício.</p>}
            </section>

            {next && (
              <button className="card card-link row mt-4" style={{ width: '100%', textAlign: 'left' }} onClick={() => goTo(idx + 1)}>
                <div className="grow">
                  <div className="eyebrow">Próximo exercício</div>
                  <div className="small mt-1" style={{ fontWeight: 600 }}>{map.get(next.exerciseId)?.namePt}</div>
                  <div className="xs dim">{next.sets.length} séries · {repRange(next.repMin, next.repMax)} reps</div>
                </div>
                <ChevronRight className="dim" />
              </button>
            )}
          </>
        )}
      </main>

      <div className="workout-bar">
        <div className="workout-bar-inner">
          <button className="btn btn-lg" disabled={idx === 0} onClick={() => goTo(idx - 1)} aria-label="Exercício anterior"><ChevronLeft /></button>
          {next
            ? <button className="btn btn-lg grow" onClick={() => goTo(idx + 1)}>Próximo exercício <ChevronRight /></button>
            : <button className="btn btn-lg btn-primary grow" onClick={finish} disabled={finishing}><Flag /> Finalizar treino</button>}
        </div>
      </div>

      {timer.state && (restOpen
        ? <RestPanel timer={timer} onClose={() => setRestOpen(false)} />
        : <button className="rest-mini" style={{ bottom: 'calc(84px + var(--safe-bottom))' }} onClick={() => setRestOpen(true)} aria-label="Abrir cronômetro de descanso"><Timer /> {fmtClock(Math.ceil(timer.remaining))}</button>)}

      {/* Options menu */}
      <Sheet open={menu} onClose={() => setMenu(false)} title="Opções do treino">
        <div className="stack-sm">
          {cur && <button className="btn btn-block" onClick={() => { setMenu(false); setPicker('replace'); }}>Substituir exercício atual</button>}
          {cur && <button className="btn btn-block" onClick={() => { setMenu(false); setEditEx(true); }}>Metas, descanso e observação</button>}
          <button className="btn btn-block" onClick={() => { setMenu(false); setPicker('add'); }}><Plus /> Adicionar exercício</button>
          {cur && <button className="btn btn-block" onClick={async () => {
            setMenu(false);
            const hasDone = cur.sets.some((s) => s.done);
            if (hasDone && !(await confirm({ title: 'Remover exercício?', message: 'As séries concluídas deste exercício serão descartadas.', confirmLabel: 'Remover', danger: true }))) return;
            commit((s) => ({ ...s, exercises: s.exercises.filter((_, k) => k !== idx), currentIndex: Math.max(0, Math.min(s.currentIndex, s.exercises.length - 2)) }));
          }}><Trash2 /> Remover exercício atual</button>}
          {cur && idx > 0 && <button className="btn btn-block" onClick={() => { setMenu(false); commit((s) => { const ex = [...s.exercises]; [ex[idx - 1], ex[idx]] = [ex[idx], ex[idx - 1]]; return { ...s, exercises: ex, currentIndex: idx - 1 }; }); }}>Mover exercício para antes</button>}
          {cur && next && <button className="btn btn-block" onClick={() => { setMenu(false); commit((s) => { const ex = [...s.exercises]; [ex[idx + 1], ex[idx]] = [ex[idx], ex[idx + 1]]; return { ...s, exercises: ex, currentIndex: idx + 1 }; }); }}>Mover exercício para depois</button>}
          <button className="btn btn-block" onClick={() => { setMenu(false); timer.start(cur?.restSec || prefs.defaultRestSec, 'Descanso manual'); setRestOpen(true); }}><Timer /> Iniciar descanso manual</button>
          <hr className="divider" />
          <button className="btn btn-danger btn-block" onClick={discard}><X /> Descartar treino</button>
        </div>
      </Sheet>


      {/* Exercise settings */}
      <Sheet open={editEx && !!cur} onClose={() => setEditEx(false)} title="Ajustar exercício">
        {cur && (
          <div className="stack">
            <div className="grid grid-3">
              <div className="field"><label>Reps mín.</label><NumInput value={cur.repMin} min={1} max={100} onChange={(v) => updateEx(idx, (e) => ({ ...e, repMin: v ?? 1, repMax: Math.max(v ?? 1, e.repMax) }))} aria-label="Repetições mínimas" /></div>
              <div className="field"><label>Reps máx.</label><NumInput value={cur.repMax} min={1} max={100} onChange={(v) => updateEx(idx, (e) => ({ ...e, repMax: Math.max(v ?? 1, 1) }))} aria-label="Repetições máximas" /></div>
              <div className="field"><label>Descanso (s)</label><NumInput value={cur.restSec} min={0} max={900} onChange={(v) => updateEx(idx, (e) => ({ ...e, restSec: v ?? 0 }))} aria-label="Descanso em segundos" /></div>
            </div>
            <div className="field"><label htmlFor="ex-note">Observação</label>
              <textarea id="ex-note" className="textarea" maxLength={200} value={cur.notes} onChange={(e) => updateEx(idx, (x) => ({ ...x, notes: e.target.value }))} placeholder="Ex.: banco na posição 4" />
            </div>
            <button className="btn btn-primary btn-block" onClick={() => setEditEx(false)}>Concluir</button>
          </div>
        )}
      </Sheet>

      {/* Set options */}
      <Sheet open={!!setMenuFor} onClose={() => setSetMenuFor(null)} title={setMenuFor ? `Série ${setMenuFor.set + 1}` : ''}>
        {setMenuFor && session.exercises[setMenuFor.ex]?.sets[setMenuFor.set] && (
          <div className="stack">
            <div className="field">
              <label htmlFor="set-note">Observação</label>
              <input id="set-note" className="input" maxLength={120} placeholder="Ex.: falha técnica, drop-set, com pausa"
                value={session.exercises[setMenuFor.ex].sets[setMenuFor.set].notes}
                onChange={(e) => updateSet(setMenuFor.ex, setMenuFor.set, { notes: e.target.value })} />
            </div>
            <button className="btn btn-danger btn-block" disabled={session.exercises[setMenuFor.ex].sets.length <= 1} onClick={() => {
              const { ex, set } = setMenuFor;
              updateEx(ex, (e) => ({ ...e, sets: e.sets.filter((_, k) => k !== set) }));
              setSetMenuFor(null);
            }}><Trash2 /> Remover série</button>
          </div>
        )}
      </Sheet>

      {/* Exercise info */}
      <Sheet open={info} onClose={() => setInfo(false)} title={curInfo?.namePt ?? ''}>
        {curInfo && (
          <div className="stack">
            <ol className="numbered">{curInfo.instructions.map((t, i) => <li key={i}>{t}</li>)}</ol>
            <div className="section-title mt-2">Dicas</div>
            <ul className="bullets">{curInfo.tips.map((t, i) => <li key={i}><Check className="success" />{t}</li>)}</ul>
            <button className="btn btn-block" onClick={() => nav(`/exercicios/${curInfo.id}`)}>Ver página completa</button>
          </div>
        )}
      </Sheet>

      <ExercisePicker open={!!picker} multi={picker === 'add'} title={picker === 'replace' ? 'Substituir exercício' : 'Adicionar exercícios'} onClose={() => setPicker(null)} onPick={async (ids) => {
        const built = await Promise.all(ids.map((id) => buildSessionExercise(id, { sets: 3, restSec: prefs.defaultRestSec })));
        if (picker === 'replace' && cur) {
          const b = built[0];
          commit((s) => ({ ...s, exercises: s.exercises.map((e, k) => (k === idx ? { ...b, repMin: cur.repMin, repMax: cur.repMax, restSec: cur.restSec, sets: b.sets.slice(0, 1).length ? Array.from({ length: cur.sets.length }, (_, i) => ({ ...b.sets[Math.min(i, b.sets.length - 1)], uid: uid() })) : b.sets } : e)) }));
        } else {
          commit((s) => ({ ...s, exercises: [...s.exercises, ...built], currentIndex: s.exercises.length ? s.currentIndex : 0 }));
          if (session.exercises.length) toast(`${built.length} exercício${built.length > 1 ? 's' : ''} adicionado${built.length > 1 ? 's' : ''} ao final`);
        }
      }} />
    </div>
  );
}

