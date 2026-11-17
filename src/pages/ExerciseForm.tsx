import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { db } from '../db/db';
import { saveCustomExercise } from '../db/repo';
import type { Equipment, ExerciseType, MuscleGroup } from '../db/types';
import { EQUIPMENT_LABEL, MUSCLE_GROUPS, TYPE_LABEL } from '../data/labels';
import { Field, PageHeader, useToast } from '../components/ui/ui';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export default function ExerciseForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({
    namePt: '', nameEn: '', primary: 'peito' as MuscleGroup, secondary: [] as MuscleGroup[], equipment: 'halteres' as Equipment,
    type: 'isolado' as ExerciseType, instructions: '', tips: '', mistakes: '', notes: '',
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    db.exercises.get(id).then((e) => {
      if (!e || !e.custom) { nav('/exercicios', { replace: true }); return; }
      setF({ namePt: e.namePt, nameEn: e.nameEn, primary: e.primary, secondary: e.secondary, equipment: e.equipment, type: e.type, instructions: e.instructions.join('\n'), tips: e.tips.join('\n'), mistakes: e.mistakes.join('\n'), notes: e.notes });
    });
  }, [id, nav]);

  const nameErr = f.namePt.trim().length < 2 ? 'Informe o nome (mínimo 2 caracteres).' : null;

  const save = async () => {
    setSubmitted(true);
    if (nameErr) return;
    const newId = await saveCustomExercise({
      id, namePt: f.namePt.trim(), nameEn: f.nameEn.trim() || f.namePt.trim(), primary: f.primary,
      secondary: f.secondary.filter((m) => m !== f.primary), equipment: f.equipment, type: f.type,
      instructions: lines(f.instructions), tips: lines(f.tips), mistakes: lines(f.mistakes), notes: f.notes.trim(),
    });
    toast(id ? 'Exercício atualizado' : 'Exercício criado');
    nav(`/exercicios/${newId}`, { replace: true });
  };

  return (
    <div className="page page-narrow">
      <PageHeader title={id ? 'Editar exercício' : 'Novo exercício'} back actions={<button className="btn btn-primary btn-sm" onClick={save}><Save /> Salvar</button>} />
      <div className="card stack">
        <Field label="Nome em português" error={submitted ? nameErr : null}>
          <input className={`input${submitted && nameErr ? ' invalid' : ''}`} maxLength={60} value={f.namePt} onChange={(e) => setF({ ...f, namePt: e.target.value })} />
        </Field>
        <Field label="Nome em inglês (opcional)"><input className="input" maxLength={60} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></Field>
        <div className="grid grid-2">
          <Field label="Grupo principal">
            <select className="select" value={f.primary} onChange={(e) => setF({ ...f, primary: e.target.value as MuscleGroup })}>
              {MUSCLE_GROUPS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Equipamento">
            <select className="select" value={f.equipment} onChange={(e) => setF({ ...f, equipment: e.target.value as Equipment })}>
              {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => <option key={k} value={k}>{EQUIPMENT_LABEL[k]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Tipo">
          <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ExerciseType })}>
            {(Object.keys(TYPE_LABEL) as ExerciseType[]).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
          </select>
        </Field>
        <div className="field">
          <span className="label">Músculos secundários</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {MUSCLE_GROUPS.filter((m) => m.id !== f.primary).map((m) => {
              const on = f.secondary.includes(m.id);
              return <button key={m.id} className={`chip${on ? ' active' : ''}`} aria-pressed={on} onClick={() => setF({ ...f, secondary: on ? f.secondary.filter((x) => x !== m.id) : [...f.secondary, m.id] })}>{m.label}</button>;
            })}
          </div>
        </div>
        <Field label="Instruções de execução" hint="Um passo por linha"><textarea className="textarea" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} /></Field>
        <Field label="Dicas de técnica" hint="Uma dica por linha"><textarea className="textarea" value={f.tips} onChange={(e) => setF({ ...f, tips: e.target.value })} /></Field>
        <Field label="Erros comuns" hint="Um por linha"><textarea className="textarea" value={f.mistakes} onChange={(e) => setF({ ...f, mistakes: e.target.value })} /></Field>
        <Field label="Observações"><textarea className="textarea" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </div>
  );
}
