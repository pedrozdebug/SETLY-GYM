import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, Clock, Dumbbell, Flame, Moon, Play, Trophy, TrendingUp, Weight } from 'lucide-react';
import { useActiveSession, useDoneSessions, useExercises, useProfile, useRoutines, useSchedule } from '../hooks/data';
import { addDays, startOfDay, startOfWeek } from '../lib/date';
import { fmtDateShort, fmtDuration, fmtKg, fmtRelativeDay, fmtVolume, fmtWeekdayLong, pctChange } from '../lib/format';
import { nextScheduled, overview, trainingStreak, weeklySeries } from '../lib/stats';
import { WEEKDAYS, WEEKDAYS_SHORT, RECORD_LABEL } from '../data/labels';
import { BarChart } from '../components/charts/Charts';
import { Delta, Empty, Stat } from '../components/ui/ui';
import { StartWorkoutSheet, useStartWorkout } from '../components/StartWorkout';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Dashboard() {
  const profile = useProfile();
  const sessions = useDoneSessions();
  const routines = useRoutines() ?? [];
  const schedule = useSchedule();
  const active = useActiveSession();
  const { map: exMap } = useExercises();
  const start = useStartWorkout();
  const nav = useNavigate();
  const [pick, setPick] = useState(false);

  const data = useMemo(() => {
    const all = sessions ?? [];
    const wStart = startOfWeek(Date.now());
    const thisWeek = all.filter((s) => s.startedAt >= wStart);
    const lastWeek = all.filter((s) => s.startedAt >= addDays(wStart, -7) && s.startedAt < wStart);
    const weeks = weeklySeries(all, addDays(wStart, -7 * 7), Date.now());
    const trainedDays = new Set(thisWeek.map((s) => startOfDay(s.startedAt)));
    const recentPRs = all.flatMap((s) => s.prs.map((p) => ({ ...p, date: s.startedAt, sessionId: s.id }))).slice(0, 5);
    return {
      week: overview(thisWeek), lastWeek: overview(lastWeek), weeks, trainedDays, recentPRs,
      streak: trainingStreak(all, schedule), last: all[0], next: nextScheduled(schedule, routines, all), total: all.length,
    };
  }, [sessions, schedule, routines]);

  if (sessions === undefined) return <div className="page" />;

  const wStart = startOfWeek(Date.now());
  const today = startOfDay(Date.now());
  const firstName = profile.name.split(' ')[0];

  return (
    <div className="page">
      <header className="row-between" style={{ marginBottom: 20 }}>
        <div className="grow">
          <div className="eyebrow">{fmtWeekdayLong(Date.now())}</div>
          <h1 style={{ fontSize: 22, marginTop: 4 }}>{greeting()}{firstName ? `, ${firstName}` : ''}.</h1>
        </div>
        <Link to="/perfil" className="avatar" aria-label="Perfil">
          {profile.photo ? <img src={profile.photo} alt="" /> : (firstName[0] ?? '?').toUpperCase()}
        </Link>
      </header>

      {/* Hero / start */}
      <section className="hero">
        {active ? (
          <>
            <div className="eyebrow accent">Treino em andamento</div>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>{active.name}</h2>
            <p className="muted small mt-1">Seu progresso foi salvo automaticamente.</p>
            <button className="btn btn-primary btn-lg mt-4" onClick={() => nav('/treino')}><Play /> Continuar treino</button>
          </>
        ) : data.next ? (
          <>
            <div className="eyebrow accent">{data.next.isToday ? 'Treino de hoje' : `Próximo treino · ${WEEKDAYS[new Date(data.next.date).getDay()]}`}</div>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>{data.next.routine.name}</h2>
            <p className="muted small mt-1">{data.next.routine.exercises.length} exercícios · {data.next.routine.exercises.reduce((a, x) => a + x.sets, 0)} séries</p>
            <div className="row mt-4 wrap">
              <button className="btn btn-primary btn-lg" onClick={() => start(data.next!.routine.id)}><Play /> Iniciar treino</button>
              <button className="btn btn-lg btn-ghost" onClick={() => setPick(true)}>Outro treino</button>
            </div>
          </>
        ) : (
          <>
            <div className="eyebrow accent">Pronto para treinar?</div>
            <h2 style={{ fontSize: 20, marginTop: 6 }}>{routines.length ? 'Escolha uma rotina' : 'Monte sua primeira rotina'}</h2>
            <p className="muted small mt-1">{routines.length ? 'Organize sua semana em Treinos → Semana para ver o próximo treino aqui.' : 'Crie do zero ou use uma divisão pronta (ABC, PPL, Upper/Lower...).'}</p>
            <div className="row mt-4 wrap">
              <button className="btn btn-primary btn-lg" onClick={() => setPick(true)}><Play /> Iniciar treino</button>
              {!routines.length && <button className="btn btn-lg" onClick={() => nav('/treinos')}>Criar rotina</button>}
            </div>
          </>
        )}
      </section>

      {/* Week strip */}
      <section className="section card">
        <div className="card-title"><h3>Esta semana</h3><span className="muted xs">{data.week.sessions} treino{data.week.sessions === 1 ? '' : 's'}</span></div>
        <div className="week-strip">
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(wStart, i);
            const done = data.trainedDays.has(d);
            const planned = !!schedule.find((x) => x.id === new Date(d).getDay())?.routineId;
            return (
              <div className="week-day" key={i}>
                <span>{WEEKDAYS_SHORT[new Date(d).getDay()]}</span>
                <span className={`week-dot${done ? ' done' : planned && d >= today ? ' planned' : ''}${d === today ? ' today' : ''}`} title={done ? 'Treinou' : planned ? 'Treino planejado' : 'Descanso'}>
                  {done ? <Check aria-label="Treinou" /> : planned ? <Dumbbell aria-label="Planejado" /> : <Moon aria-label="Descanso" />}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section grid grid-4">
        <Stat icon={CalendarDays} label="Treinos na semana" value={data.week.sessions} hint={<>vs. {data.lastWeek.sessions} na anterior</>} />
        <Stat icon={Clock} label="Tempo na semana" value={fmtDuration(data.week.durationSec)} hint={data.week.sessions ? `média ${fmtDuration(data.week.avgDurationSec)}` : 'sem treinos ainda'} />
        <Stat icon={Weight} label="Volume na semana" value={fmtVolume(data.week.volume)} hint={data.week.sessions ? <Delta value={pctChange(data.week.volume, data.lastWeek.volume)} /> : `anterior: ${fmtVolume(data.lastWeek.volume)}`} />
        <Stat icon={Flame} label="Sequência" value={data.streak} unit={data.streak === 1 ? ' dia' : ' dias'} hint="descansos planejados não quebram" />
      </section>

      {data.total === 0 ? (
        <section className="section card">
          <Empty icon={TrendingUp} title="Seus números aparecem aqui" text="Ao finalizar o primeiro treino, o Setly calcula volume, frequência, recordes e evolução automaticamente — tudo com base nos seus registros." />
        </section>
      ) : (
        <div className="section grid md-grid-2">
          <section className="card">
            <div className="card-title"><h3>Frequência semanal</h3><span className="muted xs">últimas 8 semanas</span></div>
            <BarChart ariaLabel="Treinos por semana" highlightLast data={data.weeks.map((w) => ({ x: w.start, y: w.count, label: fmtDateShort(w.start) }))} format={(v) => `${Math.round(v)}`} />
          </section>

          <section className="stack">
            {data.last && (
              <Link to={`/historico/${data.last.id}`} className="card card-link">
                <div className="card-title"><h3>Último treino</h3><span className="muted xs">{fmtRelativeDay(data.last.startedAt)}</span></div>
                <div className="row-between">
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{data.last.name}</div>
                    <div className="muted xs mt-1">{fmtDuration(data.last.durationSec)} · {data.last.setsDone} séries · {fmtVolume(data.last.volume)}</div>
                  </div>
                  <ChevronRight className="dim" width={18} />
                </div>
              </Link>
            )}
            <div className="card">
              <div className="card-title"><h3>Evolução recente</h3><Link to="/recordes" className="xs accent">Recordes</Link></div>
              {data.recentPRs.length ? (
                <div className="list">
                  {data.recentPRs.map((p, i) => (
                    <Link to={`/progresso/${p.exerciseId}`} className="list-row clickable" key={i}>
                      <Trophy width={16} style={{ color: '#fcd34d', flexShrink: 0 }} />
                      <div className="grow">
                        <div className="list-title truncate">{exMap.get(p.exerciseId)?.namePt ?? 'Exercício'}</div>
                        <div className="list-sub">{RECORD_LABEL[p.type]} · {fmtRelativeDay(p.date)}</div>
                      </div>
                      <span className="small mono-num">{p.type === 'maxReps' ? `${p.value} reps` : fmtKg(p.value)}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted small">Nenhum recorde ainda. Recordes são detectados a partir do segundo treino de cada exercício.</p>
              )}
            </div>
          </section>
        </div>
      )}

      <StartWorkoutSheet open={pick} onClose={() => setPick(false)} />
    </div>
  );
}
