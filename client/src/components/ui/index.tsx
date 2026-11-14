import clsx from 'clsx';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Info, Inbox } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtNum } from '../../lib/format';

/* ---------- Card ---------- */
export const Card = forwardRef<HTMLDivElement, ComponentProps<'div'> & { selected?: boolean; hover?: boolean; pad?: boolean }>(
  function Card({ className, selected, hover, pad = true, ...rest }, ref) {
    return <div ref={ref} className={clsx('card', pad && 'p-5', selected && 'card-selected', hover && 'lift', className)} {...rest} />;
  },
);

export function CardTitle({ icon, children, right, className }: { icon?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx('mb-4 flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-text">
        {icon && <span className="text-aqua">{icon}</span>}
        {children}
      </h2>
      {right}
    </div>
  );
}

/* ---------- Count-up number ---------- */
export function CountUp({ value, digits = 0, className, duration = 0.9 }: { value: number; digits?: number; className?: string; duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);
  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const ctl = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => ctl.stop();
  }, [value, reduced, duration]);
  return <span className={clsx('num', className)}>{Number.isFinite(value) ? fmtNum(shown, digits) : '—'}</span>;
}

/* ---------- Summary tile ---------- */
export function Tile({
  label,
  value,
  digits = 0,
  prefix,
  unit,
  sub,
  icon,
  badge,
  accent = 'aqua',
  children,
  className,
}: {
  label: string;
  value?: number;
  digits?: number;
  prefix?: string;
  unit?: string;
  sub?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  accent?: 'aqua' | 'amber' | 'mint' | 'critical' | 'hydro' | 'green';
  children?: ReactNode;
  className?: string;
}) {
  const color = { aqua: 'text-aqua', amber: 'text-amber', mint: 'text-mint', critical: 'text-critical', hydro: 'text-hydro', green: 'text-green' }[accent];
  return (
    <Card className={clsx('flex min-w-0 flex-col gap-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className={clsx('shrink-0', color)}>{icon}</span>}
      </div>
      {children ?? (
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          {prefix && <span className={clsx('font-display text-lg font-bold', color)}>{prefix}</span>}
          <CountUp value={value ?? 0} digits={digits} className={clsx('font-display text-xl font-extrabold leading-none', color)} />
          {unit && <span className="text-sm text-muted">{unit}</span>}
        </div>
      )}
      {(sub || badge) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {sub}
          {badge}
        </div>
      )}
    </Card>
  );
}

/* ---------- Badges ---------- */
export function Badge({ tone = 'muted', children, title, className }: { tone?: 'muted' | 'amber' | 'mint' | 'critical' | 'aqua' | 'sample'; children: ReactNode; title?: string; className?: string }) {
  const cls = {
    muted: 'border-line/60 text-muted',
    amber: 'border-amber/50 bg-amber/10 text-amber',
    mint: 'border-mint/50 bg-mint/10 text-mint',
    critical: 'border-critical/50 bg-critical/10 text-critical',
    aqua: 'border-aqua/50 bg-aqua/10 text-aqua',
    sample: 'border-geo/50 bg-geo/10 text-geo',
  }[tone];
  return (
    <span className={clsx('chip', cls, className)} title={title}>
      {children}
    </span>
  );
}

export function IllustrativeBadge() {
  const { t } = useTranslation();
  return (
    <Badge tone="amber" title={t('badges.illustrativeHint')}>
      <Info size={12} aria-hidden /> {t('badges.illustrative')}
    </Badge>
  );
}
export function AssumptionBadge({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <Badge tone="muted" title={title ?? t('badges.assumptionHint')}>
      {t('badges.assumption')}
    </Badge>
  );
}

/* ---------- Slider ---------- */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  badge,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
  badge?: ReactNode;
}) {
  const id = useId();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const text = format ? format(value) : fmtNum(value, 2);
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-text">
          {label}
          {badge}
        </label>
        <output htmlFor={id} className="num text-sm font-semibold text-aqua">
          {text}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        style={{ ['--pct' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <p className="-mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ---------- Segmented control / tabs ---------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: {
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex flex-wrap gap-1 rounded-btn border border-line/50 bg-bg/50 p-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative min-h-[36px] rounded-[9px] px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              size === 'sm' && 'min-h-[32px] px-2.5 text-xs',
              on ? 'text-bg' : 'text-muted hover:text-text',
            )}
          >
            {on && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-[9px] bg-aqua" transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }} />}
            <span className="relative z-10 inline-flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Toggle switch ---------- */
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: string }) {
  const id = useId();
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <label htmlFor={id} className="cursor-pointer text-sm text-text">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx('relative h-7 w-12 shrink-0 rounded-full border transition-colors', checked ? 'border-aqua bg-aqua/80' : 'border-line/70 bg-bg/60')}
      >
        <span className={clsx('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

/* ---------- Number field with steppers ---------- */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  unit,
  compact,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  compact?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (v: number) => onChange(Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)));
  return (
    <div className={clsx('flex min-w-0 flex-col gap-1', compact && 'min-w-[88px]')}>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center rounded-btn border border-line/50 bg-bg/60 focus-within:border-cyan">
        <button type="button" aria-label={`− ${label}`} className={clsx('h-11 shrink-0 text-lg text-muted hover:text-aqua', compact ? 'w-8' : 'w-10')} onClick={() => commit(value - step)}>
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className="num h-11 w-full min-w-0 bg-transparent text-center text-sm text-text focus:outline-none"
          value={text}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value !== '' && Number.isFinite(v)) commit(v);
          }}
          onBlur={() => setText(String(value))}
        />
        {unit && <span className={clsx('pr-1 text-xs text-muted', compact && 'hidden xl:inline')}>{unit}</span>}
        <button type="button" aria-label={`+ ${label}`} className={clsx('h-11 shrink-0 text-lg text-muted hover:text-aqua', compact ? 'w-8' : 'w-10')} onClick={() => commit(value + step)}>
          +
        </button>
      </div>
    </div>
  );
}

/* ---------- Ring gauge (donut) ---------- */
export function RingGauge({
  value,
  label,
  size = 120,
  stroke = 12,
  color = 'rgb(var(--mint))',
  children,
}: {
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line) / 0.35)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ---------- Arc gauge: production vs consumption ---------- */
export function ArcGauge({ produced, consumed, label, centerLabel }: { produced: number; consumed: number; label: string; centerLabel: string }) {
  const ratio = consumed > 0 ? produced / consumed : 0;
  const v = Math.min(1.5, Math.max(0, ratio)) / 1.5;
  const W = 200;
  const R = 80;
  const cx = W / 2;
  const cy = 96;
  const arc = (frac: number) => {
    const a = Math.PI * (1 - frac);
    return `${cx + R * Math.cos(a)} ${cy - R * Math.sin(a)}`;
  };
  const len = Math.PI * R;
  return (
    <div className="flex flex-col items-center" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${W} 110`} className="w-full max-w-[240px]">
        <path d={`M ${arc(0)} A ${R} ${R} 0 0 1 ${arc(1)}`} fill="none" stroke="rgb(var(--line) / 0.35)" strokeWidth="14" strokeLinecap="round" />
        <motion.path
          d={`M ${arc(0)} A ${R} ${R} 0 0 1 ${arc(1)}`}
          fill="none"
          stroke="url(#arcgrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={len}
          animate={{ strokeDashoffset: len * (1 - v) }}
          initial={false}
          transition={{ duration: 0.8 }}
        />
        <line x1={cx + (R - 14) * Math.cos(Math.PI / 3)} y1={cy - (R - 14) * Math.sin(Math.PI / 3)} x2={cx + (R + 12) * Math.cos(Math.PI / 3)} y2={cy - (R + 12) * Math.sin(Math.PI / 3)} stroke="rgb(var(--text))" strokeWidth="2" strokeDasharray="3 3" />
        <defs>
          <linearGradient id="arcgrad" x1="0" x2="1">
            <stop offset="0" stopColor="rgb(var(--critical))" />
            <stop offset="0.55" stopColor="rgb(var(--amber))" />
            <stop offset="0.68" stopColor="rgb(var(--mint))" />
            <stop offset="1" stopColor="rgb(var(--aqua))" />
          </linearGradient>
        </defs>
        <text x={cx} y={cy - 18} textAnchor="middle" className="fill-text font-display" fontSize="26" fontWeight="800">
          {fmtNum(ratio * 100, 0)}%
        </text>
        <text x={cx} y={cy} textAnchor="middle" className="fill-muted" fontSize="11">
          {centerLabel}
        </text>
      </svg>
    </div>
  );
}

/* ---------- Skeleton, empty and error states ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-card', className)} aria-hidden />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-aqua/30 bg-aqua/10 text-aqua">{icon ?? <Inbox aria-hidden />}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full border border-critical/40 bg-critical/10 text-critical">
        <AlertTriangle aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

/* ---------- Resource bar ---------- */
export function Bar({ value, color, label, valueText }: { value: number; color: string; label: string; valueText: string }) {
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text">{label}</span>
        <span className="num text-xs text-muted">{valueText}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-line/30"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={valueText}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          initial={reduced ? false : { width: 0 }}
          animate={{ width: `${Math.max(2, value * 100)}%` }}
          transition={{ duration: reduced ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
