// Ready-made training splits. Applying one creates editable routines (the
// user's own data) and optionally fills the weekly schedule.

export interface TemplateExercise { id: string; sets: number; repMin: number; repMax: number; rest: number }
export interface TemplateRoutine { name: string; exercises: TemplateExercise[] }
export interface SplitTemplate {
  id: string;
  name: string;
  description: string;
  routines: TemplateRoutine[];
  /** weekday (0=dom) → routine index or null for rest */
  schedule: (number | null)[];
}

const e = (id: string, sets: number, repMin: number, repMax: number, rest = 90): TemplateExercise => ({ id, sets, repMin, repMax, rest });

const PUSH = [e('supino-reto-barra', 4, 6, 10, 150), e('supino-inclinado-halteres', 3, 8, 12, 120), e('desenvolvimento-halteres', 3, 8, 12, 120), e('elevacao-lateral', 4, 12, 15, 60), e('crossover-polia', 3, 12, 15, 60), e('triceps-corda', 3, 10, 15, 60), e('triceps-frances', 3, 10, 12, 60)];
const PULL = [e('barra-fixa', 4, 6, 10, 150), e('remada-curvada-barra', 4, 8, 10, 120), e('puxada-triangulo', 3, 10, 12, 90), e('remada-baixa', 3, 10, 12, 90), e('face-pull', 3, 12, 15, 60), e('rosca-direta-barra', 3, 8, 12, 60), e('rosca-martelo', 3, 10, 12, 60)];
const LEGS = [e('agachamento-livre', 4, 6, 10, 180), e('levantamento-terra-romeno', 3, 8, 10, 150), e('leg-press', 3, 10, 12, 120), e('cadeira-extensora', 3, 12, 15, 60), e('mesa-flexora', 3, 10, 12, 60), e('panturrilha-em-pe', 4, 10, 15, 60)];
const UPPER = [e('supino-reto-barra', 4, 6, 10, 150), e('remada-curvada-barra', 4, 6, 10, 150), e('desenvolvimento-halteres', 3, 8, 12, 120), e('puxada-frente', 3, 8, 12, 90), e('elevacao-lateral', 3, 12, 15, 60), e('rosca-alternada', 3, 10, 12, 60), e('triceps-polia-barra', 3, 10, 12, 60)];
const LOWER = [e('agachamento-livre', 4, 6, 10, 180), e('stiff', 3, 8, 10, 150), e('agachamento-bulgaro', 3, 8, 12, 90), e('cadeira-flexora', 3, 10, 12, 60), e('elevacao-pelvica', 3, 8, 12, 90), e('panturrilha-em-pe', 4, 10, 15, 60), e('abdominal-polia', 3, 10, 15, 60)];
const FULL_A = [e('agachamento-livre', 3, 6, 10, 150), e('supino-reto-barra', 3, 6, 10, 150), e('remada-curvada-barra', 3, 8, 10, 120), e('desenvolvimento-halteres', 2, 8, 12, 90), e('rosca-direta-barra', 2, 10, 12, 60), e('prancha', 3, 30, 60, 60)];
const FULL_B = [e('levantamento-terra', 3, 5, 8, 180), e('supino-inclinado-halteres', 3, 8, 12, 120), e('puxada-frente', 3, 8, 12, 90), e('leg-press', 3, 10, 12, 120), e('elevacao-lateral', 3, 12, 15, 60), e('triceps-corda', 2, 10, 15, 60)];

export const SPLIT_TEMPLATES: SplitTemplate[] = [
  {
    id: 'abc', name: 'ABC', description: 'Peito/tríceps, costas/bíceps, pernas/ombros. 3 a 6 dias.',
    routines: [
      { name: 'Treino A — Peito e Tríceps', exercises: [e('supino-reto-barra', 4, 6, 10, 150), e('supino-inclinado-halteres', 3, 8, 12, 120), e('crucifixo-maquina', 3, 10, 15, 60), e('crossover-polia', 3, 12, 15, 60), e('triceps-testa', 3, 8, 12, 90), e('triceps-corda', 3, 10, 15, 60)] },
      { name: 'Treino B — Costas e Bíceps', exercises: [e('puxada-frente', 4, 8, 12, 120), e('remada-curvada-barra', 4, 8, 10, 120), e('remada-unilateral-halter', 3, 8, 12, 90), e('pulldown-bracos-estendidos', 3, 12, 15, 60), e('rosca-direta-barra', 3, 8, 12, 60), e('rosca-martelo', 3, 10, 12, 60)] },
      { name: 'Treino C — Pernas e Ombros', exercises: [e('agachamento-livre', 4, 6, 10, 180), e('leg-press', 3, 10, 12, 120), e('mesa-flexora', 3, 10, 12, 60), e('cadeira-extensora', 3, 12, 15, 60), e('desenvolvimento-halteres', 3, 8, 12, 90), e('elevacao-lateral', 4, 12, 15, 60), e('panturrilha-em-pe', 4, 10, 15, 60)] },
    ],
    schedule: [null, 0, 1, 2, null, 0, 1],
  },
  {
    id: 'abcd', name: 'ABCD', description: 'Peito, costas, pernas, ombros e braços. 4 dias.',
    routines: [
      { name: 'Treino A — Peito', exercises: [e('supino-reto-barra', 4, 6, 10, 150), e('supino-inclinado-halteres', 3, 8, 12, 120), e('supino-maquina', 3, 10, 12, 90), e('crucifixo-halteres', 3, 10, 15, 60), e('crossover-polia', 3, 12, 15, 60)] },
      { name: 'Treino B — Costas', exercises: [e('barra-fixa', 4, 6, 10, 150), e('remada-curvada-barra', 4, 8, 10, 120), e('puxada-triangulo', 3, 10, 12, 90), e('remada-maquina', 3, 10, 12, 90), e('pulldown-bracos-estendidos', 3, 12, 15, 60)] },
      { name: 'Treino C — Pernas', exercises: LEGS },
      { name: 'Treino D — Ombros e Braços', exercises: [e('desenvolvimento-barra', 4, 6, 10, 150), e('elevacao-lateral', 4, 12, 15, 60), e('crucifixo-invertido', 3, 12, 15, 60), e('rosca-direta-barra', 3, 8, 12, 60), e('triceps-testa', 3, 8, 12, 60), e('rosca-martelo', 3, 10, 12, 60), e('triceps-corda', 3, 10, 15, 60)] },
    ],
    schedule: [null, 0, 1, null, 2, 3, null],
  },
  {
    id: 'abcde', name: 'ABCDE', description: 'Um grupo principal por dia. 5 dias.',
    routines: [
      { name: 'Treino A — Peito', exercises: [e('supino-reto-barra', 4, 6, 10, 150), e('supino-inclinado-barra', 3, 8, 10, 120), e('supino-reto-halteres', 3, 8, 12, 90), e('crucifixo-maquina', 3, 12, 15, 60), e('mergulho-paralelas', 3, 8, 12, 90)] },
      { name: 'Treino B — Costas', exercises: [e('levantamento-terra', 3, 5, 8, 180), e('barra-fixa', 4, 6, 10, 120), e('remada-cavalinho', 3, 8, 10, 120), e('remada-baixa', 3, 10, 12, 90), e('pullover-halter', 3, 10, 12, 60)] },
      { name: 'Treino C — Pernas', exercises: [e('agachamento-livre', 4, 6, 10, 180), e('hack-squat', 3, 8, 12, 120), e('stiff', 3, 8, 10, 120), e('cadeira-extensora', 3, 12, 15, 60), e('cadeira-flexora', 3, 10, 12, 60), e('panturrilha-sentado', 4, 12, 15, 60)] },
      { name: 'Treino D — Ombros', exercises: [e('desenvolvimento-barra', 4, 6, 10, 150), e('arnold-press', 3, 8, 12, 90), e('elevacao-lateral', 4, 12, 15, 60), e('crucifixo-invertido', 3, 12, 15, 60), e('encolhimento-halteres', 3, 10, 12, 60)] },
      { name: 'Treino E — Braços', exercises: [e('rosca-direta-barra', 4, 8, 12, 60), e('supino-fechado', 3, 6, 10, 120), e('rosca-inclinada', 3, 10, 12, 60), e('triceps-overhead-polia', 3, 10, 12, 60), e('rosca-martelo', 3, 10, 12, 60), e('triceps-corda', 3, 12, 15, 60)] },
    ],
    schedule: [null, 0, 1, 2, 3, 4, null],
  },
  {
    id: 'ppl', name: 'Push / Pull / Legs', description: 'Empurrar, puxar e pernas. 3 ou 6 dias.',
    routines: [{ name: 'Push', exercises: PUSH }, { name: 'Pull', exercises: PULL }, { name: 'Legs', exercises: LEGS }],
    schedule: [null, 0, 1, 2, 0, 1, 2],
  },
  {
    id: 'upper-lower', name: 'Upper / Lower', description: 'Superiores e inferiores alternados. 4 dias.',
    routines: [{ name: 'Upper', exercises: UPPER }, { name: 'Lower', exercises: LOWER }],
    schedule: [null, 0, 1, null, 0, 1, null],
  },
  {
    id: 'full-body', name: 'Full Body', description: 'Corpo inteiro em cada sessão. 2 a 3 dias.',
    routines: [{ name: 'Full Body A', exercises: FULL_A }, { name: 'Full Body B', exercises: FULL_B }],
    schedule: [null, 0, null, 1, null, 0, null],
  },
];
