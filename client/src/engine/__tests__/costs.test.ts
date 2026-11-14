import { describe, expect, it } from 'vitest';
import { batteryParams, capex, fixedOandM, gensetKva, toParams } from '../costs';
import { costs, costsFile } from './fixtures';

describe('costs.json', () => {
  it('matches the specified defaults', () => {
    expect(costs.solar_capex_per_kw).toBe(55000);
    expect(costs.lfp_capex_per_kwh).toBe(27000);
    expect(costs.leadacid_capex_per_kwh).toBe(11000);
    expect(costs.diesel_price_per_l).toBe(90);
    expect(costs.diesel_kwh_per_l).toBe(3.4);
    expect(costs.grid_tariff_per_kwh).toBe(8);
    expect(costs.om_escalation).toBe(0.0525);
    expect(costs.discount_rate).toBe(0.0908);
    expect(costs.discount_rate_hydro).toBe(0.0938);
    expect(costs.wind_capex_per_kw).toBe(150000);
    expect(costs.hydro_capex_per_kw).toBe(120000);
    expect(costs.solar_degradation).toBe(0.005);
    expect(costs.lfp_replacement_year).toBe(11);
    expect(costs.leadacid_replacement_interval).toBe(4);
    expect(costs.solar_om_pct).toBe(0.01);
  });
  it('every item is labelled sourced or assumption, and sourced items cite a source', () => {
    for (const [k, v] of Object.entries(costsFile.items)) {
      expect(['sourced', 'assumption'], k).toContain(v.kind);
      if (v.kind === 'sourced') expect(costsFile.sources[v.source!], k).toBeTruthy();
    }
  });
  it('overrides replace defaults and ignore non-numbers', () => {
    const p = toParams(costsFile, { diesel_price_per_l: 110, solar_capex_per_kw: Number.NaN });
    expect(p.diesel_price_per_l).toBe(110);
    expect(p.solar_capex_per_kw).toBe(55000);
  });
});

describe('capex', () => {
  it('multiplies sizes by unit costs', () => {
    const cap = capex({ pvKwp: 10, batteryKwh: 20, windKw: 2, hydroKw: 1, dieselKva: 5, chemistry: 'lfp' }, costs);
    expect(cap.solar).toBe(550000);
    expect(cap.battery).toBe(540000);
    expect(cap.wind).toBe(300000);
    expect(cap.hydro).toBe(120000);
    expect(cap.diesel).toBe(60000);
    expect(cap.total).toBe(550000 + 540000 + 300000 + 120000 + 60000);
  });
  it('uses the battery cost slider when given', () => {
    const cap = capex({ pvKwp: 0, batteryKwh: 10, windKw: 0, hydroKw: 0, dieselKva: 0, chemistry: 'lfp' }, costs, { batteryCost: 20000 });
    expect(cap.battery).toBe(200000);
  });
  it('lead-acid has a shallower depth of discharge', () => {
    expect(batteryParams('leadacid', costs).dod).toBe(0.5);
    expect(batteryParams('lfp', costs).dod).toBe(0.8);
  });
  it('solar O&M is 1% of capex', () => {
    const cap = capex({ pvKwp: 10, batteryKwh: 0, windKw: 0, hydroKw: 0, dieselKva: 0, chemistry: 'lfp' }, costs);
    expect(fixedOandM(cap, costs)).toBeCloseTo(5500, 6);
  });
  it('generator sizing has a 3 kVA floor and 0 for no load', () => {
    expect(gensetKva(0)).toBe(0);
    expect(gensetKva(1)).toBe(3);
    expect(gensetKva(40)).toBe(60);
  });
});
