import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BatteryCharging,
  CheckCircle2,
  Droplets,
  Flame,
  Fuel,
  GraduationCap,
  Hospital,
  Lamp,
  Search,
  Sprout,
  Sun,
  Waves,
  Wind,
  X,
  Home as HomeIcon,
  Plug,
} from 'lucide-react';
import { Component, useEffect, useId, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import type { District } from '../../engine/types';

/* ---------- Resource icons & colours ---------- */
export type ResKey = 'solar' | 'wind' | 'hydro' | 'biomass' | 'geothermal' | 'battery' | 'diesel' | 'clinic' | 'school' | 'pump' | 'homes' | 'streetlights' | 'other';
export const RES_COLOR: Record<string, string> = {
  solar: 'rgb(var(--amber))',
  wind: 'rgb(var(--aqua))',
  hydro: 'rgb(var(--hydro))',
  biomass: 'rgb(var(--green))',
  geothermal: 'rgb(var(--geo))',
  battery: 'rgb(var(--mint))',
  diesel: 'rgb(var(--critical))',
};
export function ResourceIcon({ kind, size = 18, className }: { kind: ResKey; size?: number; className?: string }) {
  const p = { size, className, 'aria-hidden': true as const };
  switch (kind) {
    case 'solar':
      return <Sun {...p} />;
    case 'wind':
      return <Wind {...p} />;
    case 'hydro':
      return <Waves {...p} />;
    case 'biomass':
      return <Sprout {...p} />;
    case 'geothermal':
      return <Flame {...p} />;
    case 'battery':
      return <BatteryCharging {...p} />;
    case 'diesel':
      return <Fuel {...p} />;
    case 'clinic':
      return <Hospital {...p} />;
    case 'school':
      return <GraduationCap {...p} />;
    case 'pump':
      return <Droplets {...p} />;
    case 'homes':
      return <HomeIcon {...p} />;
    case 'streetlights':
      return <Lamp {...p} />;
    default:
      return <Plug {...p} />;
  }
}

/* ---------- Toasts ---------- */
interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}
interface ToastState {
  items: ToastItem[];
  push: (text: string, tone?: 'ok' | 'error') => void;
  dismiss: (id: number) => void;
}
let tid = 0;
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (text, tone = 'ok') => {
    const id = ++tid;
    set({ items: [...get().items, { id, text, tone }] });
    window.setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));
export const toast = (text: string, tone: 'ok' | 'error' = 'ok') => useToasts.getState().push(text, tone);

export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  const { t } = useTranslation();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={clsx('glass pointer-events-auto flex items-center gap-3 rounded-btn px-4 py-3 text-sm', it.tone === 'error' && 'border-critical/50')}
          >
            <CheckCircle2 size={18} className={it.tone === 'error' ? 'text-critical' : 'text-mint'} aria-hidden />
            <span>{it.text}</span>
            <button className="text-muted hover:text-text" aria-label={t('common.dismiss')} onClick={() => dismiss(it.id)}>
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- District picker (accessible combobox) ---------- */
export function DistrictPicker({
  districts,
  onPick,
  placeholder,
  autoFocus,
  className,
  inputClassName,
}: {
  districts: District[];
  onPick: (d: District) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const r = s ? districts.filter((d) => d.name.toLowerCase().includes(s) || d.state.toLowerCase().includes(s)) : districts;
    return r.slice(0, 8);
  }, [q, districts]);
  useEffect(() => setHi(0), [q]);
  useEffect(() => {
    const off = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', off);
    return () => document.removeEventListener('mousedown', off);
  }, []);
  const pick = (d: District) => {
    onPick(d);
    setQ('');
    setOpen(false);
  };
  return (
    <div ref={boxRef} className={clsx('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && results[hi] ? `${listId}-${results[hi].id}` : undefined}
        aria-label={placeholder ?? t('picker.placeholder')}
        autoFocus={autoFocus}
        className={clsx('field pl-9', inputClassName)}
        placeholder={placeholder ?? t('picker.placeholder')}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setHi((h) => Math.min(results.length - 1, h + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => Math.max(0, h - 1));
          } else if (e.key === 'Enter' && results[hi]) {
            e.preventDefault();
            pick(results[hi]);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="glass absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-btn p-1">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t('picker.none')}</li>}
          {results.map((d, i) => (
            <li
              key={d.id}
              id={`${listId}-${d.id}`}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(d);
              }}
              onMouseEnter={() => setHi(i)}
              className={clsx('flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-[9px] px-3 text-sm', i === hi ? 'bg-aqua/15 text-text' : 'text-muted')}
            >
              <span className="font-medium text-text">{d.name}</span>
              <span className="text-xs">{d.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Error boundary (used around 3D scenes) ---------- */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.warn('Scene failed, showing fallback', err, info.componentStack);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
