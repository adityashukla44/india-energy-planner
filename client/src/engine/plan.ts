import { buildDemand } from './demand';
import { lifecycle, type LifecycleResult } from './lifecycle';
import { hydroAllowed, windUseful } from './resource';
import {
  emptySpec,
  hydroCandidates,
  prepare,
  simulate,
  sizeHybrid,
  sizeSolar,
  sizeSolarDiesel,
  windCandidates,
  type SizeResult,
  type SizingContext,
} from './sizing';
import type { Chemistry, CostParams, DemandInputs, DemandResult, District, OptionDesign, OptionId, Scenario } from './types';

export interface OptionPlan extends OptionDesign {
  life: LifecycleResult;
}

export interface PlanResult {
  demand: DemandResult;
  options: OptionPlan[];
  recommended: OptionId | null;
}

export const DEFAULT_SCENARIO: Scenario = {
  demandGrowthPct: 3,
  dieselPrice: 90,
  batteryCost: 27000,
  stormDays: 2,
  hydroFlowReductionPct: 20,
};

function toPlan(id: OptionId, r: SizeResult, ctx: SizingContext, available = true, reasonKey?: string): OptionPlan {
  return {
    id,
    available,
    reasonKey,
    spec: r.spec,
    sim: r.sim,
    meetsTarget: r.meetsTarget,
    iterations: r.iterations,
    life: lifecycle(id, r.spec, r.sim, ctx.demand, ctx.scenario, ctx.costs),
  };
}

function unavailable(id: OptionId, ctx: SizingContext, reasonKey: string): OptionPlan {
  const spec = emptySpec(ctx.chemistry);
  const p = prepare(ctx);
  const sim = simulate(spec, p, ctx.costs.diesel_kwh_per_l);
  return toPlan(id, { spec, sim, iterations: 0, meetsTarget: false }, ctx, false, reasonKey);
}

/** Choose the candidate with the lowest 20-year NPV, preferring ones that meet the target. */
function bestOf(id: OptionId, results: SizeResult[], ctx: SizingContext): OptionPlan {
  const plans = results.map((r) => toPlan(id, r, ctx));
  plans.sort((a, b) => Number(b.meetsTarget) - Number(a.meetsTarget) || a.life.npv - b.life.npv);
  return plans[0];
}

export function planDistrict(
  district: District,
  demandInputs: DemandInputs,
  scenario: Scenario,
  costs: CostParams,
  chemistry: Chemistry = 'lfp',
): PlanResult {
  const demand = buildDemand(demandInputs);
  const ctx: SizingContext = { district, demand, scenario, costs, chemistry };
  const p = prepare(ctx);

  const solar = toPlan('solar', sizeSolar(ctx, p), ctx);

  let hydro: OptionPlan;
  if (!hydroAllowed(district)) hydro = unavailable('solar_hydro', ctx, 'options.unavailable.hydro');
  else {
    const c = hydroCandidates(ctx);
    hydro = c.length ? bestOf('solar_hydro', c.map((kw) => sizeHybrid(ctx, { hydroKw: kw }, p)), ctx) : unavailable('solar_hydro', ctx, 'options.unavailable.noDemand');
  }

  let wind: OptionPlan;
  if (!windUseful(district, costs.wind_hub_height_m)) wind = unavailable('solar_wind', ctx, 'options.unavailable.wind');
  else {
    const c = windCandidates(ctx, p);
    wind = c.length ? bestOf('solar_wind', c.map((kw) => sizeHybrid(ctx, { windKw: kw }, p)), ctx) : unavailable('solar_wind', ctx, 'options.unavailable.noDemand');
  }

  const diesel = toPlan('solar_diesel', sizeSolarDiesel(ctx, p), ctx);

  const options = [solar, hydro, wind, diesel];
  const feasible = options.filter((o) => o.available && o.meetsTarget);
  feasible.sort((a, b) => a.life.npv - b.life.npv);
  return { demand, options, recommended: demand.totalKwhDay > 0 && feasible.length ? feasible[0].id : null };
}
