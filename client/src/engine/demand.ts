import type { DemandInputs, DemandResult, HomeTier, LoadItem } from './types';

export const HOME_KWH: Record<HomeTier, number> = { basic: 1.5, standard: 3, high: 6 };
export const KW_PER_HP = 0.746;

const normalise = (a: number[]) => {
  const s = a.reduce((x, y) => x + y, 0);
  return s > 0 ? a.map((x) => x / s) : a.map(() => 1 / a.length);
};

/** Typical rural/peri-urban home: morning bump, evening peak 18:00–22:00. */
export const HOME_PROFILE = normalise([
  2, 1.5, 1.5, 1.5, 2, 3.5, 5, 4.5, 3.5, 3, 3, 3, 3, 3, 3, 3, 3.5, 5, 8.5, 10, 9.5, 8, 5.5, 3,
]);
/** Clinic: 24 h base (vaccine fridge, lights) with daytime OPD load. */
export const CLINIC_PROFILE = normalise([
  3, 3, 3, 3, 3, 3, 3.5, 4, 5.5, 6, 6, 6, 6, 6, 6, 5.5, 5, 4.5, 4, 4, 3.5, 3.5, 3, 3,
]);
/** School: 08:00–16:00. */
export const SCHOOL_PROFILE = normalise(Array.from({ length: 24 }, (_, h) => (h >= 8 && h < 16 ? (h >= 10 && h < 14 ? 1.2 : 1) : 0)));
/** Streetlights: dusk to dawn, 18:00–06:00. */
export const STREETLIGHT_PROFILE = normalise(Array.from({ length: 24 }, (_, h) => (h >= 18 || h < 6 ? 1 : 0)));
export const FLAT_PROFILE = normalise(Array.from({ length: 24 }, () => 1));

/** Pumps run centred on solar noon for `hours` hours. */
export function pumpProfile(hours: number): number[] {
  const hrs = Math.min(24, Math.max(1, hours));
  const start = 12.5 - hrs / 2;
  const end = 12.5 + hrs / 2;
  return normalise(Array.from({ length: 24 }, (_, h) => Math.max(0, Math.min(h + 1, end) - Math.max(h, start))));
}

/** Night = hours without useful sun (18:00–06:00). */
export const isNightHour = (h: number) => h >= 18 || h < 6;

export const DEFAULT_DEMAND: DemandInputs = {
  homes: 100,
  homeTier: 'standard',
  clinic: true,
  clinicKwh: 10,
  clinicCritical: true,
  school: true,
  schoolKwh: 8,
  pumps: 4,
  pumpHp: 5,
  pumpHours: 4,
  streetlights: 20,
  streetlightW: 30,
  otherKwh: 0,
};

const nn = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);

export function buildDemand(inp: DemandInputs): DemandResult {
  const loads: LoadItem[] = [];
  const homes = Math.round(nn(inp.homes));
  if (homes > 0) loads.push({ kind: 'homes', count: homes, kwhDay: homes * HOME_KWH[inp.homeTier], critical: false, profile: HOME_PROFILE });
  if (inp.clinic && nn(inp.clinicKwh) > 0) loads.push({ kind: 'clinic', count: 1, kwhDay: nn(inp.clinicKwh), critical: inp.clinicCritical, profile: CLINIC_PROFILE });
  if (inp.school && nn(inp.schoolKwh) > 0) loads.push({ kind: 'school', count: 1, kwhDay: nn(inp.schoolKwh), critical: true, profile: SCHOOL_PROFILE });
  const pumps = Math.round(nn(inp.pumps));
  if (pumps > 0 && nn(inp.pumpHp) > 0 && nn(inp.pumpHours) > 0)
    loads.push({ kind: 'pumps', count: pumps, kwhDay: pumps * nn(inp.pumpHp) * KW_PER_HP * nn(inp.pumpHours), critical: true, profile: pumpProfile(inp.pumpHours) });
  const lights = Math.round(nn(inp.streetlights));
  if (lights > 0 && nn(inp.streetlightW) > 0)
    loads.push({ kind: 'streetlights', count: lights, kwhDay: (lights * nn(inp.streetlightW) * 12) / 1000, critical: false, profile: STREETLIGHT_PROFILE });
  if (nn(inp.otherKwh) > 0) loads.push({ kind: 'other', count: 1, kwhDay: nn(inp.otherKwh), critical: false, profile: FLAT_PROFILE });

  const hourly = Array.from({ length: 24 }, (_, h) => loads.reduce((s, l) => s + l.kwhDay * l.profile[h], 0));
  const totalKwhDay = loads.reduce((s, l) => s + l.kwhDay, 0);
  const peakKw = hourly.reduce((m, x) => Math.max(m, x), 0);
  const nightKwhDay = hourly.reduce((s, x, h) => s + (isNightHour(h) ? x : 0), 0);
  const criticalKwhDay = loads.filter((l) => l.critical).reduce((s, l) => s + l.kwhDay, 0);
  return { loads, totalKwhDay, peakKw, hourly, nightKwhDay, criticalKwhDay };
}
