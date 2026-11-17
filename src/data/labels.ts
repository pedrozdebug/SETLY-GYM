import type { Equipment, ExerciseType, Goal, Level, MuscleGroup, RecordType } from '../db/types';

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'peito', label: 'Peito' },
  { id: 'costas', label: 'Costas' },
  { id: 'ombros', label: 'Ombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'quadriceps', label: 'Quadríceps' },
  { id: 'posterior', label: 'Posterior de coxa' },
  { id: 'gluteos', label: 'Glúteos' },
  { id: 'panturrilhas', label: 'Panturrilhas' },
  { id: 'abdomen', label: 'Abdômen' },
  { id: 'antebracos', label: 'Antebraços' },
];

export const MUSCLE_LABEL: Record<MuscleGroup, string> = Object.fromEntries(
  MUSCLE_GROUPS.map((m) => [m.id, m.label]),
) as Record<MuscleGroup, string>;

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barra: 'Barra',
  halteres: 'Halteres',
  maquina: 'Máquina',
  polia: 'Polia / Cabo',
  'peso-corporal': 'Peso corporal',
  kettlebell: 'Kettlebell',
  smith: 'Smith',
  elastico: 'Elástico',
  'barra-ez': 'Barra W / EZ',
  anilha: 'Anilha',
};

export const TYPE_LABEL: Record<ExerciseType, string> = {
  composto: 'Composto',
  isolado: 'Isolado',
};

export const GOAL_LABEL: Record<Goal, string> = {
  hipertrofia: 'Hipertrofia',
  forca: 'Força',
  resistencia: 'Resistência muscular',
  condicionamento: 'Condicionamento físico',
  manutencao: 'Manutenção',
};

export const LEVEL_LABEL: Record<Level, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const RECORD_LABEL: Record<RecordType, string> = {
  maxWeight: 'Maior carga',
  maxReps: 'Mais repetições',
  maxSetVolume: 'Maior volume em uma série',
  maxExerciseVolume: 'Maior volume no exercício',
};

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
/** Display order starting on Monday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
