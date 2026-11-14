import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const load = (l: string) => JSON.parse(readFileSync(new URL(`../../i18n/${l}.json`, import.meta.url), 'utf8'));
const flat = (o: Record<string, unknown>, p = ''): Record<string, string> =>
  Object.entries(o).reduce((acc, [k, v]) => {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(acc, flat(v as Record<string, unknown>, key));
    else acc[key] = JSON.stringify(v);
    return acc;
  }, {} as Record<string, string>);
const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');
const en = flat(load('en'));
// Long technical Data & Assumptions paragraphs and source titles stay in English (i18next falls back).
const OPTIONAL = /^data\.(engine\.|extraSources|districtsBody|boundaryBody)/;

describe.each(['hi', 'ta', 'bn'])('%s translation', (lang) => {
  const tr = flat(load(lang));
  it('covers every English key', () => {
    const missing = Object.keys(en).filter((k) => !OPTIONAL.test(k) && !(k in tr));
    expect(missing).toEqual([]);
  });
  it('has no keys English lacks', () => {
    expect(Object.keys(tr).filter((k) => !(k in en))).toEqual([]);
  });
  it('keeps the same {{placeholders}}', () => {
    const bad = Object.keys(tr).filter((k) => vars(tr[k]) !== vars(en[k]));
    expect(bad).toEqual([]);
  });
});

describe('source code', () => {
  it('only uses i18n keys that exist in English', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const f = join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')) files.push(f);
      }
    };
    walk(root);
    const used = new Set<string>();
    for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
    const hasKey = (k: string) => k in en || `${k}_one` in en || Object.keys(en).some((x) => x.startsWith(`${k}.`));
    expect(used.size).toBeGreaterThan(200);
    expect([...used].filter((k) => !hasKey(k))).toEqual([]);
  });
});
