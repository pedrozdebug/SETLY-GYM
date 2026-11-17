import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useExercises } from '../hooks/data';
import { MUSCLE_GROUPS, MUSCLE_LABEL, EQUIPMENT_LABEL } from '../data/labels';
import type { MuscleGroup } from '../db/types';
import { Sheet } from './ui/ui';

export function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function ExercisePicker({ open, onClose, onPick, multi = true, title = 'Adicionar exercícios' }: {
  open: boolean; onClose: () => void; onPick: (ids: string[]) => void; multi?: boolean; title?: string;
}) {
  const { list } = useExercises();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all');
  const [sel, setSel] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return list
      .filter((e) => (group === 'all' || e.primary === group) && (!nq || normalize(e.namePt).includes(nq) || normalize(e.nameEn).includes(nq)))
      .sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));
  }, [list, q, group]);

  const close = () => { setSel([]); setQ(''); onClose(); };
  const confirm = (ids: string[]) => { onPick(ids); close(); };

  return (
    <Sheet open={open} onClose={close} title={title}
      footer={multi ? <button className="btn btn-primary btn-block" disabled={!sel.length} onClick={() => confirm(sel)}>Adicionar {sel.length ? `(${sel.length})` : ''}</button> : undefined}>
      <div className="search"><Search aria-hidden /><input className="input" placeholder="Buscar exercício" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar exercício" /></div>
      <div className="chips mt-3" style={{ margin: '12px 0 0', padding: 0 }}>
        <button className={`chip${group === 'all' ? ' active' : ''}`} onClick={() => setGroup('all')}>Todos</button>
        {MUSCLE_GROUPS.map((m) => <button key={m.id} className={`chip${group === m.id ? ' active' : ''}`} onClick={() => setGroup(m.id)}>{m.label}</button>)}
      </div>
      <div className="list mt-2">
        {filtered.map((e) => {
          const on = sel.includes(e.id);
          return (
            <button key={e.id} className="list-row clickable" aria-pressed={on}
              style={{ background: 'none', border: 0, borderBottom: '1px solid var(--border)', width: '100%', textAlign: 'left', cursor: 'pointer' }}
              onClick={() => (multi ? setSel((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id])) : confirm([e.id]))}>
              <div className="grow">
                <div className="list-title">{e.namePt}</div>
                <div className="list-sub">{MUSCLE_LABEL[e.primary]} · {EQUIPMENT_LABEL[e.equipment]}</div>
              </div>
              {multi && <span className={`set-check${on ? ' on' : ''}`} style={{ width: 28, height: 28, animation: 'none' }}>{on && <Check />}</span>}
            </button>
          );
        })}
        {!filtered.length && <p className="muted small center mt-4">Nenhum exercício encontrado.</p>}
      </div>
    </Sheet>
  );
}
