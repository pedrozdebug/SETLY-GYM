import { useNavigate } from 'react-router-dom';
import { ChevronRight, Dumbbell, Plus, Zap } from 'lucide-react';
import { getActiveSession, startSession } from '../db/repo';
import { useRoutines } from '../hooks/data';
import { Sheet, useToast } from './ui/ui';
import { unlockAudio, requestWakeLock } from '../lib/feedback';

export function useStartWorkout() {
  const nav = useNavigate();
  const toast = useToast();
  return async (routineId: string | null) => {
    try {
      unlockAudio();
      const active = await getActiveSession();
      if (active) {
        if (active.routineId !== routineId) toast('Você já tem um treino em andamento.', 'info');
        nav('/treino');
        return;
      }
      await startSession(routineId);
      void requestWakeLock();
      nav('/treino');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
}

export function StartWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const routines = useRoutines() ?? [];
  const start = useStartWorkout();
  const nav = useNavigate();
  return (
    <Sheet open={open} onClose={onClose} title="Iniciar treino">
      <div className="list">
        {routines.map((r) => (
          <button key={r.id} className="list-row clickable" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--border)', textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={() => { onClose(); void start(r.id); }}>
            <span className="ex-icon"><Dumbbell aria-hidden /></span>
            <span className="grow">
              <span className="list-title" style={{ display: 'block' }}>{r.name}</span>
              <span className="list-sub">{r.exercises.length} exercícios · {r.exercises.reduce((a, x) => a + x.sets, 0)} séries</span>
            </span>
            <ChevronRight className="dim" width={18} />
          </button>
        ))}
        <button className="list-row clickable" style={{ background: 'none', border: 0, textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={() => { onClose(); void start(null); }}>
          <span className="ex-icon"><Zap aria-hidden /></span>
          <span className="grow">
            <span className="list-title" style={{ display: 'block' }}>Treino livre</span>
            <span className="list-sub">Comece vazio e adicione exercícios durante o treino</span>
          </span>
          <ChevronRight className="dim" width={18} />
        </button>
      </div>
      {!routines.length && (
        <button className="btn btn-block mt-3" onClick={() => { onClose(); nav('/treinos/nova'); }}><Plus /> Criar minha primeira rotina</button>
      )}
    </Sheet>
  );
}
