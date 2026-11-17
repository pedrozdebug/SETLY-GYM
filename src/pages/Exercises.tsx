import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Dumbbell, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useExercises } from '../hooks/data';
import { EQUIPMENT_LABEL, MUSCLE_GROUPS, MUSCLE_LABEL, TYPE_LABEL } from '../data/labels';
import type { Equipment, ExerciseType, MuscleGroup } from '../db/types';
import { Empty, Field, PageHeader, Sheet } from '../components/ui/ui';
import { normalize } from '../components/ExercisePicker';

export default function Exercises() {
  const { list, loading } = useExercises();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const [filters, setFilters] = useState(false);
  const q = params.get('q') ?? '';
  const group = (params.get('grupo') as MuscleGroup | null) ?? null;
  const equipment = (params.get('equip') as Equipment | null) ?? null;
  const type = (params.get('tipo') as ExerciseType | null) ?? null;

  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const filtered = useMemo(() => {
    const nq = normalize(q.trim());
    return list
      .filter((e) => (!group || e.primary === group) && (!equipment || e.equipment === equipment) && (!type || e.type === type))
      .filter((e) => !nq || normalize(e.namePt).includes(nq) || normalize(e.nameEn).includes(nq))
      .sort((a, b) => a.namePt.localeCompare(b.namePt, 'pt-BR'));
  }, [list, q, group, equipment, type]);

  const grouped = useMemo(() => {
    const m = new Map<MuscleGroup, typeof filtered>();
    for (const g of MUSCLE_GROUPS) m.set(g.id, []);
    for (const e of filtered) m.get(e.primary)!.push(e);
    return [...m.entries()].filter(([, v]) => v.length);
  }, [filtered]);

  const activeFilters = (equipment ? 1 : 0) + (type ? 1 : 0);

  return (
    <div className="page">
      <PageHeader title="Exercícios" sub={`${list.length} exercícios na biblioteca`} actions={<button className="btn btn-sm" onClick={() => nav('/exercicios/novo')}><Plus /> Criar</button>} />
      <div className="row">
        <div className="search grow"><Search aria-hidden /><input className="input" type="search" placeholder="Buscar por nome (PT ou EN)" value={q} onChange={(e) => set('q', e.target.value || null)} aria-label="Buscar exercícios" /></div>
        <button className="icon-btn bordered" style={{ height: 44, width: 44, position: 'relative' }} onClick={() => setFilters(true)} aria-label="Filtros">
          <SlidersHorizontal />
          {activeFilters > 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, background: 'var(--accent)' }} />}
        </button>
      </div>
      <div className="chips mt-3">
        <button className={`chip${!group ? ' active' : ''}`} onClick={() => set('grupo', null)}>Todos</button>
        {MUSCLE_GROUPS.map((m) => <button key={m.id} className={`chip${group === m.id ? ' active' : ''}`} onClick={() => set('grupo', group === m.id ? null : m.id)}>{m.label}</button>)}
      </div>
      {(equipment || type) && (
        <div className="row wrap mt-2" style={{ gap: 6 }}>
          {equipment && <button className="tag accent" onClick={() => set('equip', null)}>{EQUIPMENT_LABEL[equipment]} ✕</button>}
          {type && <button className="tag accent" onClick={() => set('tipo', null)}>{TYPE_LABEL[type]} ✕</button>}
        </div>
      )}

      {!loading && !filtered.length && <div className="card mt-4"><Empty icon={Dumbbell} title="Nenhum exercício encontrado" text="Ajuste a busca ou os filtros, ou crie um exercício personalizado." /></div>}

      {grouped.map(([g, items]) => (
        <section key={g} className="section">
          <div className="section-title">{MUSCLE_LABEL[g]} <span>{items.length}</span></div>
          <div className="card" style={{ padding: '0 16px' }}>
            <div className="list">
              {items.map((e) => (
                <Link to={`/exercicios/${e.id}`} key={e.id} className="list-row clickable">
                  <span className="ex-icon"><Dumbbell aria-hidden /></span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="list-title truncate">{e.namePt}</div>
                    <div className="list-sub truncate">{e.nameEn} · {EQUIPMENT_LABEL[e.equipment]} · {TYPE_LABEL[e.type]}{e.custom ? ' · Personalizado' : ''}</div>
                  </div>
                  <ChevronRight className="dim" width={16} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filtros"
        footer={<><button className="btn grow" onClick={() => { const p = new URLSearchParams(params); p.delete('equip'); p.delete('tipo'); setParams(p, { replace: true }); }}>Limpar</button><button className="btn btn-primary grow" onClick={() => setFilters(false)}>Ver {filtered.length}</button></>}>
        <div className="stack">
          <Field label="Grupo muscular">
            <select className="select" value={group ?? ''} onChange={(e) => set('grupo', e.target.value || null)}>
              <option value="">Todos</option>
              {MUSCLE_GROUPS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <div className="field">
            <span className="label">Equipamento</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => <button key={k} className={`chip${equipment === k ? ' active' : ''}`} onClick={() => set('equip', equipment === k ? null : k)}>{EQUIPMENT_LABEL[k]}</button>)}
            </div>
          </div>
          <div className="field">
            <span className="label">Tipo de exercício</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {(Object.keys(TYPE_LABEL) as ExerciseType[]).map((k) => <button key={k} className={`chip${type === k ? ' active' : ''}`} onClick={() => set('tipo', type === k ? null : k)}>{TYPE_LABEL[k]}</button>)}
            </div>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
