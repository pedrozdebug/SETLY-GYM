import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, CheckCircle2, ChevronRight, Clock, Dumbbell, History as HistoryIcon, Layers, Repeat, Trash2, Trophy, Weight } from 'lucide-react';
import { db } from '../db/db';
import { deleteSession } from '../db/repo';
import { useDoneSessions, useExercises } from '../hooks/data';
import { exerciseTotals, isCompleted } from '../lib/analytics';
import { fmtDate, fmtDuration, fmtKg, fmtVolume, fmtW, pctChange } from '../lib/format';
import { RECORD_LABEL } from '../data/labels';
import { Delta, Empty, PageHeader, Stat, useConfirm, useToast } from '../components/ui/ui';

export function HistoryList() {
  const sessions = useDoneSessions();
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof sessions>>();
    for (const s of sessions ?? []) {
      const k = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(s.startedAt);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [sessions]);

  return (
    <div className="page page-narrow">
      <PageHeader title="Histórico" sub={sessions ? `${sessions.length} treinos registrados` : ''} back />
      {sessions && !sessions.length && <div className="card"><Empty icon={HistoryIcon} title="Nenhum treino registrado" text="Os treinos finalizados aparecem aqui com todas as séries, cargas e repetições." /></div>}
      {groups.map(([month, list]) => (
        <section className="section" key={month}>
          <div className="section-title" style={{ textTransform: 'capitalize' }}>{month} <span>{list.length}</span></div>
          <div className="stack-sm">
            {list.map((s) => (
              <Link key={s.id} to={`/historico/${s.id}`} className="card card-link card-tight">
                <div className="row">
                  <div className="ex-icon" style={{ flexDirection: 'column', gap: 0, lineHeight: 1 }}>
                    <b style={{ fontSize: 14, color: 'var(--text)' }}>{new Date(s.startedAt).getDate()}</b>
                    <span className="xs dim" style={{ fontSize: 9, textTransform: 'uppercase' }}>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(s.startedAt).replace('.', '')}</span>
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row"><span className="truncate" style={{ fontWeight: 600 }}>{s.name}</span>{s.prs.length > 0 && <span className="pr-badge"><Trophy /> {s.prs.length}</span>}</div>
                    <div className="xs muted mono-num">{fmtDuration(s.durationSec)} · {s.exercises.filter((e) => e.sets.some(isCompleted)).length} exercícios · {s.setsDone} séries · {fmtVolume(s.volume)}</div>
                  </div>
                  <ChevronRight className="dim" width={16} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SessionDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const summary = params.get('resumo') === '1';
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { map } = useExercises();
  const session = useLiveQuery(() => db.sessions.get(id!), [id]);
  const previous = useLiveQuery(async () => {
    if (!session) return null;
    const all = await db.sessions.where('status').equals('done').toArray();
    return all
      .filter((s) => s.id !== session.id && s.startedAt < session.startedAt && (session.routineId ? s.routineId === session.routineId : s.name === session.name))
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;
  }, [session?.id]);

  if (session === undefined) return <div className="page" />;
  if (!session) return <div className="page"><PageHeader title="Treino" back="/historico" /><Empty icon={Dumbbell} title="Treino não encontrado" /></div>;

  const doneExercises = session.exercises.filter((e) => e.sets.some(isCompleted));

  return (
    <div className="page page-narrow">
      {summary ? (
        <header className="hero" style={{ marginBottom: 16 }}>
          <div className="row" style={{ gap: 10 }}><CheckCircle2 className="accent" /><span className="eyebrow accent">Treino concluído</span></div>
          <h1 style={{ fontSize: 22, marginTop: 8 }}>{session.name}</h1>
          <p className="muted small mt-1">{fmtDate(session.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })} · salvo no histórico</p>
        </header>
      ) : (
        <PageHeader title={session.name} sub={fmtDate(session.startedAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} back="/historico" />
      )}

      <div className="grid grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Stat icon={Clock} label="Duração" value={fmtDuration(session.durationSec)} />
        <Stat icon={Dumbbell} label="Exercícios" value={doneExercises.length} />
        <Stat icon={Layers} label="Séries" value={session.setsDone} />
        <Stat icon={Repeat} label="Repetições" value={session.reps} />
        <Stat icon={Weight} label="Volume" value={fmtVolume(session.volume)} />
      </div>

      {session.prs.length > 0 && (
        <section className="card section" style={{ borderColor: 'rgba(252, 211, 77, 0.3)' }}>
          <div className="card-title"><h3 className="row"><Trophy width={15} style={{ color: '#fcd34d' }} /> Recordes pessoais</h3><span className="xs muted">{session.prs.length}</span></div>
          <div className="list">
            {session.prs.map((p, i) => (
              <Link to={`/progresso/${p.exerciseId}`} className="list-row clickable" key={i}>
                <div className="grow">
                  <div className="list-title">{map.get(p.exerciseId)?.namePt ?? 'Exercício'}</div>
                  <div className="list-sub">{RECORD_LABEL[p.type]}{p.previous != null ? ` · antes ${p.type === 'maxReps' ? p.previous : fmtKg(p.previous)}` : ''}</div>
                </div>
                <span className="small mono-num" style={{ fontWeight: 600 }}>{p.type === 'maxReps' ? `${p.value} reps` : fmtKg(p.value)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {previous !== undefined && (
        <section className="card section">
          <div className="card-title"><h3>Comparação com o último treino</h3>{previous && <span className="xs muted">{fmtDate(previous.startedAt)}</span>}</div>
          {previous ? (
            <div className="list">
              {[
                { l: 'Volume', c: session.volume, p: previous.volume, f: fmtVolume },
                { l: 'Séries', c: session.setsDone, p: previous.setsDone, f: String },
                { l: 'Repetições', c: session.reps, p: previous.reps, f: String },
                { l: 'Duração', c: session.durationSec, p: previous.durationSec, f: fmtDuration, neutral: true },
              ].map((r) => (
                <div className="list-row" key={r.l}>
                  <span className="grow small muted">{r.l}</span>
                  <span className="xs dim mono-num">{r.f(r.p)} →</span>
                  <span className="small mono-num" style={{ fontWeight: 600 }}>{r.f(r.c)}</span>
                  {r.neutral ? <span className="delta flat">{pctChange(r.c, r.p) == null ? '—' : `${Math.round(pctChange(r.c, r.p)!)}%`}</span> : <Delta value={pctChange(r.c, r.p)} />}
                </div>
              ))}
            </div>
          ) : <p className="muted small">Primeira vez realizando este treino — a comparação aparece a partir da próxima sessão.</p>}
        </section>
      )}

      <div className="section-title section">Exercícios</div>
      <div className="stack">
        {session.exercises.map((e) => {
          const t = exerciseTotals(e);
          const info = map.get(e.exerciseId);
          return (
            <article className="card" key={e.uid}>
              <div className="row-between">
                <Link to={info ? `/progresso/${e.exerciseId}` : '#'} className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 600 }}>{info?.namePt ?? 'Exercício removido'}</div>
                  <div className="xs muted">{t.setsDone} séries · {t.reps} reps · {fmtVolume(t.volume)}</div>
                </Link>
              </div>
              <div className="list mt-2">
                {e.sets.map((s, i) => (
                  <div key={s.uid} className="list-row" style={{ padding: '8px 0', opacity: isCompleted(s) ? 1 : 0.4 }}>
                    <span className="tag mono-num" style={{ width: 28, justifyContent: 'center' }}>{i + 1}</span>
                    <span className="grow small mono-num">{isCompleted(s) ? `${fmtW(s.weight ?? 0)} kg × ${s.reps}` : 'não concluída'}</span>
                    {s.notes && <span className="xs dim truncate" style={{ maxWidth: 140 }}>{s.notes}</span>}
                    {isCompleted(s) && <span className="xs muted mono-num">{fmtVolume((s.weight ?? 0) * (s.reps ?? 0))}</span>}
                  </div>
                ))}
              </div>
              {e.notes && <p className="xs muted mt-2">📝 {e.notes}</p>}
            </article>
          );
        })}
      </div>

      <div className="row mt-6" style={{ gap: 8 }}>
        {summary
          ? <button className="btn btn-primary btn-lg grow" onClick={() => nav('/', { replace: true })}>Concluir</button>
          : <button className="btn btn-danger grow" onClick={async () => {
            if (await confirm({ title: 'Excluir treino?', message: 'O treino será removido do histórico e os recordes serão recalculados.', confirmLabel: 'Excluir', danger: true })) {
              await deleteSession(session.id); toast('Treino excluído'); nav('/historico', { replace: true });
            }
          }}><Trash2 /> Excluir treino</button>}
      </div>
      <p className="xs dim center mt-3"><CalendarDays width={12} style={{ verticalAlign: -2 }} /> Iniciado às {new Date(session.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}{session.endedAt ? ` · finalizado às ${new Date(session.endedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
    </div>
  );
}
