import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, ChartColumn, ChevronRight, Clock, FileDown, FileSpreadsheet, Flame, History, Layers, Timer, Trophy, Weight } from 'lucide-react';
import { db } from '../db/db';
import { useDoneSessions, useExercises, useProfile, useSchedule } from '../hooks/data';
import { addDays, DAY, parseDateInput, startOfDay, startOfWeek, toDateInput } from '../lib/date';
import { fmtDateShort, fmtDuration, fmtInt, fmtNum, fmtVolume, pctChange } from '../lib/format';
import { inRange, muscleDistribution, overview, previousPeriod, trainingStreak } from '../lib/stats';
import { perSession } from '../lib/analytics';
import type { SetEntry } from '../db/types';
import { exportReportPdf, exportSessionsCsv, exportSetsCsv } from '../lib/export';
import { MUSCLE_LABEL } from '../data/labels';
import { BarChart, HBars, LineChart } from '../components/charts/Charts';
import { Delta, Empty, Field, PageHeader, Segmented, Stat, useToast } from '../components/ui/ui';

type Period = '7' | '30' | '90' | '180' | '365' | 'custom';
const PERIODS: { value: Period; label: string; long: string }[] = [
  { value: '7', label: '7d', long: 'Últimos 7 dias' }, { value: '30', label: '30d', long: 'Últimos 30 dias' },
  { value: '90', label: '90d', long: 'Últimos 90 dias' }, { value: '180', label: '6m', long: 'Últimos 6 meses' },
  { value: '365', label: '1a', long: 'Último ano' }, { value: 'custom', label: 'Data', long: 'Período personalizado' },
];
type Series = 'volume' | 'reps' | 'count' | 'time';

export default function Reports() {
  const sessions = useDoneSessions();
  const { map: exMap } = useExercises();
  const profile = useProfile();
  const schedule = useSchedule();
  const records = useLiveQuery(() => db.records.toArray(), []) ?? [];
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('30');
  const [customFrom, setCustomFrom] = useState(toDateInput(addDays(Date.now(), -30)));
  const [customTo, setCustomTo] = useState(toDateInput(Date.now()));
  const [series, setSeries] = useState<Series>('volume');
  const [exId, setExId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const customInvalid = period === 'custom' && (!customFrom || !customTo || parseDateInput(customFrom) > parseDateInput(customTo));

  const [from, to] = useMemo<[number, number]>(() => {
    const end = startOfDay(Date.now()) + DAY - 1;
    if (period === 'custom') {
      if (customInvalid) return [end - 30 * DAY, end];
      return [parseDateInput(customFrom), parseDateInput(customTo) + DAY - 1];
    }
    return [startOfDay(addDays(Date.now(), -(Number(period) - 1))), end];
  }, [period, customFrom, customTo, customInvalid]);

  const d = useMemo(() => {
    const all = sessions ?? [];
    const cur = inRange(all, from, to).sort((a, b) => a.startedAt - b.startedAt);
    const [pf, pt] = previousPeriod(from, to);
    const prev = inRange(all, pf, pt);
    const days = Math.round((to - from) / DAY);
    const daily = days <= 31;
    const buckets: { start: number; count: number; volume: number; reps: number; time: number }[] = [];
    for (let t = daily ? startOfDay(from) : startOfWeek(from); t <= to; t = addDays(t, daily ? 1 : 7)) buckets.push({ start: t, count: 0, volume: 0, reps: 0, time: 0 });
    for (const s of cur) {
      const k = daily ? startOfDay(s.startedAt) : startOfWeek(s.startedAt);
      const b = buckets.find((x) => x.start === k);
      if (b) { b.count++; b.volume += s.volume; b.reps += s.reps; b.time += s.durationSec; }
    }
    // exercises in period
    const exSessions = new Map<string, Set<string>>();
    for (const s of cur) for (const e of s.exercises) if (e.sets.some((x) => x.done)) {
      if (!exSessions.has(e.exerciseId)) exSessions.set(e.exerciseId, new Set());
      exSessions.get(e.exerciseId)!.add(s.id);
    }
    return {
      cur, prev, daily, buckets,
      ov: overview(cur, from, to), pov: overview(prev, pf, pt),
      muscles: muscleDistribution(cur, exMap),
      exercises: [...exSessions.entries()].sort((a, b) => b[1].size - a[1].size).map(([id, s]) => ({ id, count: s.size })),
    };
  }, [sessions, from, to, exMap]);

  const selectedEx = exId && d.exercises.some((e) => e.id === exId) ? exId : d.exercises[0]?.id ?? '';
  const exEntries = useLiveQuery(() => (selectedEx ? db.sets.where('exerciseId').equals(selectedEx).toArray() : Promise.resolve([] as SetEntry[])), [selectedEx]) ?? [];
  const exStats = useMemo(() => perSession(exEntries.filter((e) => e.date >= from && e.date <= to)), [exEntries, from, to]);

  // top exercises evolution (first vs last session in the period)
  const allEntries = useLiveQuery(() => db.sets.where('date').between(from, to, true, true).toArray(), [from, to]) ?? [];
  const topExercises = useMemo(() => {
    const by = new Map<string, typeof allEntries>();
    for (const e of allEntries) by.set(e.exerciseId, [...(by.get(e.exerciseId) ?? []), e]);
    return [...by.entries()].map(([id, list]) => {
      const st = perSession(list);
      const first = st[0], last = st[st.length - 1];
      return {
        id, name: exMap.get(id)?.namePt ?? 'Exercício', sessions: st.length,
        volume: st.reduce((a, s) => a + s.volume, 0), bestWeight: Math.max(...st.map((s) => s.topWeight)),
        change: st.length > 1 ? pctChange(last.bestE1RM, first.bestE1RM) : null,
      };
    }).sort((a, b) => b.sessions - a.sessions || b.volume - a.volume).slice(0, 10);
  }, [allEntries, exMap]);

  if (sessions === undefined) return <div className="page" />;
  const periodLabel = PERIODS.find((p) => p.value === period)!.long;
  const suffix = `${toDateInput(from)}_${toDateInput(to)}`;

  const seriesData = d.buckets.map((b) => ({
    x: b.start, label: fmtDateShort(b.start),
    y: series === 'volume' ? b.volume : series === 'reps' ? b.reps : series === 'count' ? b.count : Math.round(b.time / 60),
  }));
  const seriesFmt = (v: number) => (series === 'volume' ? fmtVolume(v) : series === 'time' ? `${fmtInt(v)}min` : fmtInt(v));

  return (
    <div className="page">
      <PageHeader title="Relatórios" sub={periodLabel} actions={<Link to="/historico" className="btn btn-sm"><History /> Histórico</Link>} />
      <Segmented label="Período" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
      {period === 'custom' && (
        <div className="grid grid-2 mt-3">
          <Field label="De" error={customInvalid ? 'Data inicial deve ser anterior à final.' : null}><input type="date" className="input" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
          <Field label="Até"><input type="date" className="input" value={customTo} max={toDateInput(Date.now())} onChange={(e) => setCustomTo(e.target.value)} /></Field>
        </div>
      )}

      <div className="section-title section">Visão geral <span className="xs">vs. período anterior</span></div>
      <div className="grid grid-4">
        <Stat icon={CalendarDays} label="Treinos" value={d.ov.sessions} hint={<Delta value={pctChange(d.ov.sessions, d.pov.sessions)} />} />
        <Stat icon={ChartColumn} label="Frequência semanal" value={fmtNum(d.ov.perWeek)} unit="x" hint={<Delta value={pctChange(d.ov.perWeek, d.pov.perWeek)} />} />
        <Stat icon={Clock} label="Tempo total" value={fmtDuration(d.ov.durationSec)} hint={<Delta value={pctChange(d.ov.durationSec, d.pov.durationSec)} />} />
        <Stat icon={Weight} label="Volume total" value={fmtVolume(d.ov.volume)} hint={<Delta value={pctChange(d.ov.volume, d.pov.volume)} />} />
        <Stat icon={Timer} label="Duração média" value={fmtDuration(d.ov.avgDurationSec)} hint={<Delta value={pctChange(d.ov.avgDurationSec, d.pov.avgDurationSec)} />} />
        <Stat icon={Layers} label="Séries" value={fmtInt(d.ov.sets)} hint={<Delta value={pctChange(d.ov.sets, d.pov.sets)} />} />
        <Stat icon={Layers} label="Repetições" value={fmtInt(d.ov.reps)} hint={<Delta value={pctChange(d.ov.reps, d.pov.reps)} />} />
        <Stat icon={Flame} label="Sequência atual" value={trainingStreak(sessions, schedule)} unit={trainingStreak(sessions, schedule) === 1 ? ' dia' : ' dias'} />
      </div>

      {!d.cur.length ? (
        <div className="card section"><Empty icon={ChartColumn} title="Sem treinos neste período" text="Selecione outro período ou finalize um treino para gerar estatísticas." /></div>
      ) : (
        <>
          <div className="grid md-grid-2 section">
            <section className="card">
              <div className="card-title"><h3>Evolução {d.daily ? 'diária' : 'semanal'}</h3></div>
              <Segmented label="Métrica" value={series} onChange={setSeries} options={[{ value: 'volume', label: 'Volume' }, { value: 'reps', label: 'Reps' }, { value: 'count', label: 'Treinos' }, { value: 'time', label: 'Tempo' }]} />
              <div className="mt-3"><BarChart ariaLabel="Evolução no período" data={seriesData} format={seriesFmt} /></div>
            </section>

            <section className="card">
              <div className="card-title"><h3>Progressão de carga</h3></div>
              <select className="select" value={selectedEx} onChange={(e) => setExId(e.target.value)} aria-label="Exercício">
                {d.exercises.map((e) => <option key={e.id} value={e.id}>{exMap.get(e.id)?.namePt ?? 'Exercício'} ({e.count})</option>)}
              </select>
              <div className="mt-3"><LineChart ariaLabel="Carga máxima por sessão" data={exStats.map((s) => ({ x: s.date, y: s.topWeight, label: fmtDateShort(s.date) }))} format={(v) => `${fmtNum(v)}kg`} /></div>
              {selectedEx && <Link to={`/progresso/${selectedEx}`} className="xs accent row mt-2" style={{ justifyContent: 'flex-end' }}>Análise completa <ChevronRight width={12} /></Link>}
            </section>
          </div>

          <div className="grid md-grid-2 section">
            <section className="card">
              <div className="card-title"><h3>Frequência por grupo muscular</h3><span className="xs muted">séries</span></div>
              <HBars items={d.muscles.map((m) => ({ label: MUSCLE_LABEL[m.group], value: m.sets }))} />
            </section>
            <section className="card">
              <div className="card-title"><h3>Evolução por exercício</h3><span className="xs muted">1RM estimado</span></div>
              <div className="list">
                {topExercises.map((e) => (
                  <Link to={`/progresso/${e.id}`} key={e.id} className="list-row clickable">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="list-title truncate">{e.name}</div>
                      <div className="list-sub">{e.sessions} sessões · {fmtVolume(e.volume)} · máx {fmtNum(e.bestWeight)} kg</div>
                    </div>
                    <Delta value={e.change} />
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <section className="card section">
            <div className="card-title"><h3>Comparação entre períodos</h3></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr className="dim" style={{ textAlign: 'right' }}><th style={{ textAlign: 'left', fontWeight: 500, padding: '6px 0' }}>Indicador</th><th style={{ fontWeight: 500 }}>Anterior</th><th style={{ fontWeight: 500 }}>Atual</th><th style={{ fontWeight: 500 }}>Var.</th></tr></thead>
                <tbody className="mono-num">
                  {[
                    ['Treinos', d.pov.sessions, d.ov.sessions, fmtInt],
                    ['Volume', d.pov.volume, d.ov.volume, fmtVolume],
                    ['Séries', d.pov.sets, d.ov.sets, fmtInt],
                    ['Repetições', d.pov.reps, d.ov.reps, fmtInt],
                    ['Tempo', d.pov.durationSec, d.ov.durationSec, fmtDuration],
                  ].map(([l, p, c, f]) => (
                    <tr key={l as string} style={{ borderTop: '1px solid var(--border)', textAlign: 'right' }}>
                      <td style={{ textAlign: 'left', padding: '8px 0' }} className="muted">{l as string}</td>
                      <td className="dim">{(f as (n: number) => string)(p as number)}</td>
                      <td>{(f as (n: number) => string)(c as number)}</td>
                      <td><Delta value={pctChange(c as number, p as number)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="card section">
        <div className="card-title"><h3>Exportar</h3><span className="xs muted">{d.cur.length} treinos no período</span></div>
        <div className="grid md-grid-3" style={{ gap: 8 }}>
          <button className="btn btn-primary" disabled={busy || customInvalid} onClick={async () => {
            setBusy(true);
            try {
              await exportReportPdf({
                profile, periodLabel, from, to, overview: d.ov, previous: d.pov, streak: trainingStreak(sessions, schedule),
                sessions: [...d.cur].reverse(), muscles: d.muscles.map((m) => ({ group: MUSCLE_LABEL[m.group], sets: m.sets })),
                topExercises, records, exMap,
              });
              toast('Relatório PDF gerado');
            } catch (e) { toast(`Falha ao gerar PDF: ${(e as Error).message}`, 'error'); }
            setBusy(false);
          }}><FileDown /> Relatório PDF</button>
          <button className="btn" disabled={!d.cur.length} onClick={() => { exportSessionsCsv(d.cur, suffix); toast('CSV de treinos exportado'); }}><FileSpreadsheet /> Treinos (CSV)</button>
          <button className="btn" disabled={!d.cur.length} onClick={() => { exportSetsCsv(d.cur, exMap, suffix); toast('CSV de séries exportado'); }}><FileSpreadsheet /> Séries (CSV)</button>
        </div>
      </section>

      <Link to="/recordes" className="card card-link row section">
        <Trophy width={18} style={{ color: '#fcd34d' }} />
        <span className="grow"><b className="small">Recordes pessoais</b><span className="xs muted" style={{ display: 'block' }}>{records.length ? `${new Set(records.map((r) => r.exerciseId)).size} exercícios com recordes` : 'Nenhum recorde ainda'}</span></span>
        <ChevronRight className="dim" width={16} />
      </Link>
    </div>
  );
}
