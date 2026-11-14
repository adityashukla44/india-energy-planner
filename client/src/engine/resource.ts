import type { District, Tier } from './types';

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MID_MONTH_DOY = [15, 46, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];

export const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const argMin = (a: number[]) => a.reduce((best, x, i) => (x < a[best] ? i : best), 0);
export const argMax = (a: number[]) => a.reduce((best, x, i) => (x > a[best] ? i : best), 0);
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Day length in hours for a latitude and month (mid-month declination). */
export function dayLengthHours(latDeg: number, month: number): number {
  const n = MID_MONTH_DOY[month];
  const decl = (23.44 * Math.PI) / 180 * Math.sin((2 * Math.PI * (284 + n)) / 365);
  const lat = (latDeg * Math.PI) / 180;
  const x = clamp(-Math.tan(lat) * Math.tan(decl), -1, 1);
  const ws = Math.acos(x);
  return (2 * ws * 180) / Math.PI / 15;
}

/**
 * Fraction of the day's solar energy falling in each clock hour (sums to 1).
 * Half-sine between sunrise and sunset, centred on 12:30 local solar time.
 */
export function solarHourlyShape(latDeg: number, month: number): number[] {
  const L = dayLengthHours(latDeg, month);
  const noon = 12.5;
  const rise = noon - L / 2;
  const set = noon + L / 2;
  // Integral of sin(pi*(t-rise)/L) from a to b = L/pi * (cos(pi*(a-rise)/L) - cos(pi*(b-rise)/L))
  const F = (t: number) => {
    const tt = clamp(t, rise, set);
    return -(L / Math.PI) * Math.cos((Math.PI * (tt - rise)) / L);
  };
  const raw = Array.from({ length: 24 }, (_, h) => Math.max(0, F(h + 1) - F(h)));
  const s = raw.reduce((a, b) => a + b, 0);
  return raw.map((x) => x / s);
}

/** Wind speed at hub height from 50 m speed, power-law shear (alpha 1/7). */
export function hubWindSpeed(v50: number, hubHeightM = 20, alpha = 0.143): number {
  return v50 * Math.pow(hubHeightM / 50, alpha);
}

/** Small-turbine power curve, fraction of rated output. Cut-in 3, rated 11, cut-out 25 m/s. */
export function powerCurve(v: number): number {
  const vci = 3;
  const vr = 11;
  const vco = 25;
  if (v < vci || v >= vco) return 0;
  if (v >= vr) return 1;
  return (v ** 3 - vci ** 3) / (vr ** 3 - vci ** 3);
}

/**
 * Capacity factor for a mean hub wind speed assuming a Rayleigh distribution,
 * with 15% losses (availability, wake, controller). Returns 0..1.
 */
export function windCapacityFactor(meanSpeed: number): number {
  if (meanSpeed <= 0) return 0;
  const vm2 = meanSpeed * meanSpeed;
  let cf = 0;
  const dv = 0.25;
  for (let v = dv / 2; v < 30; v += dv) {
    const pdf = ((Math.PI * v) / (2 * vm2)) * Math.exp((-Math.PI * v * v) / (4 * vm2));
    cf += pdf * powerCurve(v) * dv;
  }
  return cf * 0.85;
}

export function monthlyWindCF(d: District, hubHeightM = 20): number[] {
  return d.wind50m_monthly.map((v) => windCapacityFactor(hubWindSpeed(v, hubHeightM)));
}

export function annualWindCF(d: District, hubHeightM = 20): number {
  const cfs = monthlyWindCF(d, hubHeightM);
  return cfs.reduce((s, c, m) => s + c * MONTH_DAYS[m], 0) / 365;
}

/** Wind is "useful" when a small turbine would reach at least this capacity factor. */
export const WIND_USEFUL_CF = 0.09;
export function windUseful(d: District, hubHeightM = 20): boolean {
  return annualWindCF(d, hubHeightM) >= WIND_USEFUL_CF;
}

export function hydroAllowed(d: District): boolean {
  return d.small_hydro_potential === 'med' || d.small_hydro_potential === 'high';
}

const HYDRO_FLOW: Record<'snowmelt' | 'monsoon', number[]> = {
  monsoon: [0.45, 0.4, 0.35, 0.35, 0.45, 0.85, 1, 1, 1, 0.85, 0.65, 0.5],
  snowmelt: [0.35, 0.35, 0.45, 0.65, 0.9, 1, 1, 1, 0.85, 0.6, 0.45, 0.38],
};
export const DRY_MONTH_THRESHOLD = 0.6;

/** Monthly fraction of rated small-hydro output, with the dry-month flow reduction applied. */
export function hydroMonthlyFactor(d: District, flowReductionPct = 0): number[] {
  const base = HYDRO_FLOW[d.hydro_regime ?? 'monsoon'];
  const r = clamp(flowReductionPct, 0, 100) / 100;
  return base.map((f) => (f < DRY_MONTH_THRESHOLD ? f * (1 - r) : f));
}

export const TIER_SCORE: Record<Tier, number> = { none: 0, low: 0.3, med: 0.6, high: 0.9 };

export interface ResourceScores {
  solar: number;
  wind: number;
  hydro: number;
  biomass: number;
  geothermal: number;
}

/** 0..1 scores for the resource bars. */
export function resourceScores(d: District): ResourceScores {
  const ghi = mean(d.ghi_monthly);
  return {
    solar: clamp((ghi - 3) / 3, 0, 1),
    wind: clamp(annualWindCF(d) / 0.25, 0, 1),
    hydro: TIER_SCORE[d.small_hydro_potential],
    biomass: TIER_SCORE[d.biomass_potential],
    geothermal: d.geothermal_potential === 'potential' ? 0.5 : 0,
  };
}

export type ResourceKey = keyof ResourceScores;

/** Best sizeable resource (geothermal excluded: pilot-stage only in India). */
export function bestResource(d: District): Exclude<ResourceKey, 'geothermal'> {
  const s = resourceScores(d);
  const ranked: [Exclude<ResourceKey, 'geothermal'>, number][] = [
    ['solar', s.solar],
    ['wind', s.wind],
    ['hydro', s.hydro],
    ['biomass', s.biomass * 0.9],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  return ranked[0][0];
}

export const annualGhi = (d: District) => mean(d.ghi_monthly);
export const worstGhiMonth = (d: District) => argMin(d.ghi_monthly);
