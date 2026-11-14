import { describe, expect, it } from 'vitest';
import { DEFAULT_DEMAND, buildDemand } from '../demand';
import { addMonths, buildPhases, planRollout, progressAt, SURVEY_SHARE } from '../rollout';

const demand = buildDemand(DEFAULT_DEMAND);
const inputs = { startMonth: '2027-01', monthsAvailable: 12, monthlyBudget: 2_000_000, homesPerBatch: 25 };

describe('rollout', () => {
  it('puts survey and critical loads before homes', () => {
    const ph = buildPhases(10_000_000, demand, DEFAULT_DEMAND, 25);
    expect(ph[0].kind).toBe('survey');
    const firstHome = ph.findIndex((p) => p.kind === 'homes');
    const crit = ph.filter((p) => ['clinic', 'school', 'pumps'].includes(p.kind));
    expect(crit.length).toBe(3);
    for (const c of crit) expect(ph.indexOf(c)).toBeLessThan(firstHome);
    expect(ph.filter((p) => p.kind === 'homes')).toHaveLength(4);
  });
  it('phase costs add up to the total', () => {
    const ph = buildPhases(10_000_000, demand, DEFAULT_DEMAND, 25);
    expect(ph.reduce((s, p) => s + p.cost, 0)).toBeCloseTo(10_000_000, 3);
    expect(ph[0].cost).toBeCloseTo(10_000_000 * SURVEY_SHARE, 3);
  });
  it('never spends more than the monthly budget and finishes', () => {
    const r = planRollout(10_000_000, demand, DEFAULT_DEMAND, inputs);
    for (const m of r.months) expect(m.spend).toBeLessThanOrEqual(inputs.monthlyBudget + 1e-6);
    expect(r.months[r.months.length - 1].cumulative).toBeCloseTo(10_000_000, 3);
    expect(r.monthsNeeded).toBe(5);
    expect(r.feasible).toBe(true);
  });
  it('flags when the budget cannot finish in time and says what is needed', () => {
    const r = planRollout(10_000_000, demand, DEFAULT_DEMAND, { ...inputs, monthsAvailable: 4, monthlyBudget: 1_000_000 });
    expect(r.feasible).toBe(false);
    expect(r.budgetNeeded).toBe(2_500_000);
  });
  it('handles zero budget and zero cost', () => {
    expect(planRollout(10_000_000, demand, DEFAULT_DEMAND, { ...inputs, monthlyBudget: 0 }).feasible).toBe(false);
    expect(planRollout(0, demand, DEFAULT_DEMAND, inputs).phases).toHaveLength(0);
  });
  it('progress reaches 1 by the end month of each phase', () => {
    const r = planRollout(10_000_000, demand, DEFAULT_DEMAND, inputs);
    for (const ph of r.phases) {
      expect(progressAt(r, ph.endMonth)[ph.id]).toBeCloseTo(1, 6);
      if (ph.startMonth > 0) expect(progressAt(r, ph.startMonth - 1)[ph.id]).toBe(0);
    }
  });
  it('adds months across year boundaries', () => {
    expect(addMonths('2027-11', 3)).toBe('2028-02');
    expect(addMonths('2027-01', 0)).toBe('2027-01');
  });
});
