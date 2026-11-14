/**
 * Replaces illustrative solar/wind values in client/public/data/districts.json with NASA POWER climatology.
 *
 * 1. For each district, download a monthly climatology CSV from the NASA POWER Data Access Viewer
 *    (https://power.larc.nasa.gov/data-access-viewer/): Single point, Climatology, parameters
 *    ALLSKY_SFC_SW_DWN (kWh/m²/day) and WS50M (m/s), using the district's lat/lon.
 * 2. Save it as data-raw/<district-id>.csv (e.g. data-raw/leh.csv).
 * 3. Run: npm run import:nasa
 *
 * Districts with a CSV get real ghi_monthly / wind50m_monthly and illustrative:false. Others are untouched.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = resolve(root, 'data-raw');
const file = resolve(root, 'client/public/data/districts.json');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Parses a NASA POWER climatology CSV (header block ends with -END HEADER-). */
export function parsePowerCsv(text: string): Record<string, number[]> {
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex((l) => l.includes('-END HEADER-'));
  const body = lines.slice(end + 1).filter((l) => l.trim());
  const header = body[0].split(',').map((h) => h.trim().toUpperCase());
  const out: Record<string, number[]> = {};
  for (const row of body.slice(1)) {
    const cells = row.split(',').map((c) => c.trim());
    const param = cells[header.indexOf('PARAMETER')];
    const vals = MONTHS.map((m) => Number(cells[header.indexOf(m)]));
    if (param && vals.every((v) => Number.isFinite(v) && v > -900)) out[param.toUpperCase()] = vals.map((v) => Math.round(v * 100) / 100);
  }
  return out;
}

const districts = JSON.parse(readFileSync(file, 'utf8')) as { id: string; ghi_monthly: number[]; wind50m_monthly: number[]; illustrative: boolean; sources: Record<string, string> }[];
const csvs = existsSync(rawDir) ? readdirSync(rawDir).filter((f) => f.endsWith('.csv')) : [];
let updated = 0;
for (const f of csvs) {
  const id = f.replace(/\.csv$/, '');
  const d = districts.find((x) => x.id === id);
  if (!d) {
    console.warn(`skip ${f}: no district with id "${id}"`);
    continue;
  }
  const p = parsePowerCsv(readFileSync(resolve(rawDir, f), 'utf8'));
  if (!p.ALLSKY_SFC_SW_DWN || !p.WS50M) {
    console.warn(`skip ${f}: needs ALLSKY_SFC_SW_DWN and WS50M rows`);
    continue;
  }
  d.ghi_monthly = p.ALLSKY_SFC_SW_DWN;
  d.wind50m_monthly = p.WS50M;
  d.illustrative = false;
  d.sources.ghi = 'NASA POWER climatology, ALLSKY_SFC_SW_DWN';
  d.sources.wind = 'NASA POWER climatology, WS50M';
  updated++;
}
writeFileSync(file, JSON.stringify(districts, null, 2) + '\n');
console.log(`Updated ${updated} of ${districts.length} districts from ${csvs.length} CSV file(s).`);
