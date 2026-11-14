import { describe, expect, it } from 'vitest';
import { IMPACT_WEIGHTS, baselineDieselShare, impactScores, scoreAllDistricts, type ImpactMetrics } from '../impact';
import { byName, costs, districts } from './fixtures';

describe('impact score', () => {
  it('weights sum to 1 (30/25/25/20)', () => {
    expect(IMPACT_WEIGHTS.co2 + IMPACT_WEIGHTS.diesel + IMPACT_WEIGHTS.homes + IMPACT_WEIGHTS.cost).toBeCloseTo(1, 9);
  });
  it('normalises to 0–100 across districts', () => {
    const m = (id: string, x: number): ImpactMetrics => ({ districtId: id, recommended: 'solar', co2AvoidedT: x, dieselSavedL: x, homes: 100, homesPerCrore: x, lcoe: 1 / (x + 1), capex: 1 });
    const s = impactScores([m('a', 0), m('b', 5), m('c', 10)]);
    expect(s[0].score).toBe(0);
    expect(s[2].score).toBe(100);
    expect(s[1].score).toBeGreaterThan(0);
    expect(s[1].score).toBeLessThan(100);
  });
  it('scores all 50 districts, and diesel-dependent islands rank above grid-connected cities', () => {
    const s = scoreAllDistricts(districts, costs);
    expect(s).toHaveLength(50);
    for (const x of s) {
      expect(x.score).toBeGreaterThanOrEqual(0);
      expect(x.score).toBeLessThanOrEqual(100);
    }
    const get = (id: string) => s.find((x) => x.districtId === id)!.score;
    expect(get('lakshadweep')).toBeGreaterThan(get('delhi'));
  });
  it('off-grid districts assume a high diesel share', () => {
    expect(baselineDieselShare(byName('Lakshadweep'))).toBeGreaterThanOrEqual(0.9);
    expect(baselineDieselShare(byName('Delhi'))).toBeLessThan(0.2);
  });
});
