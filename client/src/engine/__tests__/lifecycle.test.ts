import { describe, expect, it } from 'vitest';
import { DEFAULT_DEMAND, buildDemand } from '../demand';
import { capacityFactor, lifecycle } from '../lifecycle';
import { DEFAULT_SCENARIO } from '../plan';
import { prepare, sizeSolar, sizeSolarDiesel } from '../sizing';
import type { SizingContext } from '../sizing';
import { byName, costs } from './fixtures';

const mk = (scenario = {}, chemistry: 'lfp' | 'leadacid' = 'lfp'): SizingContext => ({
  district: byName('Jodhpur'),
  demand: buildDemand(DEFAULT_DEMAND),
  scenario: { ...DEFAULT_SCENARIO, ...scenario },
  costs,
  chemistry,
});

describe('lifecycle', () => {
  it('has year 0 plus 20 years and a monotone cumulative cost', () => {
    const c = mk();
    const r = sizeSolar(c);
    const l = lifecycle('solar', r.spec, r.sim, c.demand, c.scenario, costs);
    expect(l.years).toHaveLength(21);
    expect(l.years[0].cumulative).toBeCloseTo(l.capex.total, 6);
    for (let i = 1; i < l.years.length; i++) expect(l.years[i].cumulative).toBeGreaterThanOrEqual(l.years[i - 1].cumulative);
    expect(l.lcoe).toBeGreaterThan(0);
    expect(l.npv).toBeLessThan(l.total20);
  });
  it('replaces LFP once at year 11', () => {
    const c = mk({ demandGrowthPct: 0 });
    const r = sizeSolar(c);
    const l = lifecycle('solar', r.spec, r.sim, c.demand, c.scenario, costs);
    const repl = l.years.filter((y) => y.battery > 0).map((y) => y.year);
    expect(repl).toEqual([11]);
    expect(l.years[11].battery).toBeCloseTo(l.capex.battery, 6);
  });
  it('replaces lead-acid every 4 years', () => {
    const c = mk({ demandGrowthPct: 0, batteryCost: 11000 }, 'leadacid');
    const r = sizeSolar(c, prepare(c));
    const l = lifecycle('solar', r.spec, r.sim, c.demand, c.scenario, costs);
    expect(l.years.filter((y) => y.battery > 0).map((y) => y.year)).toEqual([5, 9, 13, 17]);
  });
  it('escalates O&M at 5.25% per year with no growth', () => {
    const c = mk({ demandGrowthPct: 0 });
    const r = sizeSolar(c);
    const l = lifecycle('solar', r.spec, r.sim, c.demand, c.scenario, costs);
    expect(l.years[2].om / l.years[1].om).toBeCloseTo(1.0525, 6);
  });
  it('diesel price raises the cost of the diesel hybrid and the diesel-only baseline', () => {
    const lo = mk({ dieselPrice: 80 });
    const hi = mk({ dieselPrice: 120 });
    const a = sizeSolarDiesel(lo);
    const b = sizeSolarDiesel(hi);
    const la = lifecycle('solar_diesel', a.spec, a.sim, lo.demand, lo.scenario, costs);
    const lb = lifecycle('solar_diesel', b.spec, b.sim, hi.demand, hi.scenario, costs);
    expect(lb.npv).toBeGreaterThan(la.npv);
    expect(lb.dieselOnlyNpv).toBeGreaterThan(la.dieselOnlyNpv);
    expect(la.dieselLitres20).toBeGreaterThan(0);
  });
  it('solar pays back against diesel-only well within 20 years', () => {
    const c = mk();
    const r = sizeSolar(c);
    const l = lifecycle('solar', r.spec, r.sim, c.demand, c.scenario, costs);
    expect(l.paybackVsDiesel).not.toBeNull();
    expect(l.paybackVsDiesel!).toBeLessThanOrEqual(10);
  });
  it('capacity tops up every 5 years with demand growth', () => {
    expect(capacityFactor(1, 0.05)).toBe(1);
    expect(capacityFactor(5, 0.05)).toBe(1);
    expect(capacityFactor(6, 0.05)).toBeCloseTo(1.05 ** 5, 9);
    const c = mk({ demandGrowthPct: 5 });
    const r = sizeSolar(c);
    const l = lifecycle('solar', r.spec, r.sim, c.demand, c.scenario, costs);
    expect(l.years[6].expansion).toBeGreaterThan(0);
    expect(l.years[7].expansion).toBe(0);
  });
  it('uses the small hydro discount rate for the hydro option', () => {
    const c = mk();
    const r = sizeSolar(c);
    expect(lifecycle('solar_hydro', r.spec, r.sim, c.demand, c.scenario, costs).discountRate).toBe(0.0938);
    expect(lifecycle('solar', r.spec, r.sim, c.demand, c.scenario, costs).discountRate).toBe(0.0908);
  });
});
