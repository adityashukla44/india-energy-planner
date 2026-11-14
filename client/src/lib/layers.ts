import * as THREE from 'three';
import type { ImpactScore } from '../engine/impact';
import { annualGhi, annualWindCF, bestResource, mean } from '../engine/resource';
import type { District } from '../engine/types';
import type { MapLayer } from '../store/useAppStore';
import { fmtIndian, fmtNum } from './format';
import type { Tokens } from './hooks';

export const RAMPS: Record<Exclude<MapLayer, 'best'>, string[]> = {
  impact: ['#3B1A6E', '#6D28D9', '#A78BFA', '#45DFB1', '#80ED99'],
  solar: ['#5B4A2E', '#9C7330', '#F5B544', '#FFD98A'],
  wind: ['#2A1748', '#5B21B6', '#A78BFA', '#E4D7FF'],
  demand: ['#1E1B4B', '#3B4BA8', '#3B8BFF', '#A7CBFF'],
};
export const RAMPS_LIGHT: Record<Exclude<MapLayer, 'best'>, string[]> = {
  impact: ['#DDD3F0', '#A78BFA', '#6D28D9', '#1E9E78', '#2FA84F'],
  solar: ['#F3E2BD', '#E9C26C', '#C98A12', '#8A5C05'],
  wind: ['#E9E1FB', '#B9A3F3', '#7C3AED', '#4C1D95'],
  demand: ['#D4E3FA', '#8DB6F2', '#3B8BFF', '#1D4FA8'],
};

export function rampColor(stops: string[], t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const c = new THREE.Color(stops[i]).lerp(new THREE.Color(stops[i + 1]), x - i);
  return `#${c.getHexString()}`;
}

export const bestColor = (k: string, tk: Tokens) =>
  ({ solar: tk.amber, wind: tk.aqua, hydro: tk.hydro, biomass: tk.green, geothermal: tk.geo })[k] ?? tk.cyan;

export interface LayerValue {
  v01: number;
  color: string;
  valueText: string;
  key?: string;
}

const LOG_MIN = 4.3;
const LOG_SPAN = 3.3;

export function layerValues(districts: District[], layer: MapLayer, tk: Tokens, impact?: ImpactScore[] | null): Map<string, LayerValue> {
  const out = new Map<string, LayerValue>();
  const ramps = tk.dark ? RAMPS : RAMPS_LIGHT;
  for (const d of districts) {
    let v: LayerValue;
    if (layer === 'best') {
      const b = bestResource(d);
      const score = { solar: (annualGhi(d) - 3) / 3, wind: annualWindCF(d) / 0.25, hydro: 0.9, biomass: 0.8 }[b];
      v = { v01: Math.min(1, Math.max(0.25, score)), color: bestColor(b, tk), valueText: b, key: b };
    } else if (layer === 'solar') {
      const g = mean(d.ghi_monthly);
      const t = (g - 3.8) / 2.6;
      v = { v01: t, color: rampColor(ramps.solar, t), valueText: `${fmtNum(g, 2)} kWh/m²/day` };
    } else if (layer === 'wind') {
      const w = mean(d.wind50m_monthly);
      const t = (w - 2.8) / 4.4;
      v = { v01: t, color: rampColor(ramps.wind, t), valueText: `${fmtNum(w, 1)} m/s @ 50 m` };
    } else if (layer === 'demand') {
      const t = (Math.log10(Math.max(1, d.demand_mwh_yr_est)) - LOG_MIN) / LOG_SPAN;
      v = { v01: t, color: rampColor(ramps.demand, t), valueText: `${fmtIndian(d.demand_mwh_yr_est)} MWh/yr` };
    } else {
      const s = impact?.find((x) => x.districtId === d.id);
      const t = s ? s.score / 100 : 0;
      v = { v01: t, color: s ? rampColor(ramps.impact, t) : tk.muted, valueText: s ? `${fmtNum(s.score, 0)} / 100` : '…' };
    }
    v.v01 = Math.min(1, Math.max(0, v.v01));
    out.set(d.id, v);
  }
  return out;
}
