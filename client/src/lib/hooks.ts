import { useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_DEMAND } from '../engine/demand';
import { scoreAllDistricts, type ImpactScore } from '../engine/impact';
import { DEFAULT_SCENARIO, planDistrict, type OptionPlan, type PlanResult } from '../engine/plan';
import type { District, OptionId } from '../engine/types';
import { useAppStore } from '../store/useAppStore';
import { useCostParams, useData, useDistrict } from './data';

export function useDebounced<T>(value: T, ms = 140): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export interface PlanState {
  district: District | null;
  plan: PlanResult | null;
  /** the option shown: user-selected if available, otherwise the recommendation */
  active: OptionPlan | null;
  activeId: OptionId | null;
  pending: boolean;
}

/** Runs the engine for the selected district with debounced inputs. */
export function usePlan(): PlanState {
  const district = useDistrict();
  const costs = useCostParams();
  const demand = useAppStore((s) => s.demand);
  const scenario = useAppStore((s) => s.scenario);
  const chemistry = useAppStore((s) => s.chemistry);
  const selectedOption = useAppStore((s) => s.selectedOption);
  const inputs = useMemo(() => ({ demand, scenario, chemistry }), [demand, scenario, chemistry]);
  const debounced = useDebounced(inputs, 140);
  const plan = useMemo(() => {
    if (!district || !costs) return null;
    return planDistrict(district, debounced.demand, debounced.scenario, costs, debounced.chemistry);
  }, [district, costs, debounced]);
  const activeId: OptionId | null = useMemo(() => {
    if (!plan) return null;
    const sel = selectedOption ? plan.options.find((o) => o.id === selectedOption && o.available) : null;
    return sel ? sel.id : plan.recommended ?? plan.options[0].id;
  }, [plan, selectedOption]);
  const active = plan?.options.find((o) => o.id === activeId) ?? null;
  return { district, plan, active, activeId, pending: inputs !== debounced };
}

let impactCache: { key: unknown; value: ImpactScore[] } | null = null;

/** Impact score for every district (default village design), computed once per cost set. */
export function useImpactScores(enabled = true): ImpactScore[] | null {
  const { districts } = useData();
  const costs = useCostParams();
  const [scores, setScores] = useState<ImpactScore[] | null>(impactCache?.key === costs ? impactCache.value : null);
  useEffect(() => {
    if (!enabled || !costs || !districts.length) return;
    if (impactCache?.key === costs) {
      setScores(impactCache.value);
      return;
    }
    const id = window.setTimeout(() => {
      const value = scoreAllDistricts(districts, costs, DEFAULT_DEMAND, {
        ...DEFAULT_SCENARIO,
        batteryCost: costs.lfp_capex_per_kwh,
        dieselPrice: costs.diesel_price_per_l,
      });
      impactCache = { key: costs, value };
      setScores(value);
    }, 30);
    return () => window.clearTimeout(id);
  }, [enabled, costs, districts]);
  return scores;
}

/** Reduced motion from the OS, or a low-power device: 3D scenes render a static frame. */
export function useStaticMotion(): boolean {
  const reduced = useReducedMotion();
  return !!reduced || isLowPower();
}

export function isLowPower(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.connection?.saveData ?? false) || (nav.deviceMemory !== undefined && nav.deviceMemory < 2);
}

let webgl: boolean | null = null;
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  return webgl;
}

/** True while the element is in (or near) the viewport. */
export function useInView<T extends Element>(rootMargin = '120px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);
  return { ref, inView };
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

/** Reads the design tokens as concrete colours (for charts and 3D). Updates with the theme. */
export function useThemeColors() {
  const theme = useAppStore((s) => s.theme);
  return useMemo(() => readTokens(), [theme]); // eslint-disable-line react-hooks/exhaustive-deps
}

export type Tokens = ReturnType<typeof readTokens>;
export function readTokens() {
  const cs = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const get = (n: string, fallback: string) => {
    const v = cs?.getPropertyValue(`--${n}`).trim();
    if (!v) return fallback;
    const [r, g, b] = v.split(/\s+/).map(Number);
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  };
  return {
    bg: get('bg', '#09080e'),
    panel: get('panel', '#213a57'),
    tealDeep: get('teal-deep', '#0b6477'),
    teal: get('teal', '#14919b'),
    aqua: get('aqua', '#0ad1c8'),
    cyan: get('cyan', '#02eff0'),
    mint: get('mint', '#45dfb1'),
    green: get('green', '#80ed99'),
    amber: get('amber', '#f5b544'),
    critical: get('critical', '#ff5c6c'),
    text: get('text', '#ffffff'),
    muted: get('muted', '#a9bcc4'),
    hydro: get('hydro', '#3b8bff'),
    geo: get('geo', '#ff7a59'),
    dark: document.documentElement.getAttribute('data-theme') !== 'light',
  };
}
