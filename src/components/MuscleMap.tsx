// Schematic anatomy map highlighting primary and secondary muscle groups.
// It is an illustration of WHICH muscles are worked — not a movement demo.
import type { MuscleGroup } from '../db/types';

type Shape =
  | { t: 'e'; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { t: 'r'; x: number; y: number; w: number; h: number; r: number }
  | { t: 'p'; d: string };

const sym = (s: Extract<Shape, { t: 'e' }>): Shape[] => [s, { ...s, cx: 100 - s.cx, rot: s.rot ? -s.rot : undefined }];

const FRONT: { g: MuscleGroup | null; shapes: Shape[] }[] = [
  { g: null, shapes: [{ t: 'e', cx: 50, cy: 14, rx: 9, ry: 11 }, { t: 'r', x: 45, y: 23, w: 10, h: 9, r: 3 }] },
  { g: 'ombros', shapes: sym({ t: 'e', cx: 31, cy: 42, rx: 8, ry: 7 }) },
  { g: 'peito', shapes: [{ t: 'p', d: 'M37 36 Q49 33 49 38 L49 56 Q43 60 36 55 Q33 46 37 36 Z' }, { t: 'p', d: 'M63 36 Q51 33 51 38 L51 56 Q57 60 64 55 Q67 46 63 36 Z' }] },
  { g: 'biceps', shapes: sym({ t: 'e', cx: 25, cy: 61, rx: 5, ry: 11, rot: 10 }) },
  { g: 'antebracos', shapes: sym({ t: 'e', cx: 20, cy: 87, rx: 4.5, ry: 13, rot: 10 }) },
  { g: 'abdomen', shapes: [{ t: 'r', x: 41, y: 60, w: 18, h: 38, r: 5 }, { t: 'p', d: 'M37 60 L40 62 L40 96 L36 92 Z' }, { t: 'p', d: 'M63 60 L60 62 L60 96 L64 92 Z' }] },
  { g: null, shapes: [{ t: 'p', d: 'M38 99 L62 99 L60 112 L40 112 Z' }] },
  { g: 'quadriceps', shapes: sym({ t: 'e', cx: 42, cy: 135, rx: 8, ry: 22, rot: 4 }) },
  { g: null, shapes: sym({ t: 'e', cx: 43, cy: 161, rx: 4, ry: 3.5 }) },
  { g: 'panturrilhas', shapes: sym({ t: 'e', cx: 43, cy: 183, rx: 5, ry: 16 }) },
  { g: null, shapes: sym({ t: 'e', cx: 43, cy: 205, rx: 5, ry: 3 }) },
];

const BACK: { g: MuscleGroup | null; shapes: Shape[] }[] = [
  { g: null, shapes: [{ t: 'e', cx: 50, cy: 14, rx: 9, ry: 11 }] },
  { g: 'costas', shapes: [{ t: 'p', d: 'M42 26 L58 26 L68 38 L60 44 L50 46 L40 44 L32 38 Z' }, { t: 'p', d: 'M36 46 L49 48 L49 84 Q42 82 38 72 Q34 58 36 46 Z' }, { t: 'p', d: 'M64 46 L51 48 L51 84 Q58 82 62 72 Q66 58 64 46 Z' }, { t: 'r', x: 45, y: 84, w: 10, h: 14, r: 3 }] },
  { g: 'ombros', shapes: sym({ t: 'e', cx: 30, cy: 43, rx: 7.5, ry: 7 }) },
  { g: 'triceps', shapes: sym({ t: 'e', cx: 25, cy: 62, rx: 5, ry: 11, rot: 10 }) },
  { g: 'antebracos', shapes: sym({ t: 'e', cx: 20, cy: 87, rx: 4.5, ry: 13, rot: 10 }) },
  { g: 'gluteos', shapes: sym({ t: 'e', cx: 43, cy: 108, rx: 8.5, ry: 10 }) },
  { g: 'posterior', shapes: sym({ t: 'e', cx: 42, cy: 139, rx: 7.5, ry: 20, rot: 3 }) },
  { g: 'panturrilhas', shapes: sym({ t: 'e', cx: 43, cy: 180, rx: 6, ry: 15 }) },
  { g: null, shapes: sym({ t: 'e', cx: 43, cy: 205, rx: 5, ry: 3 }) },
];

function render(s: Shape, cls: string, k: number) {
  if (s.t === 'e') return <ellipse key={k} className={cls} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} />;
  if (s.t === 'r') return <rect key={k} className={cls} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} />;
  return <path key={k} className={cls} d={s.d} />;
}

function Figure({ parts, primary, secondary, label }: { parts: typeof FRONT; primary: MuscleGroup; secondary: MuscleGroup[]; label: string }) {
  let k = 0;
  return (
    <figure style={{ margin: 0, textAlign: 'center' }}>
      <svg viewBox="0 0 100 212" aria-hidden>
        {parts.map((p) => {
          const cls = p.g === primary ? 'mm-primary' : p.g && secondary.includes(p.g) ? 'mm-secondary' : 'mm-base';
          return p.shapes.map((s) => render(s, cls, k++));
        })}
      </svg>
      <figcaption className="xs dim">{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({ primary, secondary }: { primary: MuscleGroup; secondary: MuscleGroup[] }) {
  return (
    <div>
      <div className="muscle-map" role="img" aria-label="Mapa dos músculos trabalhados">
        <Figure parts={FRONT} primary={primary} secondary={secondary} label="Frente" />
        <Figure parts={BACK} primary={primary} secondary={secondary} label="Costas" />
      </div>
      <div className="legend mt-2"><span><i style={{ background: 'var(--accent)' }} />Principal</span><span><i style={{ background: 'var(--accent-2)', opacity: 0.6 }} />Secundário</span></div>
    </div>
  );
}
