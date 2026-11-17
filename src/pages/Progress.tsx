import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ChevronRight, Info, Search, TrendingUp, Trophy } from 'lucide-react';
import { db } from '../db/db';
import { useExercises } from '../hooks/data';
import { analyzeProgression, perSession, recordHistory, RECORD_TYPES } from '../lib/analytics';
import { fmtDate, fmtDateShort, fmtKg, fmtNum, fmtVolume, fmtW, pctChange } from '../lib/format';
import { MUSCLE_LABEL, RECORD_LABEL } from '../data/labels';
import type { RecordType } from '../db/types';
import { LineChart } from '../components/charts/Charts';
import { Delta, Empty, PageHeader, Segmented, Stat } from '../components/ui/ui';
import { normalize } from '../components/ExercisePicker';

type Metric = 'carga' | 'e1rm' | 'volume' | 'reps';
const METRICS: { value: Metric; label: string }[] = [
  { value: 'carga', label: 'Carga' }, { value: 'e1rm', label: '1RM est.' }, { value: 'volume', label: 'Volume' }, { value: 'reps', label: 'Reps' },
];

const fmtRec = (t: RecordType, v: number) => (t === 'maxReps' ? `${v} reps` : fmtKg(Math.round(v * 10) / 10));

export function ExerciseProgress() {
  const { id } = useParams();
  const { map } = useExercises();
  const ex = map.get(id!);
  const entries = useLiveQuery(() => db.sets.where('exerciseId').equals(id!).toArray(), [id]);
  const [metric, setMetric] = useState<Metric>('carga');
  const [recType, setRecType] = useState<RecordType>('maxWeight');

  const stats = useMemo(() => perSession(entries ?? []), [entries]);
  const analysis = useMemo(() => analyzeProgression(stats), [stats]);
  const recHist = useMemo(() => recordHistory(entries ?? [], recType), [entries, recType]);

  if (entries === undefined) return <div className="page" />;
  const title = ex?.namePt ?? 'Exercício';

  if (!stats.length) {
    return (
      <div className="page page-narrow">
        <PageHeader title={title} back />
        <div className="card"><Empty icon={TrendingUp} title="Sem registros ainda" text="Conclua séries deste exercício em um treino para acompanhar a evolução." /></div>
      </div>
    );
  }

  const series = stats.map((s) => ({
    x: s.date, label: fmtDateShort(s.date),
    y: metric === 'carga' ? s.topWeight : metric === 'e1rm' ? Math.round(s.bestE1RM * 10) / 10 : metric === 'volume' ? s.volume : s.reps,
  }));
  const fmt = (v: number) => (metric === 'reps' ? fmtNum(v) : metric === 'volume' ? fmtVolume(v) : `${fmtNum(v)}kg`);
  const { last, previous } = analysis;

  return (
    <div className="page page-narrow">
      <PageHeader title={title} sub={ex ? `${MUSCLE_LABEL[ex.primary]} · ${stats.length} sessões` : undefined} back
        actions={ex ? <Link to={`/exercicios/${ex.id}`} className="icon-btn bordered" aria-label="Detalhes do exercício"><Info /></Link> : undefined} />

      {analysis.stagnant ? (
        <div className="card card-tight row" style={{ borderColor: 'rgba(245, 158, 11, 0.35)', gap: 10 }}>
          <AlertTriangle width={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div className="small"><b>Sem progressão há {analysis.sessionsWithoutProgress} sessões</b><div className="xs muted">Última melhora em {fmtDate(analysis.lastProgressDate!)}. Considere ajustar faixa de repetições, descanso, volume ou fazer um deload.</div></div>
        </div>
      ) : analysis.improvements.length > 0 ? (
        <div className="card card-tight" style={{ borderColor: 'rgba(34, 197, 94, 0.3)' }}>
          <div className="row small" style={{ gap: 8 }}><TrendingUp width={16} className="success" /><b>Evolução na última sessão</b></div>
          <div className="row wrap mt-2" style={{ gap: 6 }}>
            {analysis.improvements.map((i, k) => <span key={k} className="tag success">{i.label} {i.kind === 'volume' ? `+${fmtVolume(i.delta)}` : i.kind === 'repeticoes' ? `+${i.delta}` : `+${fmtNum(i.delta)} kg`}</span>)}
          </div>
        </div>
      ) : null}

      <div className="grid grid-4 mt-4">
        <Stat label="Carga máxima (última)" value={fmtKg(last!.topWeight)} hint={`${last!.topWeightReps} reps`} />
        <Stat label="1RM estimado" value={fmtKg(Math.round(last!.bestE1RM * 10) / 10)} hint={previous ? <Delta value={pctChange(last!.bestE1RM, previous.bestE1RM)} /> : 'Epley'} />
        <Stat label="Volume (última)" value={fmtVolume(last!.volume)} hint={previous ? <Delta value={pctChange(last!.volume, previous.volume)} /> : '—'} />
        <Stat label="Repetições (última)" value={last!.reps} hint={`${last!.sets} séries`} />
      </div>

      <section className="card section">
        <div className="card-title"><h3>Evolução</h3></div>
        <Segmented label="Métrica" value={metric} onChange={setMetric} options={METRICS} />
        <div className="mt-3"><LineChart ariaLabel={`Evolução de ${title}`} data={series} format={fmt} /></div>
      </section>

      <section className="card section">
        <div className="card-title"><h3 className="row"><Trophy width={15} style={{ color: '#fcd34d' }} /> Recordes</h3></div>
        <div className="grid grid-2">
          {RECORD_TYPES.map((t) => {
            const h = recordHistory(entries, t);
            const r = h[h.length - 1];
            return (
              <button key={t} className="stat" style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--bg)', borderColor: recType === t ? 'var(--accent)' : undefined }} onClick={() => setRecType(t)} aria-pressed={recType === t}>
                <div className="stat-label">{RECORD_LABEL[t]}</div>
                <div className="stat-value" style={{ fontSize: 16 }}>{r ? fmtRec(t, r.value) : '—'}</div>
                {r && <div className="stat-hint">{fmtDate(r.date)}{t !== 'maxExerciseVolume' ? ` · ${fmtW(r.weight)}×${r.reps}` : ''}</div>}
              </button>
            );
          })}
        </div>
        <div className="section-title mt-4">Histórico — {RECORD_LABEL[recType]}</div>
        <div className="list">
          {[...recHist].reverse().map((r, i, arr) => (
            <Link key={r.sessionId} to={`/historico/${r.sessionId}`} className="list-row clickable">
              <span className="xs dim mono-num" style={{ width: 90 }}>{fmtDate(r.date)}</span>
              <span className="grow small mono-num" style={{ fontWeight: 600 }}>{fmtRec(recType, r.value)}</span>
              {arr[i + 1] && <span className="xs success mono-num">+{recType === 'maxReps' ? r.value - arr[i + 1].value : fmtNum(r.value - arr[i + 1].value)}</span>}
            </Link>
          ))}
        </div>
      </section>

      <section className="card section">
        <div className="card-title"><h3>Comparação entre sessões</h3></div>
        <div className="list">
          {[...stats].reverse().slice(0, 12).map((s, i, arr) => {
            const prev = arr[i + 1];
            return (
              <Link to={`/historico/${s.sessionId}`} key={s.sessionId} className="list-row clickable" style={{ alignItems: 'flex-start' }}>
                <span className="xs dim mono-num" style={{ width: 44, paddingTop: 2 }}>{fmtDateShort(s.date)}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="small mono-num" style={{ lineHeight: 1.6 }}>{s.setsDetail.map((d) => `${fmtW(d.weight)}×${d.reps}`).join('  ')}</div>
                  <div className="xs muted mono-num">{fmtVolume(s.volume)} · {s.reps} reps · máx {fmtKg(s.topWeight)}</div>
                </div>
                {prev ? <Delta value={pctChange(s.volume, prev.volume)} /> : <span className="delta flat">1ª</span>}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function Records() {
  const { map } = useExercises();
  const records = useLiveQuery(() => db.records.toArray(), []);
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const by = new Map<string, Partial<Record<RecordType, { value: number; date: number }>>>();
    for (const r of records ?? []) {
      by.set(r.exerciseId, { ...(by.get(r.exerciseId) ?? {}), [r.type]: { value: r.value, date: r.date } });
    }
    const nq = normalize(q);
    return [...by.entries()]
      .map(([id, rec]) => ({ id, name: map.get(id)?.namePt ?? 'Exercício removido', rec, last: Math.max(...Object.values(rec).map((x) => x!.date)) }))
      .filter((r) => !nq || normalize(r.name).includes(nq))
      .sort((a, b) => b.last - a.last);
  }, [records, map, q]);

  return (
    <div className="page page-narrow">
      <PageHeader title="Recordes pessoais" sub="Registrados automaticamente a cada treino" back />
      {records && records.length > 0 && <div className="search"><Search aria-hidden /><input className="input" placeholder="Buscar exercício" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar exercício" /></div>}
      {records && !records.length && <div className="card"><Empty icon={Trophy} title="Nenhum recorde ainda" text="Maior carga, mais repetições, maior volume por série e por exercício são registrados automaticamente quando você finaliza treinos." /></div>}
      <div className="stack mt-4">
        {rows.map((r) => (
          <Link to={`/progresso/${r.id}`} key={r.id} className="card card-link">
            <div className="row-between"><b className="truncate">{r.name}</b><ChevronRight className="dim" width={16} /></div>
            <div className="grid grid-4 mt-3" style={{ gap: 8 }}>
              {RECORD_TYPES.map((t) => (
                <div key={t}>
                  <div className="xs dim">{RECORD_LABEL[t]}</div>
                  <div className="small mono-num" style={{ fontWeight: 600 }}>{r.rec[t] ? fmtRec(t, r.rec[t]!.value) : '—'}</div>
                  {r.rec[t] && <div className="xs dim">{fmtDateShort(r.rec[t]!.date)}</div>}
                </div>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
