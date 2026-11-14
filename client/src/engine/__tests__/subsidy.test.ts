import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchSchemes, pmsgHome, totalSubsidy, type SubsidiesFile } from '../subsidy';

const file: SubsidiesFile = JSON.parse(readFileSync(new URL('../../../public/data/subsidies.json', import.meta.url), 'utf8'));
const S = file.schemes;
const base = { state: 'Bihar', kw: 3, projectCost: 180000, gridConnected: true };

describe('PM Surya Ghar (homes)', () => {
  it('pays ₹30,000/kW up to 2 kW, ₹18,000 for the 3rd, max ₹78,000', () => {
    expect(pmsgHome(1)).toBe(30000);
    expect(pmsgHome(2)).toBe(60000);
    expect(pmsgHome(2.5)).toBe(69000);
    expect(pmsgHome(3)).toBe(78000);
    expect(pmsgHome(10)).toBe(78000);
    expect(pmsgHome(0)).toBe(0);
  });
  it('is not available off-grid', () => {
    const m = matchSchemes(S, { ...base, type: 'home_rooftop', gridConnected: false });
    expect(m.find((x) => x.scheme.id === 'pmsg_home')!.eligible).toBe(false);
    expect(matchSchemes(S, { ...base, type: 'home_offgrid' })).toHaveLength(0);
  });
  it('never exceeds the project cost', () => {
    const m = matchSchemes(S, { ...base, type: 'home_rooftop', projectCost: 50000 });
    expect(m[0].amount).toBe(50000);
  });
});

describe('state top-ups', () => {
  it('Delhi adds ₹10,000/kW up to ₹30,000 on top of PM Surya Ghar', () => {
    const m = matchSchemes(S, { ...base, state: 'Delhi', type: 'home_rooftop', kw: 5, projectCost: 300000 });
    expect(m.find((x) => x.scheme.id === 'delhi_topup')!.amount).toBe(30000);
    expect(totalSubsidy(m, 300000)).toBe(108000);
  });
  it('is not offered outside Delhi', () => {
    const m = matchSchemes(S, { ...base, type: 'home_rooftop' });
    expect(m.some((x) => x.scheme.id === 'delhi_topup')).toBe(false);
  });
});

describe('RWAs', () => {
  it('pays ₹18,000/kW capped at 3 kW per house and 500 kW', () => {
    const a = matchSchemes(S, { ...base, type: 'rwa', kw: 100, houses: 20, projectCost: 1e8 })[0];
    expect(a.amount).toBe(60 * 18000);
    const b = matchSchemes(S, { ...base, type: 'rwa', kw: 900, houses: 1000, projectCost: 1e9 })[0];
    expect(b.amount).toBe(500 * 18000);
  });
});

describe('PM-KUSUM', () => {
  it('is in transition and component B needs no grid and ≤7.5 HP', () => {
    const m = matchSchemes(S, { ...base, state: 'Punjab', type: 'solar_pump', pumpHp: 5, gridConnected: false, projectCost: 300000 });
    const b = m.find((x) => x.scheme.id === 'kusum_b')!;
    expect(b.scheme.status).toBe('transition');
    expect(b.amount).toBe(180000);
    const big = matchSchemes(S, { ...base, type: 'solar_pump', pumpHp: 10, gridConnected: false, projectCost: 300000 }).find((x) => x.scheme.id === 'kusum_b')!;
    expect(big.eligible).toBe(false);
  });
  it('transition schemes do not count towards the confirmed total', () => {
    const m = matchSchemes(S, { ...base, state: 'Punjab', type: 'solar_pump', pumpHp: 5, gridConnected: false, projectCost: 300000 });
    expect(totalSubsidy(m, 300000)).toBe(0);
  });
  it('uses only the central share where the state share is unknown', () => {
    const b = matchSchemes(S, { ...base, type: 'solar_pump', pumpHp: 5, gridConnected: false, projectCost: 100000 }).find((x) => x.scheme.id === 'kusum_b')!;
    expect(b.amount).toBe(30000);
    expect(b.reasonKey).toBe('subsidies.reasons.stateShare');
  });
});

describe('open questions', () => {
  it('never shows a higher figure for north-east / hill / island states', () => {
    const ne = matchSchemes(S, { ...base, state: 'Mizoram', type: 'home_rooftop' })[0];
    const other = matchSchemes(S, { ...base, state: 'Bihar', type: 'home_rooftop' })[0];
    expect(ne.amount).toBe(other.amount);
    expect(file.openQuestions.length).toBeGreaterThan(0);
  });
});
