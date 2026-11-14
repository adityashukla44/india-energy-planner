import { HOME_KWH } from './demand';
import type { DemandInputs, DemandResult, LoadKind } from './types';

export type PhaseKind = 'survey' | LoadKind;

export interface RolloutInputs {
  /** ISO year-month, e.g. "2027-01" */
  startMonth: string;
  monthsAvailable: number;
  /** ₹ per month */
  monthlyBudget: number;
  homesPerBatch: number;
}

export interface Phase {
  id: string;
  kind: PhaseKind;
  batch?: number;
  homes?: number;
  critical: boolean;
  cost: number;
  /** 0-based month index, -1 if never started */
  startMonth: number;
  endMonth: number;
  /** spend in each month index */
  spend: number[];
}

export interface RolloutMonth {
  index: number;
  /** ISO year-month */
  ym: string;
  spend: number;
  cumulative: number;
}

export interface RolloutResult {
  phases: Phase[];
  months: RolloutMonth[];
  totalCost: number;
  monthsNeeded: number;
  feasible: boolean;
  /** monthly budget needed to finish within monthsAvailable */
  budgetNeeded: number;
}

export const SURVEY_SHARE = 0.03;
export const MAX_MONTHS = 240;
const ORDER: LoadKind[] = ['clinic', 'school', 'pumps', 'homes', 'streetlights', 'other'];

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const base = (Number.isFinite(y) ? y : 2027) * 12 + ((Number.isFinite(m) ? m : 1) - 1) + n;
  const yy = Math.floor(base / 12);
  const mm = (base % 12) + 1;
  return `${yy}-${String(mm).padStart(2, '0')}`;
}

/** Splits the system cost into phases: survey, critical loads first, then homes in batches. */
export function buildPhases(totalCost: number, demand: DemandResult, inputs: Pick<DemandInputs, 'homeTier'>, homesPerBatch: number): Phase[] {
  const phases: Phase[] = [];
  const mk = (id: string, kind: PhaseKind, cost: number, critical: boolean, extra: Partial<Phase> = {}): Phase => ({
    id, kind, cost, critical, startMonth: -1, endMonth: -1, spend: [], ...extra,
  });
  if (totalCost <= 0 || demand.totalKwhDay <= 0) return phases;
  phases.push(mk('survey', 'survey', totalCost * SURVEY_SHARE, true));
  const build = totalCost * (1 - SURVEY_SHARE);
  for (const kind of ORDER) {
    const load = demand.loads.find((l) => l.kind === kind);
    if (!load || load.kwhDay <= 0) continue;
    const share = load.kwhDay / demand.totalKwhDay;
    if (kind === 'homes') {
      const per = Math.max(1, Math.round(homesPerBatch));
      const n = Math.ceil(load.count / per);
      const perHome = HOME_KWH[inputs.homeTier];
      for (let b = 0; b < n; b++) {
        const homes = Math.min(per, load.count - b * per);
        phases.push(mk(`homes-${b + 1}`, 'homes', (build * homes * perHome) / demand.totalKwhDay, false, { batch: b + 1, homes }));
      }
    } else {
      phases.push(mk(kind, kind, build * share, load.critical || kind === 'clinic' || kind === 'school' || kind === 'pumps'));
    }
  }
  return phases;
}

/** Cash-flow scheduler: each month spends up to the budget on phases in order. */
export function planRollout(totalCost: number, demand: DemandResult, demandInputs: Pick<DemandInputs, 'homeTier'>, inputs: RolloutInputs): RolloutResult {
  const phases = buildPhases(totalCost, demand, demandInputs, inputs.homesPerBatch);
  const budget = Math.max(0, inputs.monthlyBudget);
  const monthsAvailable = Math.max(1, Math.round(inputs.monthsAvailable));
  const sumCost = phases.reduce((s, p) => s + p.cost, 0);
  const budgetNeeded = Math.ceil(sumCost / monthsAvailable / 1000) * 1000;
  if (!phases.length) return { phases, months: [], totalCost: 0, monthsNeeded: 0, feasible: true, budgetNeeded: 0 };
  if (budget <= 0) return { phases, months: [], totalCost: sumCost, monthsNeeded: Infinity, feasible: false, budgetNeeded };

  const remaining = phases.map((p) => p.cost);
  let idx = 0;
  const months: RolloutMonth[] = [];
  let cumulative = 0;
  for (let mo = 0; mo < MAX_MONTHS && idx < phases.length; mo++) {
    let left = budget;
    let spentThisMonth = 0;
    while (left > 1e-6 && idx < phases.length) {
      const ph = phases[idx];
      const amt = Math.min(left, remaining[idx]);
      if (ph.startMonth < 0) ph.startMonth = mo;
      ph.spend[mo] = (ph.spend[mo] ?? 0) + amt;
      ph.endMonth = mo;
      remaining[idx] -= amt;
      left -= amt;
      spentThisMonth += amt;
      if (remaining[idx] <= 1e-6) idx++;
    }
    cumulative += spentThisMonth;
    months.push({ index: mo, ym: addMonths(inputs.startMonth, mo), spend: spentThisMonth, cumulative });
  }
  for (const ph of phases) for (let i = 0; i < months.length; i++) ph.spend[i] = ph.spend[i] ?? 0;
  const monthsNeeded = idx >= phases.length ? months.length : Infinity;
  return { phases, months, totalCost: sumCost, monthsNeeded, feasible: monthsNeeded <= monthsAvailable, budgetNeeded };
}

/** Fraction (0..1) of each phase complete at the end of month `t`. */
export function progressAt(r: RolloutResult, t: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ph of r.phases) {
    let spent = 0;
    for (let i = 0; i <= t && i < ph.spend.length; i++) spent += ph.spend[i] ?? 0;
    out[ph.id] = ph.cost > 0 ? Math.min(1, spent / ph.cost) : 1;
  }
  return out;
}
