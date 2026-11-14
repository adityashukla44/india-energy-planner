import { readFileSync } from 'node:fs';
import { toParams, type CostsFile } from '../costs';
import type { District } from '../types';

export const districts: District[] = JSON.parse(readFileSync(new URL('../../../public/data/districts.json', import.meta.url), 'utf8'));
export const costsFile: CostsFile = JSON.parse(readFileSync(new URL('../../../public/data/costs.json', import.meta.url), 'utf8'));
export const costs = toParams(costsFile);
export const byName = (n: string) => {
  const d = districts.find((x) => x.name === n);
  if (!d) throw new Error(`missing ${n}`);
  return d;
};
