import Database from 'better-sqlite3';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.DB_PATH ?? resolve(here, '../data.sqlite');

export const COMPLAINT_TYPES = ['outage', 'low_voltage', 'fluctuation', 'sparking', 'streetlight', 'billing', 'other'] as const;
export const STATUSES = ['logged', 'routed', 'acknowledged', 'resolved'] as const;

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    details TEXT NOT NULL,
    contact TEXT,
    status TEXT NOT NULL DEFAULT 'logged',
    sample INTEGER NOT NULL DEFAULT 0,
    client_id TEXT UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_c_district ON complaints(district);
`);

export interface ComplaintRow {
  id: string;
  type: string;
  state: string;
  district: string;
  details: string;
  contact: string | null;
  status: string;
  sample: number;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Ticket IDs like IEP-7K3Q9X (no ambiguous characters). */
export function ticketId(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  return `IEP-${s}`;
}

/** Public shape: never includes contact details. */
export const toPublic = (r: ComplaintRow) => ({
  ticketId: r.id,
  type: r.type,
  state: r.state,
  district: r.district,
  details: r.details,
  status: r.status,
  sample: !!r.sample,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
