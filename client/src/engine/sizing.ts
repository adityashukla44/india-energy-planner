import { batteryParams, gensetKva } from './costs';
import { isNightHour } from './demand';
import {
  MONTH_DAYS,
  argMin,
  hydroMonthlyFactor,
  mean,
  monthlyWindCF,
  solarHourlyShape,
} from './resource';
import type {
  Chemistry,
  CostParams,
  DemandResult,
  District,
  MonthResult,
  Scenario,
  SimResult,
  SystemSpec,
} from './types';

export const RELIABILITY_TARGET = 0.99;
const WARMUP_DAYS = 3;
const MAX_RECOVERY_DAYS = 4;

export interface SizingContext {
  district: District;
  demand: DemandResult;
  scenario: Scenario;
  costs: CostParams;
  chemistry: Chemistry;
}

/** Pre-computed per-month resource arrays so each simulation is cheap. */
export interface Prepared {
  /** [month][hour] kWh per kWp */
  pvPerKwp: number[][];
  /** [month] kWh per kW per hour */
  windPerKw: number[];
  /** [month] fraction of rated hydro output */
  hydroFactor: number[];
  demandHourly: number[];
  dod: number;
  rte: number;
  stormDays: number;
  stormPvFactor: number;
  worstSolarMonth: number;
}

export function prepare(ctx: SizingContext): Prepared {
  const { district: d, demand, scenario, costs, chemistry } = ctx;
  const pr = costs.performance_ratio;
  const pvPerKwp = d.ghi_monthly.map((ghi, m) => solarHourlyShape(d.lat, m).map((f) => f * ghi * pr));
  const b = batteryParams(chemistry, costs);
  return {
    pvPerKwp,
    windPerKw: monthlyWindCF(d, costs.wind_hub_height_m),
    hydroFactor: hydroMonthlyFactor(d, scenario.hydroFlowReductionPct),
    demandHourly: demand.hourly,
    dod: b.dod,
    rte: b.rte,
    stormDays: Math.max(0, Math.round(scenario.stormDays)),
    stormPvFactor: costs.storm_pv_factor,
    worstSolarMonth: argMin(d.ghi_monthly),
  };
}

interface Acc {
  demand: number;
  served: number;
  unmet: number;
  pv: number;
  wind: number;
  hydro: number;
  diesel: number;
  curtailed: number;
  batteryOut: number;
}
const zeroAcc = (): Acc => ({ demand: 0, served: 0, unmet: 0, pv: 0, wind: 0, hydro: 0, diesel: 0, curtailed: 0, batteryOut: 0 });

/**
 * Simulates one month: a steady-state typical day repeated for the month. In the worst solar
 * month it also includes one low-sun spell of `stormDays` days (PV at stormPvFactor of that
 * month's average) followed by recovery days. Month = typical × remaining days + spell.
 */
function simulateMonth(spec: SystemSpec, p: Prepared, m: number): MonthResult {
  const usable = spec.batteryKwh * p.dod;
  const eta = Math.sqrt(p.rte);
  const dieselKw = spec.dieselKva * 0.8;
  const pvDay = p.pvPerKwp[m];
  const windH = spec.windKw * p.windPerKw[m];
  const hydroH = spec.hydroKw * p.hydroFactor[m];
  const load = p.demandHourly;
  let soc = usable * 0.5;

  const runDay = (pvScale: number, acc: Acc | null) => {
    for (let h = 0; h < 24; h++) {
      const L = load[h];
      const pv = spec.pvKwp * pvDay[h] * pvScale;
      const gen = pv + windH + hydroH;
      const net = gen - L;
      let curtailed = 0;
      let bOut = 0;
      let dsl = 0;
      let unmet = 0;
      if (net >= 0) {
        const room = usable - soc;
        const charge = Math.min(net * eta, room);
        soc += charge;
        curtailed = net - charge / eta;
      } else {
        let need = -net;
        const avail = soc * eta;
        const d = Math.min(need, avail);
        soc -= d / eta;
        bOut = d;
        need -= d;
        if (need > 0 && dieselKw > 0) {
          dsl = Math.min(need, dieselKw);
          need -= dsl;
        }
        unmet = need;
      }
      if (acc) {
        acc.demand += L;
        acc.unmet += unmet;
        acc.served += L - unmet;
        acc.pv += pv;
        acc.wind += windH;
        acc.hydro += hydroH;
        acc.diesel += dsl;
        acc.curtailed += curtailed;
        acc.batteryOut += bOut;
      }
    }
  };

  for (let i = 0; i < WARMUP_DAYS; i++) runDay(1, null);
  const socStart = soc;
  const typ = zeroAcc();
  runDay(1, typ);
  soc = socStart;

  const spell = zeroAcc();
  let spellDays = 0;
  if (p.stormDays > 0 && m === p.worstSolarMonth) {
    for (let i = 0; i < p.stormDays; i++) {
      runDay(p.stormPvFactor, spell);
      spellDays++;
    }
    for (let i = 0; i < MAX_RECOVERY_DAYS && soc < socStart - 1e-6 * (usable + 1); i++) {
      runDay(1, spell);
      spellDays++;
    }
  }
  const days = MONTH_DAYS[m];
  const normalDays = Math.max(0, days - spellDays);
  const out = zeroAcc();
  (Object.keys(out) as (keyof Acc)[]).forEach((k) => {
    out[k] = typ[k] * normalDays + spell[k];
  });
  return { ...out, reliability: out.demand > 0 ? out.served / out.demand : 1 };
}

export function simulate(spec: SystemSpec, p: Prepared, kwhPerLitre = 3.4): SimResult {
  const months = Array.from({ length: 12 }, (_, m) => simulateMonth(spec, p, m));
  const rel = months.map((x) => x.reliability);
  const worstMonth = argMin(rel);
  const sum = (k: keyof MonthResult) => months.reduce((s, x) => s + x[k], 0);
  const annualDiesel = sum('diesel');
  return {
    months,
    worstMonth,
    worstReliability: rel[worstMonth],
    annualDemand: sum('demand'),
    annualServed: sum('served'),
    annualDiesel,
    annualPv: sum('pv'),
    annualWind: sum('wind'),
    annualHydro: sum('hydro'),
    annualCurtailed: sum('curtailed'),
    dieselLitres: kwhPerLitre > 0 ? annualDiesel / kwhPerLitre : 0,
  };
}

/** Sum of each month's shortfall below the target: a smooth objective for the greedy search. */
const shortfall = (s: SimResult, target: number) => s.months.reduce((a, m) => a + Math.max(0, target - m.reliability), 0);

/** Autonomy days from the storm slider: 1 day at 1 storm day up to 2 days at 5. */
export const autonomyDays = (stormDays: number) => 1 + 0.25 * (Math.min(5, Math.max(1, stormDays)) - 1);

/** Spec formulas: initial PV and battery before the energy-balance search. */
export function initialSize(
  ctx: SizingContext,
  p: Prepared,
  extra: { windKw?: number; hydroKw?: number } = {},
): { pvKwp: number; batteryKwh: number } {
  const { demand, district: d, costs, scenario } = ctx;
  const m = p.worstSolarMonth;
  const windKw = extra.windKw ?? 0;
  const hydroKw = extra.hydroKw ?? 0;
  const otherDaily = 24 * (windKw * p.windPerKw[m] + hydroKw * p.hydroFactor[m]);
  const daily = demand.totalKwhDay;
  const netDaily = Math.max(daily * 0.15, daily - otherDaily);
  const pvKwp = daily > 0 ? (netDaily / (d.ghi_monthly[m] * costs.performance_ratio)) * costs.safety_margin : 0;
  const otherNight = 12 * (windKw * p.windPerKw[m] + hydroKw * p.hydroFactor[m]);
  const night = Math.max(demand.nightKwhDay * 0.15, demand.nightKwhDay - otherNight);
  const batteryKwh = daily > 0 ? (night * autonomyDays(scenario.stormDays)) / (p.dod * p.rte) : 0;
  return { pvKwp, batteryKwh };
}

export interface SizeResult {
  spec: SystemSpec;
  sim: SimResult;
  iterations: number;
  meetsTarget: boolean;
}

/**
 * Greedy search: from the formula size, repeatedly add either +6% PV or +10% battery,
 * whichever removes more monthly shortfall per rupee, until the worst month ≥ target.
 */
export function sizeToTarget(
  start: SystemSpec,
  p: Prepared,
  ctx: SizingContext,
  target = RELIABILITY_TARGET,
  maxIter = 160,
): SizeResult {
  const kpl = ctx.costs.diesel_kwh_per_l;
  let spec = { ...start };
  let sim = simulate(spec, p, kpl);
  let it = 0;
  if (ctx.demand.totalKwhDay <= 0) return { spec, sim, iterations: 0, meetsTarget: true };
  const solarCost = ctx.costs.solar_capex_per_kw;
  const battCost = batteryParams(spec.chemistry, ctx.costs, ctx.scenario).costPerKwh;
  const minPvStep = Math.max(0.05, ctx.demand.totalKwhDay * 0.002);
  const minBattStep = Math.max(0.1, ctx.demand.nightKwhDay * 0.01);
  while (sim.worstReliability < target && it < maxIter) {
    it++;
    const a: SystemSpec = { ...spec, pvKwp: spec.pvKwp * 1.06 + minPvStep };
    const b: SystemSpec = { ...spec, batteryKwh: spec.batteryKwh * 1.1 + minBattStep };
    const sa = simulate(a, p, kpl);
    const sb = simulate(b, p, kpl);
    const base = shortfall(sim, target);
    const ga = (base - shortfall(sa, target)) / ((a.pvKwp - spec.pvKwp) * solarCost);
    const gb = (base - shortfall(sb, target)) / ((b.batteryKwh - spec.batteryKwh) * battCost);
    if (ga <= 0 && gb <= 0) {
      spec = { ...spec, pvKwp: a.pvKwp, batteryKwh: b.batteryKwh };
      sim = simulate(spec, p, kpl);
    } else if (ga >= gb) {
      spec = a;
      sim = sa;
    } else {
      spec = b;
      sim = sb;
    }
  }
  return { spec, sim, iterations: it, meetsTarget: sim.worstReliability >= target - 1e-9 };
}

export const emptySpec = (chemistry: Chemistry): SystemSpec => ({
  pvKwp: 0,
  batteryKwh: 0,
  windKw: 0,
  hydroKw: 0,
  dieselKva: 0,
  chemistry,
});

/** Solar + battery only. */
export function sizeSolar(ctx: SizingContext, p = prepare(ctx)): SizeResult {
  const init = initialSize(ctx, p);
  return sizeToTarget({ ...emptySpec(ctx.chemistry), ...init }, p, ctx);
}

/** Solar + battery with a fixed wind or hydro unit. */
export function sizeHybrid(ctx: SizingContext, extra: { windKw?: number; hydroKw?: number }, p = prepare(ctx)): SizeResult {
  const init = initialSize(ctx, p, extra);
  return sizeToTarget({ ...emptySpec(ctx.chemistry), ...init, windKw: extra.windKw ?? 0, hydroKw: extra.hydroKw ?? 0 }, p, ctx);
}

/**
 * Solar + diesel backup: PV sized on the annual-average month, one night of battery,
 * and a generator that covers any shortfall (litres counted).
 */
export function sizeSolarDiesel(ctx: SizingContext, p = prepare(ctx)): SizeResult {
  const { demand, district: d, costs } = ctx;
  const daily = demand.totalKwhDay;
  const pvKwp = daily > 0 ? (daily / (mean(d.ghi_monthly) * costs.performance_ratio)) * costs.safety_margin : 0;
  const nightNeed = demand.hourly.reduce((s, x, h) => s + (isNightHour(h) ? x : 0), 0);
  const batteryKwh = daily > 0 ? nightNeed / (p.dod * p.rte) : 0;
  const spec: SystemSpec = { ...emptySpec(ctx.chemistry), pvKwp, batteryKwh, dieselKva: gensetKva(demand.peakKw) };
  const sim = simulate(spec, p, costs.diesel_kwh_per_l);
  return { spec, sim, iterations: 0, meetsTarget: sim.worstReliability >= RELIABILITY_TARGET - 1e-9 };
}

/** Candidate wind sizes: share of annual energy targeted from wind. */
export const WIND_SHARES = [0.2, 0.35, 0.5];
export function windCandidates(ctx: SizingContext, p: Prepared): number[] {
  const annualKwh = ctx.demand.totalKwhDay * 365;
  const cf = p.windPerKw.reduce((s, c, m) => s + c * MONTH_DAYS[m], 0) / 365;
  if (cf <= 0 || annualKwh <= 0) return [];
  return WIND_SHARES.map((s) => Math.max(0.5, Math.round(((s * annualKwh) / (8760 * cf)) * 2) / 2));
}

/** Candidate hydro sizes: fraction of the average load, capped by site potential. */
export const HYDRO_FRACTIONS = [0.3, 0.6, 0.9];
export function hydroCandidates(ctx: SizingContext): number[] {
  const cap = ctx.district.small_hydro_potential === 'high' ? 1 : ctx.district.small_hydro_potential === 'med' ? 0.6 : 0;
  const avgKw = ctx.demand.totalKwhDay / 24;
  if (cap <= 0 || avgKw <= 0) return [];
  return HYDRO_FRACTIONS.map((f) => Math.max(0.5, Math.round(f * cap * avgKw * 2) / 2));
}
