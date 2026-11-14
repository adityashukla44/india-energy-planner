import { capex, fixedOandM, gensetKva, type CapexBreakdown } from './costs';
import type { CostParams, DemandResult, OptionId, Scenario, SimResult, SystemSpec } from './types';

export const LIFETIME_YEARS = 20;
export const EXPANSION_INTERVAL = 5;

export interface LifecycleYear {
  year: number;
  capex: number;
  expansion: number;
  om: number;
  battery: number;
  fuel: number;
  total: number;
  cumulative: number;
  cumCapex: number;
  cumOm: number;
  cumBattery: number;
  cumFuel: number;
  energyKwh: number;
  dieselLitres: number;
  dieselOnlyCum: number;
  gridCum: number;
}

export interface LifecycleResult {
  years: LifecycleYear[];
  capex: CapexBreakdown;
  npv: number;
  lcoe: number;
  total20: number;
  paybackVsDiesel: number | null;
  paybackVsGrid: number | null;
  dieselLitres20: number;
  dieselLitresYear1: number;
  dieselOnlyNpv: number;
  dieselOnlyTotal20: number;
  gridNpv: number;
  gridTotal20: number;
  discountRate: number;
  energy20: number;
}

/** Capacity multiplier: capacity is topped up every 5 years to match demand growth. */
export const capacityFactor = (year: number, g: number) =>
  Math.pow(1 + g, EXPANSION_INTERVAL * Math.floor((Math.max(1, year) - 1) / EXPANSION_INTERVAL));

export function lifecycle(
  option: OptionId,
  spec: SystemSpec,
  sim: SimResult,
  demand: DemandResult,
  scenario: Scenario,
  c: CostParams,
  years = LIFETIME_YEARS,
): LifecycleResult {
  const g = scenario.demandGrowthPct / 100;
  const e = c.om_escalation;
  const r = option === 'solar_hydro' ? c.discount_rate_hydro : c.discount_rate;
  const cap = capex(spec, c, scenario);
  const fixedOm1 = fixedOandM(cap, c);
  const annualDemand = demand.totalKwhDay * 365;
  const servedRatio = sim.annualDemand > 0 ? sim.annualServed / sim.annualDemand : 1;
  const hasDiesel = spec.dieselKva > 0;
  const scalable = cap.total - cap.diesel;
  const kpl = c.diesel_kwh_per_l;
  const price = scenario.dieselPrice;

  // Diesel-only baseline
  const dKva = gensetKva(demand.peakKw);
  const dCapex = dKva * c.genset_capex_per_kva;

  const rows: LifecycleYear[] = [];
  let cum = cap.total;
  let cumCapex = cap.total;
  let cumOm = 0;
  let cumBattery = 0;
  let cumFuel = 0;
  let dieselCum = dCapex;
  let gridCum = 0;
  let npv = cap.total;
  let energyNpv = 0;
  let dieselNpv = dCapex;
  let gridNpv = 0;
  let litres20 = 0;
  let litres1 = 0;
  let energy20 = 0;
  let paybackVsDiesel: number | null = null;
  let paybackVsGrid: number | null = null;

  rows.push({
    year: 0, capex: cap.total, expansion: 0, om: 0, battery: 0, fuel: 0, total: cap.total, cumulative: cum,
    cumCapex, cumOm, cumBattery, cumFuel, energyKwh: 0, dieselLitres: 0, dieselOnlyCum: dieselCum, gridCum,
  });

  for (let y = 1; y <= years; y++) {
    const demandF = Math.pow(1 + g, y - 1);
    const C = capacityFactor(y, g);
    const Cprev = capacityFactor(y - 1, g);
    const esc = Math.pow(1 + e, y - 1);
    const fuelEsc = Math.pow(1 + c.diesel_escalation, y - 1);
    const pvF = Math.pow(1 - c.solar_degradation, y - 1);
    const energy = annualDemand * demandF;
    const capEnergy = annualDemand * C;

    const expansion = y > 1 && C > Cprev ? scalable * (C - Cprev) : 0;
    let dieselKwh = 0;
    let served: number;
    if (hasDiesel) {
      dieselKwh = sim.annualDiesel * C + Math.max(0, energy - capEnergy) + sim.annualPv * C * (1 - pvF) * 0.5;
      served = energy;
    } else {
      served = servedRatio * Math.min(energy, capEnergy);
    }
    const litres = kpl > 0 ? dieselKwh / kpl : 0;
    const fuel = litres * price * fuelEsc;
    const om = fixedOm1 * C * esc + dieselKwh * c.genset_om_per_kwh * esc;

    let battery = 0;
    if (spec.batteryKwh > 0) {
      if (spec.chemistry === 'lfp' && y === Math.round(c.lfp_replacement_year)) battery = cap.battery * C;
      if (spec.chemistry === 'leadacid' && y > 1 && (y - 1) % Math.max(1, Math.round(c.leadacid_replacement_interval)) === 0)
        battery = cap.battery * C;
    }
    const gensetRepl = hasDiesel && y === Math.round(c.genset_life_years) + 1 ? cap.diesel * C : 0;

    const total = expansion + om + battery + fuel + gensetRepl;
    cum += total;
    cumCapex += expansion + gensetRepl;
    cumOm += om;
    cumBattery += battery;
    cumFuel += fuel;

    const df = Math.pow(1 + r, y);
    npv += total / df;
    energyNpv += served / df;
    litres20 += litres;
    if (y === 1) litres1 = litres;
    energy20 += served;

    // Baselines
    const dFuel = (energy / kpl) * price * fuelEsc;
    const dOm = energy * c.genset_om_per_kwh * esc;
    const dRepl = y === Math.round(c.genset_life_years) + 1 ? dCapex * demandF : 0;
    const dTotal = dFuel + dOm + dRepl;
    dieselCum += dTotal;
    dieselNpv += dTotal / df;
    const gTotal = energy * c.grid_tariff_per_kwh * Math.pow(1 + c.grid_tariff_escalation, y - 1);
    gridCum += gTotal;
    gridNpv += gTotal / df;

    if (paybackVsDiesel === null && cum <= dieselCum) paybackVsDiesel = y;
    if (paybackVsGrid === null && cum <= gridCum) paybackVsGrid = y;

    rows.push({
      year: y, capex: 0, expansion: expansion + gensetRepl, om, battery, fuel, total, cumulative: cum,
      cumCapex, cumOm, cumBattery, cumFuel, energyKwh: served, dieselLitres: litres, dieselOnlyCum: dieselCum, gridCum,
    });
  }

  return {
    years: rows,
    capex: cap,
    npv,
    lcoe: energyNpv > 0 ? npv / energyNpv : 0,
    total20: cum,
    paybackVsDiesel,
    paybackVsGrid,
    dieselLitres20: litres20,
    dieselLitresYear1: litres1,
    dieselOnlyNpv: dieselNpv,
    dieselOnlyTotal20: dieselCum,
    gridNpv,
    gridTotal20: gridCum,
    discountRate: r,
    energy20,
  };
}
