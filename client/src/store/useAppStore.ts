import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { DEFAULT_DEMAND } from '../engine/demand';
import { DEFAULT_SCENARIO } from '../engine/plan';
import type { RolloutInputs } from '../engine/rollout';
import type { Chemistry, CostParams, DemandInputs, OptionId, Scenario } from '../engine/types';

export type Theme = 'dark' | 'light';
export type Lang = 'en' | 'hi' | 'ta' | 'bn';
export type MapLayer = 'best' | 'impact' | 'solar' | 'wind' | 'demand';

/** localStorage wrapped in try/catch, with an in-memory fallback (private mode, blocked storage). */
const memory = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
};

export function applyTheme(t: Theme) {
  try {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#09080E' : '#F7F5FB');
  } catch {
    /* non-browser */
  }
}

const nextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const DEFAULT_ROLLOUT: RolloutInputs = {
  startMonth: nextMonth(),
  monthsAvailable: 12,
  monthlyBudget: 2500000,
  homesPerBatch: 25,
};

export interface AppState {
  theme: Theme;
  language: Lang;
  selectedDistrictId: string | null;
  demand: DemandInputs;
  scenario: Scenario;
  chemistry: Chemistry;
  costOverrides: Partial<CostParams>;
  /** null = follow the recommendation */
  selectedOption: OptionId | null;
  rollout: RolloutInputs;
  mapLayer: MapLayer;
  prefer2D: boolean;
  setTheme: (t: Theme) => void;
  setLanguage: (l: Lang) => void;
  selectDistrict: (id: string | null) => void;
  setDemand: (patch: Partial<DemandInputs>) => void;
  resetDemand: () => void;
  setScenario: (patch: Partial<Scenario>) => void;
  resetScenario: () => void;
  setChemistry: (c: Chemistry, defaultCost: number) => void;
  setCostOverride: (key: string, value: number | undefined) => void;
  setSelectedOption: (o: OptionId | null) => void;
  setRollout: (patch: Partial<RolloutInputs>) => void;
  setMapLayer: (l: MapLayer) => void;
  setPrefer2D: (v: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'en',
      selectedDistrictId: null,
      demand: DEFAULT_DEMAND,
      scenario: DEFAULT_SCENARIO,
      chemistry: 'lfp',
      costOverrides: {},
      selectedOption: null,
      rollout: DEFAULT_ROLLOUT,
      mapLayer: 'best',
      prefer2D: false,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setLanguage: (language) => set({ language }),
      selectDistrict: (selectedDistrictId) => set({ selectedDistrictId, selectedOption: null }),
      setDemand: (patch) => set((s) => ({ demand: { ...s.demand, ...patch } })),
      resetDemand: () => set({ demand: DEFAULT_DEMAND }),
      setScenario: (patch) => set((s) => ({ scenario: { ...s.scenario, ...patch } })),
      resetScenario: () => set((s) => ({ scenario: { ...DEFAULT_SCENARIO, batteryCost: s.chemistry === 'lfp' ? DEFAULT_SCENARIO.batteryCost : 11000 } })),
      setChemistry: (chemistry, defaultCost) => set((s) => ({ chemistry, scenario: { ...s.scenario, batteryCost: defaultCost } })),
      setCostOverride: (key, value) =>
        set((s) => {
          const next = { ...s.costOverrides };
          if (value === undefined) delete next[key];
          else next[key] = value;
          return { costOverrides: next };
        }),
      setSelectedOption: (selectedOption) => set({ selectedOption }),
      setRollout: (patch) => set((s) => ({ rollout: { ...s.rollout, ...patch } })),
      setMapLayer: (mapLayer) => set({ mapLayer }),
      setPrefer2D: (prefer2D) => set({ prefer2D }),
    }),
    {
      name: 'iep-store',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        theme: s.theme,
        language: s.language,
        selectedDistrictId: s.selectedDistrictId,
        demand: s.demand,
        scenario: s.scenario,
        chemistry: s.chemistry,
        costOverrides: s.costOverrides,
        selectedOption: s.selectedOption,
        rollout: s.rollout,
        mapLayer: s.mapLayer,
        prefer2D: s.prefer2D,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          demand: { ...current.demand, ...(p.demand ?? {}) },
          scenario: { ...current.scenario, ...(p.scenario ?? {}) },
          rollout: { ...current.rollout, ...(p.rollout ?? {}) },
        };
      },
    },
  ),
);
