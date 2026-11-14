import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toParams, type CostsFile } from '../engine/costs';
import type { CostParams, District } from '../engine/types';
import { useAppStore } from '../store/useAppStore';

const cache = new Map<string, Promise<unknown>>();

/** Fetches a JSON file from /data once and caches the promise (offline-friendly with the PWA cache). */
export function loadJson<T>(file: string): Promise<T> {
  if (!cache.has(file)) {
    const p = fetch(`/data/${file}`).then((r) => {
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return cache.get(file) as Promise<T>;
}

interface DataState {
  districts: District[];
  costsFile: CostsFile | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const DataCtx = createContext<DataState>({ districts: [], costsFile: null, loading: true, error: null, retry: () => {} });

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<DataState, 'retry'>>({ districts: [], costsFile: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    Promise.all([loadJson<District[]>('districts.json'), loadJson<CostsFile>('costs.json')])
      .then(([districts, costsFile]) => alive && setState({ districts, costsFile, loading: false, error: null }))
      .catch((e: Error) => alive && setState((s) => ({ ...s, loading: false, error: e.message })));
    return () => {
      alive = false;
    };
  }, [attempt]);
  const value = useMemo(() => ({ ...state, retry: () => setAttempt((a) => a + 1) }), [state]);
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>;
}

export const useData = () => useContext(DataCtx);

export function useDistrict(id?: string | null): District | null {
  const { districts } = useData();
  const selected = useAppStore((s) => s.selectedDistrictId);
  const key = id === undefined ? selected : id;
  return useMemo(() => districts.find((d) => d.id === key) ?? null, [districts, key]);
}

/** Cost parameters with slider overrides applied. */
export function useCostParams(): CostParams | null {
  const { costsFile } = useData();
  const overrides = useAppStore((s) => s.costOverrides);
  return useMemo(() => (costsFile ? toParams(costsFile, overrides) : null), [costsFile, overrides]);
}
