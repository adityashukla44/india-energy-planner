export type ProjectType = 'home_rooftop' | 'home_offgrid' | 'rwa' | 'solar_pump' | 'farm_plant' | 'feeder' | 'village_microgrid';

export type SchemeCalc =
  | { type: 'pmsg_home'; perKwUpTo2: number; thirdKw: number; max: number }
  | { type: 'per_kw_capped'; perKw: number; maxKw?: number; kwPerHouse?: number; max?: number }
  | { type: 'pct'; central: number; stateShares?: Record<string, number>; maxHp?: number; requiresNoGrid?: boolean }
  | { type: 'none' };

export interface Scheme {
  id: string;
  name: string;
  authority: string;
  projectTypes: ProjectType[];
  states: 'all' | string[];
  status: 'active' | 'transition' | 'closed';
  calc: SchemeCalc;
  rules: string[];
  url: string;
  source: string;
}

export interface SubsidiesFile {
  version: string;
  projectTypes: ProjectType[];
  schemes: Scheme[];
  transitionNote: string;
  openQuestions: string[];
}

export interface ProjectInputs {
  state: string;
  type: ProjectType;
  kw: number;
  projectCost: number;
  houses?: number;
  pumpHp?: number;
  gridConnected?: boolean;
}

export interface SchemeMatch {
  scheme: Scheme;
  eligible: boolean;
  /** estimated subsidy in ₹ (0 when not computable) */
  amount: number;
  /** i18n key explaining ineligibility or why no amount */
  reasonKey?: string;
  /** state share used, if any */
  stateShare?: number;
}

/** PM Surya Ghar homes: ₹30,000/kW up to 2 kW, ₹18,000 for the 3rd kW, max ₹78,000. */
export function pmsgHome(kw: number, c: { perKwUpTo2: number; thirdKw: number; max: number } = { perKwUpTo2: 30000, thirdKw: 18000, max: 78000 }): number {
  const k = Math.max(0, kw);
  const amt = Math.min(k, 2) * c.perKwUpTo2 + Math.min(Math.max(k - 2, 0), 1) * c.thirdKw;
  return Math.min(amt, c.max);
}

export function computeScheme(s: Scheme, p: ProjectInputs): SchemeMatch {
  const cap = (x: number) => Math.max(0, Math.min(x, p.projectCost > 0 ? p.projectCost : x));
  const c = s.calc;
  switch (c.type) {
    case 'pmsg_home':
      if (p.gridConnected === false || p.type === 'home_offgrid') return { scheme: s, eligible: false, amount: 0, reasonKey: 'subsidies.reasons.offgrid' };
      return { scheme: s, eligible: p.kw > 0, amount: cap(pmsgHome(p.kw, c)), reasonKey: p.kw > 0 ? undefined : 'subsidies.reasons.noKw' };
    case 'per_kw_capped': {
      let kw = Math.max(0, p.kw);
      if (c.maxKw !== undefined) kw = Math.min(kw, c.maxKw);
      if (c.kwPerHouse !== undefined && p.houses !== undefined) kw = Math.min(kw, c.kwPerHouse * Math.max(0, p.houses));
      let amt = kw * c.perKw;
      if (c.max !== undefined) amt = Math.min(amt, c.max);
      return { scheme: s, eligible: kw > 0, amount: cap(amt), reasonKey: kw > 0 ? undefined : 'subsidies.reasons.noKw' };
    }
    case 'pct': {
      if (c.requiresNoGrid && p.gridConnected) return { scheme: s, eligible: false, amount: 0, reasonKey: 'subsidies.reasons.needsNoGrid' };
      if (c.maxHp !== undefined && (p.pumpHp ?? 0) > c.maxHp) return { scheme: s, eligible: false, amount: 0, reasonKey: 'subsidies.reasons.hp' };
      const stateShare = c.stateShares?.[p.state];
      const pct = c.central + (stateShare ?? 0);
      return { scheme: s, eligible: true, amount: cap(p.projectCost * pct), stateShare, reasonKey: stateShare === undefined ? 'subsidies.reasons.stateShare' : undefined };
    }
    default:
      return { scheme: s, eligible: true, amount: 0, reasonKey: 'subsidies.reasons.noAmount' };
  }
}

/** Schemes that apply to the state + project type, with estimates; active ones first, then by amount. */
export function matchSchemes(schemes: Scheme[], p: ProjectInputs): SchemeMatch[] {
  return schemes
    .filter((s) => s.projectTypes.includes(p.type) && (s.states === 'all' || s.states.includes(p.state)))
    .map((s) => computeScheme(s, p))
    .sort((a, b) => Number(b.scheme.status === 'active') - Number(a.scheme.status === 'active') || b.amount - a.amount);
}

/** Total of eligible amounts from active schemes (stackable central + state top-ups), capped at the project cost. */
export function totalSubsidy(matches: SchemeMatch[], projectCost: number): number {
  const sum = matches.filter((m) => m.eligible && m.scheme.status === 'active').reduce((s, m) => s + m.amount, 0);
  return projectCost > 0 ? Math.min(sum, projectCost) : sum;
}
