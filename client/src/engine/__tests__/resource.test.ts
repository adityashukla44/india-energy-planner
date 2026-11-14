import { describe, expect, it } from 'vitest';
import {
  annualWindCF, bestResource, dayLengthHours, hubWindSpeed, hydroAllowed, hydroMonthlyFactor, powerCurve,
  resourceScores, solarHourlyShape, windCapacityFactor, windUseful,
} from '../resource';
import { byName, districts } from './fixtures';

describe('districts.json', () => {
  it('has exactly the 50 scoped districts with complete monthly data', () => {
    expect(districts).toHaveLength(50);
    const ids = new Set(districts.map((d) => d.id));
    expect(ids.size).toBe(50);
    for (const d of districts) {
      expect(d.ghi_monthly).toHaveLength(12);
      expect(d.wind50m_monthly).toHaveLength(12);
      expect(typeof d.illustrative).toBe('boolean');
    }
  });
  it('follows the published solar tiers', () => {
    for (const n of ['Leh', 'Kargil', 'Jaisalmer', 'Bikaner', 'Jodhpur', 'Barmer', 'Kutch']) {
      const g = byName(n).ghi_monthly.reduce((a, b) => a + b, 0) / 12;
      expect(g).toBeGreaterThan(6.0);
    }
    for (const n of ['Tawang', 'Aizawl', 'East Khasi Hills', 'Dibrugarh']) {
      const g = byName(n).ghi_monthly.reduce((a, b) => a + b, 0) / 12;
      expect(g).toBeLessThan(4.5);
    }
  });
  it('dips in the monsoon for monsoon regions and in winter for Ladakh', () => {
    const pune = byName('Mumbai').ghi_monthly;
    expect(Math.min(...pune.slice(5, 9))).toBeLessThan(Math.min(...pune.slice(0, 5)));
    const leh = byName('Leh').ghi_monthly;
    expect(leh[11]).toBeLessThan(leh[5]);
    expect(leh[0]).toBeLessThan(leh[6]);
  });
  it('only marks geothermal as potential, never as a sized resource', () => {
    expect(byName('Leh').geothermal_potential).toBe('potential');
    for (const d of districts) expect(bestResource(d)).not.toBe('geothermal');
  });
});

describe('solar geometry', () => {
  it('day length is ~12 h at the equinox and longer in northern summer', () => {
    expect(dayLengthHours(0, 2)).toBeCloseTo(12, 0);
    expect(dayLengthHours(34, 5)).toBeGreaterThan(14);
    expect(dayLengthHours(34, 11)).toBeLessThan(10.5);
  });
  it('hourly shape sums to 1 and is zero at night', () => {
    const s = solarHourlyShape(26, 5);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(s[0]).toBe(0);
    expect(s[23]).toBe(0);
    expect(s[12]).toBeGreaterThan(s[8]);
  });
});

describe('wind', () => {
  it('power curve respects cut-in, rated and cut-out', () => {
    expect(powerCurve(2)).toBe(0);
    expect(powerCurve(11)).toBe(1);
    expect(powerCurve(26)).toBe(0);
    expect(powerCurve(7)).toBeGreaterThan(0);
    expect(powerCurve(7)).toBeLessThan(1);
  });
  it('capacity factor rises with wind speed', () => {
    expect(windCapacityFactor(0)).toBe(0);
    expect(windCapacityFactor(6)).toBeGreaterThan(windCapacityFactor(4));
    expect(hubWindSpeed(6, 20)).toBeLessThan(6);
  });
  it('wind corridors are useful, the cloudy north-east is not', () => {
    expect(windUseful(byName('Tirunelveli'))).toBe(true);
    expect(windUseful(byName('Kutch'))).toBe(true);
    expect(windUseful(byName('Dibrugarh'))).toBe(false);
    expect(annualWindCF(byName('Tirunelveli'))).toBeGreaterThan(annualWindCF(byName('Delhi')));
  });
});

describe('hydro', () => {
  it('is only allowed where potential is med or high', () => {
    expect(hydroAllowed(byName('Idukki'))).toBe(true);
    expect(hydroAllowed(byName('Jaisalmer'))).toBe(false);
    expect(hydroAllowed(byName('Leh'))).toBe(false);
  });
  it('flow reduction only cuts dry months', () => {
    const d = byName('Idukki');
    const a = hydroMonthlyFactor(d, 0);
    const b = hydroMonthlyFactor(d, 60);
    expect(b[6]).toBe(a[6]);
    expect(b[2]).toBeCloseTo(a[2] * 0.4, 6);
  });
});

describe('resource scores', () => {
  it('are within 0..1 and pick sensible best resources', () => {
    for (const d of districts) {
      for (const v of Object.values(resourceScores(d))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(bestResource(byName('Jaisalmer'))).toBe('solar');
    expect(bestResource(byName('Tirunelveli'))).toBe('wind');
    expect(bestResource(byName('Idukki'))).toBe('hydro');
  });
});
