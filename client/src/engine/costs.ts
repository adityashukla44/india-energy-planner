import type { Chemistry, CostParams, Scenario, SystemSpec } from './types';

export interface CostItem {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit: string;
  kind: 'sourced' | 'assumption';
  source?: string;
  detail?: string;
}
export interface CostsFile {
  version: string;
  items: Record<string, CostItem>;
  sources: Record<string, { title: string; url: string }>;
}

export const toParams = (file: CostsFile, overrides: Partial<CostParams> = {}): CostParams => {
  const p: CostParams = {};
  for (const [k, v] of Object.entries(file.items)) p[k] = v.value;
  for (const [k, v] of Object.entries(overrides)) if (typeof v === 'number' && Number.isFinite(v)) p[k] = v;
  return p;
};

export interface BatteryParams {
  dod: number;
  rte: number;
  costPerKwh: number;
}

export function batteryParams(chem: Chemistry, c: CostParams, scenario?: Pick<Scenario, 'batteryCost'>): BatteryParams {
  if (chem === 'leadacid')
    return { dod: c.leadacid_dod, rte: c.leadacid_rte, costPerKwh: scenario?.batteryCost ?? c.leadacid_capex_per_kwh };
  return { dod: c.lfp_dod, rte: c.lfp_rte, costPerKwh: scenario?.batteryCost ?? c.lfp_capex_per_kwh };
}

export interface CapexBreakdown {
  solar: number;
  battery: number;
  wind: number;
  hydro: number;
  diesel: number;
  total: number;
}

export function capex(spec: SystemSpec, c: CostParams, scenario?: Pick<Scenario, 'batteryCost'>): CapexBreakdown {
  const b = batteryParams(spec.chemistry, c, scenario);
  const solar = spec.pvKwp * c.solar_capex_per_kw;
  const battery = spec.batteryKwh * b.costPerKwh;
  const wind = spec.windKw * c.wind_capex_per_kw;
  const hydro = spec.hydroKw * c.hydro_capex_per_kw;
  const diesel = spec.dieselKva * c.genset_capex_per_kva;
  return { solar, battery, wind, hydro, diesel, total: solar + battery + wind + hydro + diesel };
}

/** Year-1 fixed O&M (excludes generator O&M, which scales with diesel kWh). */
export function fixedOandM(cap: CapexBreakdown, c: CostParams): number {
  return cap.solar * c.solar_om_pct + cap.wind * c.wind_om_pct + cap.hydro * c.hydro_om_pct;
}

/** Generator size for a peak load: kVA at 0.8 power factor with a 20% margin, minimum 3 kVA. */
export function gensetKva(peakKw: number): number {
  if (peakKw <= 0) return 0;
  return Math.max(3, Math.ceil(((peakKw / 0.8) * 1.2) / 0.5) * 0.5);
}
