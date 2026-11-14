export type Tier = 'none' | 'low' | 'med' | 'high';
export type Category = 'border' | 'desert' | 'wind' | 'hydro' | 'flood' | 'tribal' | 'island' | 'demand';

export interface District {
  id: string;
  name: string;
  state: string;
  category: Category;
  lat: number;
  lon: number;
  population_est: number;
  demand_mwh_yr_est: number;
  /** kWh/m²/day, Jan..Dec */
  ghi_monthly: number[];
  /** m/s at 50 m, Jan..Dec */
  wind50m_monthly: number[];
  small_hydro_potential: Tier;
  biomass_potential: Tier;
  geothermal_potential: 'none' | 'potential';
  grid_access: 'good' | 'weak' | 'offgrid';
  diesel_dependence: 'low' | 'med' | 'high';
  hydro_regime?: 'snowmelt' | 'monsoon';
  sources: Record<string, string>;
  illustrative: boolean;
}

export type HomeTier = 'basic' | 'standard' | 'high';

export interface DemandInputs {
  homes: number;
  homeTier: HomeTier;
  clinic: boolean;
  clinicKwh: number;
  clinicCritical: boolean;
  school: boolean;
  schoolKwh: number;
  pumps: number;
  pumpHp: number;
  pumpHours: number;
  streetlights: number;
  streetlightW: number;
  otherKwh: number;
}

export interface Scenario {
  /** % per year */
  demandGrowthPct: number;
  /** ₹/litre */
  dieselPrice: number;
  /** ₹/kWh for the selected chemistry */
  batteryCost: number;
  /** consecutive low-sun days, 1–5 */
  stormDays: number;
  /** % reduction of dry-month hydro flow, 0–60 */
  hydroFlowReductionPct: number;
}

export type Chemistry = 'lfp' | 'leadacid';
export type OptionId = 'solar' | 'solar_hydro' | 'solar_wind' | 'solar_diesel';
export const OPTION_IDS: OptionId[] = ['solar', 'solar_hydro', 'solar_wind', 'solar_diesel'];

/** Flat numeric cost parameters (values from costs.json items). */
export type CostParams = Record<string, number>;

export type LoadKind = 'homes' | 'clinic' | 'school' | 'pumps' | 'streetlights' | 'other';

export interface LoadItem {
  kind: LoadKind;
  kwhDay: number;
  critical: boolean;
  /** 24 hourly fractions summing to 1 */
  profile: number[];
  count: number;
}

export interface DemandResult {
  loads: LoadItem[];
  totalKwhDay: number;
  peakKw: number;
  /** kWh in each hour of a typical day */
  hourly: number[];
  nightKwhDay: number;
  criticalKwhDay: number;
}

export interface SystemSpec {
  pvKwp: number;
  /** nameplate kWh */
  batteryKwh: number;
  windKw: number;
  hydroKw: number;
  dieselKva: number;
  chemistry: Chemistry;
}

export interface MonthResult {
  demand: number;
  served: number;
  unmet: number;
  pv: number;
  wind: number;
  hydro: number;
  diesel: number;
  curtailed: number;
  batteryOut: number;
  reliability: number;
}

export interface SimResult {
  months: MonthResult[];
  worstMonth: number;
  worstReliability: number;
  annualDemand: number;
  annualServed: number;
  annualDiesel: number;
  annualPv: number;
  annualWind: number;
  annualHydro: number;
  annualCurtailed: number;
  dieselLitres: number;
}

export interface OptionDesign {
  id: OptionId;
  available: boolean;
  /** i18n key explaining why unavailable */
  reasonKey?: string;
  spec: SystemSpec;
  sim: SimResult;
  meetsTarget: boolean;
  iterations: number;
}
