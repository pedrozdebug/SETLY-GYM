// Lightweight, dependency-free SVG charts with touch/pointer tooltips.
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

export interface Point { x: number; y: number; label?: string }

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * p;
}

/** Track the real rendered width so SVG text is never stretched. */
function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** Indices that get an x-axis label, spaced so labels never overlap. */
function labelIndices(n: number, width: number, minGap = 52): Set<number> {
  const max = Math.max(1, Math.floor(width / minGap));
  const every = Math.max(1, Math.ceil(n / max));
  const out = new Set<number>();
  for (let i = 0; i < n; i += every) out.add(i);
  if (n > 1 && !out.has(n - 1)) {
    const prev = Math.max(...out);
    if (n - 1 - prev < every * 0.8) out.delete(prev);
    out.add(n - 1);
  }
  return out;
}

function useHover(count: number, W: number, ref: React.RefObject<HTMLDivElement | null>, xs: number[]) {
  const [idx, setIdx] = useState<number | null>(null);
  const onMove = (e: PointerEvent) => {
    const el = ref.current;
    if (!el || !count) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    xs.forEach((px, i) => { const d = Math.abs(px - x); if (d < bd) { bd = d; best = i; } });
    setIdx(best);
  };
  return { idx, onMove, clear: () => setIdx(null) };
}

export function LineChart({ data, height = 180, format = (v) => String(v), xLabel, area = true, ariaLabel }: {
  data: Point[]; height?: number; format?: (v: number) => string; xLabel?: (p: Point) => string; area?: boolean; ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const W = useWidth(ref);
  const padL = 52, padR = 14, padT = 16, padB = 24;
  const geo = useMemo(() => {
    if (!data.length) return null;
    const ys = data.map((d) => d.y);
    const minY0 = Math.min(...ys), maxY0 = Math.max(...ys);
    const span = maxY0 - minY0 || Math.max(1, maxY0 * 0.2);
    const minY = Math.max(0, minY0 - span * 0.25);
    const maxY = minY + niceMax((maxY0 - minY) * 1.15 || 1);
    const xs = data.map((_, i) => (data.length === 1 ? (padL + W - padR) / 2 : padL + (i / (data.length - 1)) * (W - padL - padR)));
    const yOf = (v: number) => padT + (1 - (v - minY) / (maxY - minY)) * (height - padT - padB);
    const pts = data.map((d, i) => [xs[i], yOf(d.y)] as const);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const areaPath = `${line} L${pts[pts.length - 1][0]},${height - padB} L${pts[0][0]},${height - padB} Z`;
    const ticks = [0, 0.5, 1].map((t) => minY + t * (maxY - minY));
    return { xs, pts, line, areaPath, ticks, yOf };
  }, [data, height, W]);
  const hover = useHover(data.length, W, ref, geo?.xs ?? []);
  const labels = labelIndices(data.length, W - padL - padR, 60);
  if (!geo) return <div className="chart-empty" ref={ref}>Sem dados no período</div>;
  const i = hover.idx;
  return (
    <div className="chart" ref={ref} onPointerMove={hover.onMove} onPointerDown={hover.onMove} onPointerLeave={hover.clear} role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} style={{ height }}>
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geo.ticks.map((t, k) => (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={geo.yOf(t)} y2={geo.yOf(t)} stroke="#26262E" strokeDasharray={k === 0 ? '' : '3 4'} vectorEffect="non-scaling-stroke" />
            <text x={padL - 8} y={geo.yOf(t) + 4} fill="#71717A" fontSize="11" textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {area && <path d={geo.areaPath} fill="url(#lc-fill)" />}
        <path d={geo.line} fill="none" stroke="#8B5CF6" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {geo.pts.map((p, k) => (
          <circle key={k} cx={p[0]} cy={p[1]} r={i === k ? 5 : data.length > 30 ? 0 : 3} fill={i === k ? '#fff' : '#8B5CF6'} stroke="#8B5CF6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        ))}
        {i != null && <line x1={geo.xs[i]} x2={geo.xs[i]} y1={padT} y2={height - padB} stroke="#8B5CF6" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />}
        {data.map((d, k) => labels.has(k) && (
          <text key={k} x={geo.xs[k]} y={height - 6} fill="#71717A" fontSize="11" textAnchor={k === 0 && data.length > 1 ? 'start' : k === data.length - 1 && data.length > 1 ? 'end' : 'middle'}>{xLabel ? xLabel(d) : d.label}</text>
        ))}
      </svg>
      {i != null && (
        <div className="chart-tip" style={{ left: `${Math.min(85, Math.max(15, (geo.xs[i] / W) * 100))}%` }}>
          <span className="dim">{data[i].label}</span> <b>{format(data[i].y)}</b>
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, height = 160, format = (v) => String(v), ariaLabel, highlightLast }: {
  data: Point[]; height?: number; format?: (v: number) => string; ariaLabel: string; highlightLast?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const W = useWidth(ref);
  const padL = 52, padR = 8, padT = 16, padB = 24;
  const max = niceMax(Math.max(0, ...data.map((d) => d.y)) * 1.1);
  const n = data.length || 1;
  const slot = (W - padL - padR) / n;
  const bw = Math.min(40, slot * 0.62);
  const xs = data.map((_, i) => padL + slot * i + slot / 2);
  const hover = useHover(data.length, W, ref, xs);
  if (!data.length) return <div className="chart-empty" ref={ref}>Sem dados no período</div>;
  const yOf = (v: number) => padT + (1 - v / max) * (height - padT - padB);
  const labels = labelIndices(n, W - padL - padR);
  const i = hover.idx;
  return (
    <div className="chart" ref={ref} onPointerMove={hover.onMove} onPointerDown={hover.onMove} onPointerLeave={hover.clear} role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} style={{ height }}>
        {[0, 0.5, 1].map((t, k) => (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={yOf(t * max)} y2={yOf(t * max)} stroke="#26262E" strokeDasharray={k === 0 ? '' : '3 4'} vectorEffect="non-scaling-stroke" />
            <text x={padL - 8} y={yOf(t * max) + 4} fill="#71717A" fontSize="11" textAnchor="end">{format(t * max)}</text>
          </g>
        ))}
        {data.map((d, k) => {
          const y = yOf(d.y);
          const h = Math.max(d.y > 0 ? 2 : 0, height - padB - y);
          const active = i === k || (highlightLast && i == null && k === n - 1);
          return <rect key={k} x={xs[k] - bw / 2} y={height - padB - h} width={bw} height={h} rx={Math.min(4, bw / 4)} fill={active ? '#8B5CF6' : '#6D28D9'} fillOpacity={active ? 1 : 0.55} />;
        })}
        {data.map((d, k) => labels.has(k) && (
          <text key={k} x={xs[k]} y={height - 6} fill="#71717A" fontSize="11" textAnchor="middle">{d.label}</text>
        ))}
      </svg>
      {i != null && (
        <div className="chart-tip" style={{ left: `${Math.min(85, Math.max(15, (xs[i] / W) * 100))}%` }}>
          <span className="dim">{data[i].label}</span> <b>{format(data[i].y)}</b>
        </div>
      )}
    </div>
  );
}

export function HBars({ items, format = (v) => String(v) }: { items: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div className="chart-empty">Sem dados no período</div>;
  return (
    <div className="stack-sm" style={{ gap: 10 }}>
      {items.map((it) => (
        <div className="hbar" key={it.label}>
          <span className="hbar-label">{it.label}</span>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(it.value / max) * 100}%` }} /></div>
          <span className="hbar-val">{format(it.value)}</span>
        </div>
      ))}
    </div>
  );
}
