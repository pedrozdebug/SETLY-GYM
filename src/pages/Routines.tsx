import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Dumbbell, LayoutTemplate, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useExercises, useRoutines, useSchedule } from '../hooks/data';
import { applyTemplate, deleteRoutine, duplicateRoutine, setScheduleDay } from '../db/repo';
import { MUSCLE_LABEL, WEEKDAYS, WEEK_ORDER } from '../data/labels';
import { SPLIT_TEMPLATES } from '../data/templates';
import { Empty, PageHeader, Segmented, Sheet, Switch, useConfirm, useToast } from '../components/ui/ui';
import { useStartWorkout } from '../components/StartWorkout';
import type { MuscleGroup, Routine } from '../db/types';

function estimateMinutes(r: Routine) {
  // ~40s per set of work + configured rest
  const sec = r.exercises.reduce((a, x) => a + x.sets * (40 + x.restSec), 0);
  return Math.round(sec / 60);
}

function RoutineCard({ r }: { r: Routine }) {
  const { map } = useExercises();
  const nav = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const start = useStartWorkout();
  const groups = [...new Set(r.exercises.map((x) => map.get(x.exerciseId)?.primary).filter(Boolean))] as MuscleGroup[];
  const sets = r.exercises.reduce((a, x) => a + x.sets, 0);
  return (
    <article className="card">
      <div className="row-between">
        <Link to={`/treinos/${r.id}`} className="grow" style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 15 }} className="truncate">{r.name}</h3>
          <div className="muted xs mt-1">{r.exercises.length} exercícios · {sets} séries · ~{estimateMinutes(r)} min</div>
        </Link>
        <button className="btn btn-primary btn-sm" onClick={() => start(r.id)} disabled={!r.exercises.length} aria-label={`Iniciar ${r.name}`}><Play /> Iniciar</button>
      </div>
      {groups.length > 0 && <div className="row wrap mt-3" style={{ gap: 6 }}>{groups.slice(0, 5).map((g) => <span key={g} className="tag">{MUSCLE_LABEL[g]}</span>)}</div>}
      {r.exercises.length > 0 && (
        <p className="muted xs mt-3" style={{ lineHeight: 1.7 }}>
          {r.exercises.slice(0, 4).map((x) => map.get(x.exerciseId)?.namePt ?? 'Exercício removido').join(' · ')}{r.exercises.length > 4 ? ` · +${r.exercises.length - 4}` : ''}
        </p>
      )}
      <hr className="divider" />
      <div className="row" style={{ gap: 4 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav(`/treinos/${r.id}`)}><Pencil /> Editar</button>
        <button className="btn btn-ghost btn-sm" onClick={async () => { const id = await duplicateRoutine(r.id); toast('Rotina duplicada'); if (id) nav(`/treinos/${id}`); }}><Copy /> Duplicar</button>
        <span className="grow" />
        <button className="icon-btn sm" aria-label={`Excluir ${r.name}`} onClick={async () => {
          if (await confirm({ title: 'Excluir rotina?', message: `"${r.name}" será removida e retirada da programação semanal. O histórico de treinos já realizados é mantido.`, confirmLabel: 'Excluir', danger: true })) {
            await deleteRoutine(r.id); toast('Rotina excluída');
          }
        }}><Trash2 /></button>
      </div>
    </article>
  );
}

function TemplatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [sel, setSel] = useState<string | null>(null);
  const [withSchedule, setWithSchedule] = useState(true);
  const toast = useToast();
  const t = SPLIT_TEMPLATES.find((x) => x.id === sel);
  return (
    <Sheet open={open} onClose={onClose} title="Divisões prontas"
      footer={<button className="btn btn-primary btn-block" disabled={!t} onClick={async () => {
        await applyTemplate(sel!, withSchedule);
        toast(`${t!.routines.length} rotinas criadas — ajuste as cargas como preferir`);
        onClose(); setSel(null);
      }}>Criar rotinas</button>}>
      <p className="muted small" style={{ marginBottom: 12 }}>As rotinas são criadas como ponto de partida editável. Você pode alterar exercícios, séries e repetições depois.</p>
      <div className="stack-sm">
        {SPLIT_TEMPLATES.map((tp) => (
          <button key={tp.id} className="card card-link" style={{ textAlign: 'left', borderColor: sel === tp.id ? 'var(--accent)' : undefined }} onClick={() => setSel(tp.id)} aria-pressed={sel === tp.id}>
            <div className="row-between"><b>{tp.name}</b><span className="tag">{tp.schedule.filter((x) => x != null).length}x / semana</span></div>
            <div className="muted xs mt-1">{tp.description}</div>
            {sel === tp.id && <div className="xs mt-2 accent">{tp.routines.map((r) => r.name).join(' · ')}</div>}
          </button>
        ))}
      </div>
      <label className="row-between mt-4">
        <span className="small">Aplicar também na programação semanal</span>
        <Switch checked={withSchedule} onChange={setWithSchedule} label="Aplicar programação semanal" />
      </label>
    </Sheet>
  );
}

function WeekPlanner() {
  const routines = useRoutines() ?? [];
  const schedule = useSchedule();
  const toast = useToast();
  const trainingDays = schedule.filter((d) => d.routineId).length;
  return (
    <div className="stack">
      <p className="muted small">Associe uma rotina a cada dia da semana. Dias sem rotina são considerados descanso e não quebram sua sequência.</p>
      <div className="card" style={{ padding: '4px 16px' }}>
        <div className="list">
          {WEEK_ORDER.map((d) => {
            const day = schedule.find((x) => x.id === d);
            return (
              <div className="list-row" key={d}>
                <span style={{ width: 80 }} className="small">{WEEKDAYS[d]}</span>
                <select className="select grow" aria-label={`Treino de ${WEEKDAYS[d]}`} value={day?.routineId ?? ''} onChange={async (e) => { await setScheduleDay(d, e.target.value || null); }}>
                  <option value="">Descanso</option>
                  {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>
      <div className="row-between">
        <span className="muted xs">{trainingDays} dia{trainingDays === 1 ? '' : 's'} de treino · {7 - trainingDays} de descanso</span>
        <button className="btn btn-ghost btn-sm" disabled={!trainingDays} onClick={async () => { for (let d = 0; d < 7; d++) await setScheduleDay(d, null); toast('Programação limpa'); }}>Limpar semana</button>
      </div>
      {!routines.length && <p className="muted small">Crie rotinas primeiro para montar sua semana.</p>}
    </div>
  );
}

export default function Routines() {
  const routines = useRoutines();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'rotinas' | 'semana') ?? 'rotinas';
  const [tpl, setTpl] = useState(false);
  const nav = useNavigate();
  return (
    <div className="page page-narrow">
      <PageHeader title="Treinos" sub="Rotinas e programação semanal" actions={<button className="btn btn-primary btn-sm" onClick={() => nav('/treinos/nova')}><Plus /> Nova</button>} />
      <Segmented label="Seção" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={[{ value: 'rotinas', label: 'Rotinas' }, { value: 'semana', label: 'Semana' }]} />
      <div className="mt-4">
        {tab === 'semana' ? <WeekPlanner /> : (
          <div className="stack">
            <button className="card card-link row" style={{ textAlign: 'left', gap: 12 }} onClick={() => setTpl(true)}>
              <span className="ex-icon"><LayoutTemplate aria-hidden /></span>
              <span className="grow"><b className="small">Usar divisão pronta</b><span className="muted xs" style={{ display: 'block' }}>ABC, ABCD, ABCDE, Push/Pull/Legs, Upper/Lower, Full Body</span></span>
            </button>
            {routines === undefined ? null : routines.length === 0 ? (
              <div className="card"><Empty icon={Dumbbell} title="Nenhuma rotina ainda" text="Crie uma rotina personalizada ou comece com uma divisão pronta." action={<button className="btn btn-primary" onClick={() => nav('/treinos/nova')}><Plus /> Criar rotina</button>} /></div>
            ) : routines.map((r) => <RoutineCard key={r.id} r={r} />)}
          </div>
        )}
      </div>
      <TemplatesSheet open={tpl} onClose={() => setTpl(false)} />
    </div>
  );
}
