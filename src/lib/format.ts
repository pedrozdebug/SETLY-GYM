const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const fmtInt = (n: number) => nf0.format(n);
export const fmtNum = (n: number) => nf1.format(n);
export const fmtKg = (n: number | null | undefined) => (n == null ? '—' : `${nf2.format(n)} kg`);

/** Compact volume: 12.4 t / 850 kg */
export function fmtVolume(kg: number): string {
  if (kg >= 10_000) return `${nf1.format(kg / 1000)} t`;
  return `${nf0.format(kg)} kg`;
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(r).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtDate(t: number, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('pt-BR', opts).format(t).replace('.', '');
}

export const fmtDateShort = (t: number) => fmtDate(t, { day: '2-digit', month: '2-digit' });
export const fmtWeekdayLong = (t: number) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(t);

export function fmtRelativeDay(t: number): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff > 1 && diff < 7) return `Há ${diff} dias`;
  return fmtDate(t);
}

export function pctChange(curr: number, prev: number): number | null {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

export function fmtPct(p: number | null): string {
  if (p == null || !isFinite(p)) return '—';
  const s = p > 0 ? '+' : '';
  return `${s}${nf1.format(p)}%`;
}

export function repRange(min: number, max: number): string {
  return min === max ? `${min}` : `${min}–${max}`;
}

/** Weight number with pt-BR decimals (62,5). */
export const fmtW = (n: number | null | undefined) => (n == null ? '—' : nf2.format(n));
