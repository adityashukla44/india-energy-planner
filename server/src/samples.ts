import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, ticketId } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(here, '../../client/public/data/sample-complaints.json');

/** Replaces the sample complaints (marked sample=1) with the bundled set. Real complaints are untouched. */
export function seedSamples(): number {
  const samples = JSON.parse(readFileSync(FILE, 'utf8')) as { type: string; state: string; district: string; details: string; status: string; createdAt: string }[];
  const ins = db.prepare(
    `INSERT INTO complaints (id, type, state, district, details, contact, status, sample, client_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, 1, NULL, ?, ?)`,
  );
  db.transaction(() => {
    db.prepare('DELETE FROM complaints WHERE sample = 1').run();
    for (const s of samples) ins.run(ticketId(), s.type, s.state, s.district, `[Sample] ${s.details}`, s.status, s.createdAt, s.createdAt);
  })();
  return samples.length;
}

/** On a fresh database (e.g. a new deploy), load the samples so the heatmap isn't empty. */
export function seedSamplesIfEmpty(): number {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM complaints').get() as { n: number };
  return n === 0 ? seedSamples() : 0;
}
