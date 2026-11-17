import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { fmtPct } from '../../lib/format';

// ───────────────────────── Sheet / modal ─────────────────────────

export function Sheet({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.sheet-close)');
    setTimeout(() => focusable?.focus({ preventScroll: true }), 50);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} style={wide ? { maxWidth: 820 } : undefined}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-btn sm sheet-close" onClick={onClose} aria-label="Fechar"><X /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ───────────────────────── Confirm ─────────────────────────

interface ConfirmOpts { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Sheet open={!!state} onClose={() => close(false)} title={state?.title ?? ''}
        footer={<>
          <button className="btn grow" onClick={() => close(false)}>{state?.cancelLabel ?? 'Cancelar'}</button>
          <button className={`btn grow ${state?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>{state?.confirmLabel ?? 'Confirmar'}</button>
        </>}>
        <div className="muted">{state?.message}</div>
      </Sheet>
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

// ───────────────────────── Toast ─────────────────────────

type ToastKind = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: ToastKind }[]>([]);
  const show = useCallback((msg: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {createPortal(
        <div className="toast-wrap" role="status" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`}>
              {t.kind === 'success' ? <CheckCircle2 /> : t.kind === 'error' ? <AlertCircle /> : <Info />}
              <span>{t.msg}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ───────────────────────── Small pieces ─────────────────────────

export function PageHeader({ title, sub, back, actions }: { title: ReactNode; sub?: ReactNode; back?: boolean | string; actions?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="page-header">
      {back && (
        <button className="icon-btn bordered" aria-label="Voltar" onClick={() => (typeof back === 'string' ? nav(back) : window.history.length > 1 ? nav(-1) : nav('/'))}>
          <ArrowLeft />
        </button>
      )}
      <div className="grow">
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {actions}
    </header>
  );
}

export function Stat({ label, value, unit, hint, icon: Icon }: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="stat">
      <div className="stat-label">{Icon && <Icon aria-hidden />}{label}</div>
      <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
      {hint != null && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function Delta({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value == null || !isFinite(value)) return <span className="delta flat">—</span>;
  const good = invert ? value < 0 : value > 0;
  const cls = Math.abs(value) < 0.05 ? 'flat' : good ? 'up' : 'down';
  return <span className={`delta ${cls}`}>{fmtPct(value)}</span>;
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string | null; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="xs dim">{hint}</span> : null}
    </label>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Numeric input that accepts comma decimals and allows empty state while typing. */
export function NumInput({ value, onChange, min, max, step, decimal, className = 'input', invalid, ...rest }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; decimal?: boolean; className?: string; invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step'>) {
  const [text, setText] = useState(value == null ? '' : String(value).replace('.', ','));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { setText(value == null ? '' : String(value).replace('.', ',')); last.current = value; }
  }, [value]);
  return (
    <input
      {...rest}
      className={`${className}${invalid ? ' invalid' : ''}`}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.,]/g, '');
        setText(raw);
        if (raw === '') { last.current = null; onChange(null); return; }
        let n = Number(raw.replace(',', '.'));
        if (!isFinite(n)) return;
        if (!decimal) n = Math.trunc(n);
        if (max != null && n > max) n = max;
        if (min != null && n < min) n = min;
        last.current = n;
        onChange(n);
      }}
      aria-valuemin={min} aria-valuemax={max} data-step={step}
    />
  );
}
