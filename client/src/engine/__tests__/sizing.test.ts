import { describe, expect, it } from 'vitest';
import { DEFAULT_DEMAND, HOME_KWH, KW_PER_HP, buildDemand } from '../demand';
import { DEFAULT_SCENARIO, planDistrict } from '../plan';
import { RELIABILITY_TARGET, autonomyDays, initialSize, prepare, simulate, sizeSolar, sizeSolarDiesel, type SizingContext } from '../sizing';
import type { DemandInputs } from '../types';
import { byName, costs } from './fixtures';

const ctx = (name: string, demand: Partial<DemandInputs> = {}, scenario = {}): SizingContext => ({
  district: byName(name),
  demand: buildDemand({ ...DEFAULT_DEMAND, ...demand }),
  scenario: { ...DEFAULT_SCENARIO, ...scenario },
  costs,
  chemistry: 'lfp',
});

const NONE: Partial<DemandInputs> = { homes: 0, clinic: false, school: false, pumps: 0, streetlights: 0, otherKwh: 0 };

describe('demand builder', () => {
  it('adds up each load', () => {
    const d = buildDemand({ ...DEFAULT_DEMAND });
    const expected = 100 * HOME_KWH.standard + 10 + 8 + 4 * 5 * KW_PER_HP * 4 + (20 * 30 * 12) / 1000;
    expect(d.totalKwhDay).toBeCloseTo(expected, 6);
    expect(d.hourly.reduce((a, b) => a + b, 0)).toBeCloseTo(expected, 6);
    expect(d.peakKw).toBeGreaterThan(expected / 24);
    expect(d.criticalKwhDay).toBeGreaterThan(0);
  });
  it('handles empty and invalid inputs', () => {
    const d = buildDemand({ ...DEFAULT_DEMAND, ...NONE, homes: -5, pumpHp: Number.NaN });
    expect(d.totalKwhDay).toBe(0);
    expect(d.peakKw).toBe(0);
  });
  it('home tiers are 1.5 / 3 / 6 kWh per day', () => {
    expect(HOME_KWH).toEqual({ basic: 1.5, standard: 3, high: 6 });
  });
});

describe('sizing formulas', () => {
  it('PV = demand / (worst GHI × PR) × 1.1 and battery = night × autonomy / (DoD × RTE)', () => {
    const c = ctx('Jaisalmer', {}, { stormDays: 1 });
    const p = prepare(c);
    const init = initialSize(c, p);
    const worst = Math.min(...c.district.ghi_monthly);
    expect(init.pvKwp).toBeCloseTo((c.demand.totalKwhDay / (worst * 0.75)) * 1.1, 6);
    expect(init.batteryKwh).toBeCloseTo((c.demand.nightKwhDay * 1) / (0.8 * 0.9), 6);
  });
  it('autonomy maps storm days 1–5 to 1–2 days', () => {
    expect(autonomyDays(1)).toBe(1);
    expect(autonomyDays(5)).toBe(2);
    expect(autonomyDays(9)).toBe(2);
  });
});

describe('energy balance', () => {
  it('a zero system meets nothing; diesel backup meets everything', () => {
    const c = ctx('Delhi');
    const p = prepare(c);
    const none = simulate({ pvKwp: 0, batteryKwh: 0, windKw: 0, hydroKw: 0, dieselKva: 0, chemistry: 'lfp' }, p);
    expect(none.worstReliability).toBe(0);
    const d = sizeSolarDiesel(c, p);
    expect(d.sim.worstReliability).toBeCloseTo(1, 6);
    expect(d.sim.dieselLitres).toBeGreaterThan(0);
  });
  it('energy is conserved each month', () => {
    const c = ctx('Pune');
    const r = sizeSolar(c);
    for (const m of r.sim.months) expect(m.served + m.unmet).toBeCloseTo(m.demand, 6);
  });
  it('solar-only reaches the 99% worst-month target', () => {
    for (const n of ['Jaisalmer', 'Delhi', 'Dibrugarh', 'Leh', 'Mumbai']) {
      const r = sizeSolar(ctx(n));
      expect(r.meetsTarget).toBe(true);
      expect(r.sim.worstReliability).toBeGreaterThanOrEqual(RELIABILITY_TARGET - 1e-9);
    }
  });
});

describe('edge cases', () => {
  it('tiny demand (one basic home) still sizes a small, reliable system', () => {
    const plan = planDistrict(byName('Jodhpur'), { ...DEFAULT_DEMAND, ...NONE, homes: 1, homeTier: 'basic' }, DEFAULT_SCENARIO, costs);
    const solar = plan.options.find((o) => o.id === 'solar')!;
    expect(solar.spec.pvKwp).toBeGreaterThan(0);
    expect(solar.spec.pvKwp).toBeLessThan(5);
    expect(solar.meetsTarget).toBe(true);
    expect(plan.recommended).not.toBeNull();
  });
  it('zero demand produces an empty plan without NaNs', () => {
    const plan = planDistrict(byName('Jodhpur'), { ...DEFAULT_DEMAND, ...NONE }, DEFAULT_SCENARIO, costs);
    expect(plan.recommended).toBeNull();
    for (const o of plan.options) {
      expect(Number.isFinite(o.life.npv)).toBe(true);
      expect(o.spec.pvKwp).toBe(0);
    }
  });
  it('huge demand (20,000 high-use homes) scales linearly-ish and stays finite', () => {
    const small = sizeSolar(ctx('Nagpur'));
    const big = sizeSolar(ctx('Nagpur', { homes: 20000, homeTier: 'high' }));
    expect(Number.isFinite(big.spec.pvKwp)).toBe(true);
    expect(big.meetsTarget).toBe(true);
    expect(big.spec.pvKwp / small.spec.pvKwp).toBeGreaterThan(100);
  });
  it('zero hydro potential makes the hydro option unavailable', () => {
    const plan = planDistrict(byName('Jaisalmer'), DEFAULT_DEMAND, DEFAULT_SCENARIO, costs);
    const h = plan.options.find((o) => o.id === 'solar_hydro')!;
    expect(h.available).toBe(false);
    expect(h.reasonKey).toBe('options.unavailable.hydro');
    expect(plan.recommended).not.toBe('solar_hydro');
  });
  it('5 storm days needs more storage/PV than 1 storm day', () => {
    const a = sizeSolar(ctx('Kolkata', {}, { stormDays: 1 }));
    const b = sizeSolar(ctx('Kolkata', {}, { stormDays: 5 }));
    expect(b.meetsTarget).toBe(true);
    expect(b.spec.batteryKwh * 27000 + b.spec.pvKwp * 55000).toBeGreaterThan(a.spec.batteryKwh * 27000 + a.spec.pvKwp * 55000);
  });
  it('hydro flow reduction raises the hydro hybrid cost', () => {
    const d = byName('Idukki');
    const a = planDistrict(d, DEFAULT_DEMAND, { ...DEFAULT_SCENARIO, hydroFlowReductionPct: 0 }, costs).options.find((o) => o.id === 'solar_hydro')!;
    const b = planDistrict(d, DEFAULT_DEMAND, { ...DEFAULT_SCENARIO, hydroFlowReductionPct: 60 }, costs).options.find((o) => o.id === 'solar_hydro')!;
    expect(b.life.npv).toBeGreaterThan(a.life.npv);
  });
  it('recommends the cheapest option that meets the target', () => {
    const plan = planDistrict(byName('Idukki'), DEFAULT_DEMAND, DEFAULT_SCENARIO, costs);
    const feasible = plan.options.filter((o) => o.available && o.meetsTarget);
    const cheapest = feasible.reduce((a, b) => (a.life.npv <= b.life.npv ? a : b));
    expect(plan.recommended).toBe(cheapest.id);
  });
});
