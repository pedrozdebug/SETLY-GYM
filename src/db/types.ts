// Domain model for Setly Gym. All persisted entities carry `updatedAt`
// so they can be merged by the optional sync layer (last-write-wins).

export type MuscleGroup =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'posterior'
  | 'gluteos'
  | 'panturrilhas'
  | 'abdomen'
  | 'antebracos';

export type Equipment =
  | 'barra'
  | 'halteres'
  | 'maquina'
  | 'polia'
  | 'peso-corporal'
  | 'kettlebell'
  | 'smith'
  | 'elastico'
  | 'barra-ez'
  | 'anilha';

export type ExerciseType = 'composto' | 'isolado';

export type Goal = 'hipertrofia' | 'forca' | 'resistencia' | 'condicionamento' | 'manutencao';
export type Level = 'iniciante' | 'intermediario' | 'avancado';

export interface Exercise {
  id: string;
  namePt: string;
  nameEn: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  instructions: string[];
  tips: string[];
  mistakes: string[];
  notes: string;
  /** Demonstration video linked by the user (YouTube, Vimeo or direct .mp4). */
  videoUrl?: string;
  custom?: boolean;
  updatedAt: number;
}

export interface RoutineExercise {
  uid: string;
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  weight: number; // carga inicial (kg)
  restSec: number;
  notes: string;
}

export interface Routine {
  id: string;
  name: string;
  notes: string;
  exercises: RoutineExercise[];
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** Weekly plan: one row per weekday (0 = domingo ... 6 = sábado). */
export interface ScheduleDay {
  id: number;
  routineId: string | null;
  updatedAt: number;
}

export interface SetLog {
  uid: string;
  weight: number | null;
  reps: number | null;
  targetWeight: number | null;
  done: boolean;
  completedAt: number | null;
  notes: string;
}

export interface SessionExercise {
  uid: string;
  exerciseId: string;
  repMin: number;
  repMax: number;
  restSec: number;
  notes: string;
  sets: SetLog[];
}

export interface PRHit {
  exerciseId: string;
  type: RecordType;
  value: number;
  previous: number | null;
  weight: number;
  reps: number;
}

export interface Session {
  id: string;
  routineId: string | null;
  name: string;
  status: 'active' | 'done';
  startedAt: number;
  endedAt: number | null;
  /** Seconds the workout was paused (not counted in duration). */
  pausedMs: number;
  pausedAt: number | null;
  currentIndex: number;
  notes: string;
  exercises: SessionExercise[];
  // cached totals (computed on finish)
  durationSec: number;
  volume: number;
  setsDone: number;
  reps: number;
  prs: PRHit[];
  updatedAt: number;
}

/** Flattened, completed sets — the load history used for progression queries. */
export interface SetEntry {
  id: string; // sessionId:setUid
  sessionId: string;
  exerciseId: string;
  date: number;
  order: number;
  weight: number;
  reps: number;
  volume: number;
  updatedAt: number;
}

export type RecordType = 'maxWeight' | 'maxReps' | 'maxSetVolume' | 'maxExerciseVolume';

export interface PersonalRecord {
  id: string; // exerciseId:type
  exerciseId: string;
  type: RecordType;
  value: number;
  weight: number;
  reps: number;
  date: number;
  sessionId: string;
  updatedAt: number;
}

export interface BodyWeight {
  id: string;
  date: number;
  weight: number;
  updatedAt: number;
}

export interface Profile {
  id: 'me';
  name: string;
  photo: string | null; // data URL
  birthDate: string | null; // yyyy-mm-dd
  heightCm: number | null;
  goal: Goal;
  level: Level;
  trainingSince: string | null; // yyyy-mm-dd
  onboarded: boolean;
  updatedAt: number;
}

export interface Preferences {
  id: 'prefs';
  sound: boolean;
  vibration: boolean;
  autoRest: boolean;
  defaultRestSec: number;
  weightStep: number;
  keepAwake: boolean;
  updatedAt: number;
}

export interface Tombstone {
  id: string; // table:id
  table: string;
  recordId: string;
  deletedAt: number;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}
