import { DEFAULT_DEMAND } from './demand';
import { DEFAULT_SCENARIO, planDistrict, type PlanResult } from './plan';
import type { CostParams, DemandInputs, District, OptionId, Scenario } from './types';

export const IMPACT_WEIGHTS = { co2: 0.3, diesel: 0.25, homes: 0.25, cost: 0.2 } as const;

/** Share of today's supply assumed to come from diesel, by dependence tier (assumption). */
export const DIESEL_SHARE = { low: 0.1, med: 0.4, high: 0.8 } as const;

export function baselineDieselShare(d: District): number {
  const s = DIESEL_SHARE[d.diesel_dependence];
  return d.grid_access === 'offgrid' ? Math.max(s, 0.9) : s;
}

export interface ImpactMetrics {
  districtId: string;
  recommended: OptionId | null;
  co2AvoidedT: number;
  dieselSavedL: number;
  homes: number;
  homesPerCrore: number;
  lcoe: number;
  capex: number;
}

export function impactMetrics(d: District, plan: PlanResult, demandInputs: DemandInputs, c: CostParams): ImpactMetrics {
  const opt = plan.options.find((o) => o.id === plan.recommended) ?? plan.options[0];
  const kpl = c.diesel_kwh_per_l;
  const share = baselineDieselShare(d);
  const baselineKgPerKwh = share * (c.co2_diesel_kg_per_l / kpl) + (1 - share) * c.co2_grid_kg_per_kwh;
  const served = opt.sim.annualServed;
  const designLitres = opt.sim.dieselLitres;
  const co2 = (served * baselineKgPerKwh - designLitres * c.co2_diesel_kg_per_l) / 1000;
  const dieselSaved = (opt.sim.annualDemand * share) / kpl - designLitres;
  const capex = opt.life.capex.total;
  return {
    districtId: d.id,
    recommended: plan.recommended,
    co2AvoidedT: co2,
    dieselSavedL: dieselSaved,
    homes: demandInputs.homes,
    homesPerCrore: capex > 0 ? demandInputs.homes / (capex / 1e7) : 0,
    lcoe: opt.life.lcoe,
    capex,
  };
}

export interface ImpactScore extends ImpactMetrics {
  score: number;
  parts: { co2: number; diesel: number; homes: number; cost: number };
}

const minmax = (xs: number[]) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return (x: number) => (hi - lo > 1e-12 ? (x - lo) / (hi - lo) : 1);
};

/** Normalise each metric across districts (0..1), weight, and scale to 0–100. */
export function impactScores(metrics: ImpactMetrics[]): ImpactScore[] {
  if (!metrics.length) return [];
  const nCo2 = minmax(metrics.map((m) => m.co2AvoidedT));
  const nDiesel = minmax(metrics.map((m) => m.dieselSavedL));
  const nHomes = minmax(metrics.map((m) => m.homesPerCrore));
  const inv = metrics.map((m) => (m.lcoe > 0 ? 1 / m.lcoe : 0));
  const nCost = minmax(inv);
  return metrics.map((m, i) => {
    const parts = { co2: nCo2(m.co2AvoidedT), diesel: nDiesel(m.dieselSavedL), homes: nHomes(m.homesPerCrore), cost: nCost(inv[i]) };
    const score =
      100 * (IMPACT_WEIGHTS.co2 * parts.co2 + IMPACT_WEIGHTS.diesel * parts.diesel + IMPACT_WEIGHTS.homes * parts.homes + IMPACT_WEIGHTS.cost * parts.cost);
    return { ...m, parts, score: Math.round(score * 10) / 10 };
  });
}

/** Default village design for every district, scored. */
export function scoreAllDistricts(
  districts: District[],
  c: CostParams,
  demandInputs: DemandInputs = DEFAULT_DEMAND,
  scenario: Scenario = { ...DEFAULT_SCENARIO, batteryCost: c.lfp_capex_per_kwh, dieselPrice: c.diesel_price_per_l },
): ImpactScore[] {
  const metrics = districts.map((d) => impactMetrics(d, planDistrict(d, demandInputs, scenario, c, 'lfp'), demandInputs, c));
  return impactScores(metrics);
}
