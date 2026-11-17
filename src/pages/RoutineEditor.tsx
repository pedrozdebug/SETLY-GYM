import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowDown, ArrowUp, Plus, Save, Trash2, Dumbbell } from 'lucide-react';
import { db } from '../db/db';
import { getPrefs, newRoutineExercise, saveRoutine, deleteRoutine } from '../db/repo';
import type { Routine, RoutineExercise } from '../db/types';
import { useExercises } from '../hooks/data';
import { uid } from '../lib/id';
import { MUSCLE_LABEL } from '../data/labels';
import { Empty, Field, NumInput, useConfirm, useToast } from '../components/ui/ui';
import { ExercisePicker } from '../components/ExercisePicker';

type Draft = Pick<Routine, 'id' | 'name' | 'notes' | 'exercises'>;

export function validateRoutineExercise(x: RoutineExercise): string | null {
  if (!Number.isInteger(x.sets) || x.sets < 1 || x.sets > 20) return 'Séries devem estar entre 1 e 20.';
  if (x.repMin < 1 || x.repMax < 1) return 'Repetições devem ser maiores que zero.';
  if (x.repMin > x.repMax) return 'Repetição mínima não pode ser maior que a máxima.';
  if (x.weight < 0 || x.weight > 1000) return 'Carga inválida.';
  if (x.restSec < 0 || x.restSec > 900) return 'Descanso deve estar entre 0 e 900 segundos.';
  return null;
}

export default function RoutineEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'nova';
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { map } = useExercises();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [picker, setPicker] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      if (isNew) setDraft({ id: uid(), name: '', notes: '', exercises: [] });
      else {
        const r = await db.routines.get(id!);
        if (!r) { toast('Rotina não encontrada', 'error'); nav('/treinos'); return; }
        setDraft({ id: r.id, name: r.name, notes: r.notes, exercises: r.exercises });
      }
    })();
  }, [id, isNew, nav, toast]);

  if (!draft) return <div className="page" />;

  const update = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const updateEx = (i: number, patch: Partial<RoutineExercise>) => update({ exercises: draft.exercises.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  const move = (i: number, d: -1 | 1) => {
    const arr = [...draft.exercises];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    update({ exercises: arr });
  };

  const nameError = !draft.name.trim() ? 'Dê um nome ao treino.' : draft.name.length > 60 ? 'Máximo de 60 caracteres.' : null;
  const exErrors = draft.exercises.map(validateRoutineExercise);
  const valid = !nameError && exErrors.every((e) => !e);

  const save = async () => {
    setSubmitted(true);
    if (!valid) { toast('Corrija os campos destacados', 'error'); return; }
    await saveRoutine({ ...draft, name: draft.name.trim() });
    setDirty(false);
    toast(isNew ? 'Rotina criada' : 'Rotina salva');
    nav('/treinos', { replace: true });
  };

  const goBack = async () => {
    if (dirty && !(await confirm({ title: 'Descartar alterações?', message: 'As alterações não salvas serão perdidas.', confirmLabel: 'Descartar', danger: true }))) return;
    nav('/treinos');
  };

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <button className="icon-btn bordered" aria-label="Voltar" onClick={goBack}><ArrowLeft /></button>
        <div className="grow"><h1>{isNew ? 'Nova rotina' : 'Editar rotina'}</h1></div>
        <button className="btn btn-primary btn-sm" onClick={save}><Save /> Salvar</button>
      </header>

      <div className="card stack">
        <Field label="Nome do treino" error={submitted ? nameError : null}>
          <input className={`input${submitted && nameError ? ' invalid' : ''}`} value={draft.name} maxLength={60} placeholder="Ex.: Push A, Pull, Legs, Upper" onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <Field label="Observações (opcional)">
          <textarea className="textarea" value={draft.notes} maxLength={500} placeholder="Foco, técnicas, aquecimento..." onChange={(e) => update({ notes: e.target.value })} />
        </Field>
      </div>

      <div className="section-title section">Exercícios <span>{draft.exercises.length}</span></div>
      {!draft.exercises.length && <div className="card"><Empty icon={Dumbbell} title="Sem exercícios" text="Adicione exercícios da biblioteca para montar este treino." /></div>}
      <div className="stack">
        {draft.exercises.map((x, i) => {
          const e = map.get(x.exerciseId);
          const err = submitted ? exErrors[i] : null;
          return (
            <article className="card" key={x.uid} style={err ? { borderColor: 'var(--danger)' } : undefined}>
              <div className="row">
                <span className="tag accent mono-num">{String(i + 1).padStart(2, '0')}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 600 }}>{e?.namePt ?? 'Exercício removido'}</div>
                  <div className="xs dim">{e ? MUSCLE_LABEL[e.primary] : ''}</div>
                </div>
                <button className="icon-btn sm" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
                <button className="icon-btn sm" aria-label="Mover para baixo" disabled={i === draft.exercises.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
                <button className="icon-btn sm" aria-label="Remover exercício" onClick={() => update({ exercises: draft.exercises.filter((_, k) => k !== i) })}><Trash2 /></button>
              </div>
              <div className="grid mt-3" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
                <Field label="Séries"><NumInput value={x.sets} min={0} max={20} onChange={(v) => updateEx(i, { sets: v ?? 0 })} aria-label="Séries" /></Field>
                <Field label="Reps mín."><NumInput value={x.repMin} min={0} max={100} onChange={(v) => updateEx(i, { repMin: v ?? 0 })} aria-label="Repetições mínimas" /></Field>
                <Field label="Reps máx."><NumInput value={x.repMax} min={0} max={100} onChange={(v) => updateEx(i, { repMax: v ?? 0 })} aria-label="Repetições máximas" /></Field>
                <Field label="Carga (kg)"><NumInput decimal value={x.weight} min={0} max={1000} onChange={(v) => updateEx(i, { weight: v ?? 0 })} aria-label="Carga inicial" /></Field>
                <Field label="Descanso (s)"><NumInput value={x.restSec} min={0} max={900} onChange={(v) => updateEx(i, { restSec: v ?? 0 })} aria-label="Descanso em segundos" /></Field>
                <Field label="Tempo"><div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-2)' }}>{Math.floor(x.restSec / 60)}:{String(x.restSec % 60).padStart(2, '0')}</div></Field>
              </div>
              <div className="mt-3">
                <input className="input" value={x.notes} maxLength={200} placeholder="Observação (ex.: drop-set na última série)" onChange={(ev) => updateEx(i, { notes: ev.target.value })} aria-label="Observação do exercício" />
              </div>
              {err && <div className="field-error mt-2">{err}</div>}
            </article>
          );
        })}
      </div>
      <button className="btn btn-block btn-lg mt-4" onClick={() => setPicker(true)}><Plus /> Adicionar exercícios</button>

      {!isNew && (
        <button className="btn btn-danger btn-block mt-6" onClick={async () => {
          if (await confirm({ title: 'Excluir rotina?', message: 'Ela também será removida da programação semanal.', confirmLabel: 'Excluir', danger: true })) {
            await deleteRoutine(draft.id); toast('Rotina excluída'); nav('/treinos', { replace: true });
          }
        }}><Trash2 /> Excluir rotina</button>
      )}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={async (ids) => {
        const prefs = await getPrefs();
        update({ exercises: [...draft.exercises, ...ids.map((eid) => newRoutineExercise(eid, prefs.defaultRestSec))] });
      }} />
    </div>
  );
}
