import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { COMPLAINT_TYPES, STATUSES, db, ticketId, toPublic, type ComplaintRow } from '../db.js';

export const complaints = Router();

const createSchema = z.object({
  type: z.enum(COMPLAINT_TYPES),
  state: z.string().trim().min(2).max(60),
  district: z.string().trim().min(2).max(60),
  details: z.string().trim().min(5).max(1000),
  contact: z.string().trim().max(120).optional().or(z.literal('')),
  clientId: z.string().trim().max(64).optional(),
});

const createLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });

complaints.post('/', createLimiter, (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  const c = parsed.data;
  // Offline queue retries send the same clientId: return the existing ticket instead of duplicating.
  if (c.clientId) {
    const existing = db.prepare('SELECT * FROM complaints WHERE client_id = ?').get(c.clientId) as ComplaintRow | undefined;
    if (existing) return res.status(200).json({ ticketId: existing.id, status: existing.status });
  }
  const now = new Date().toISOString();
  let id = ticketId();
  while (db.prepare('SELECT 1 FROM complaints WHERE id = ?').get(id)) id = ticketId();
  db.prepare(
    `INSERT INTO complaints (id, type, state, district, details, contact, status, sample, client_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'logged', 0, ?, ?, ?)`,
  ).run(id, c.type, c.state, c.district, c.details, c.contact || null, c.clientId ?? null, now, now);
  res.status(201).json({ ticketId: id, status: 'logged' });
});

const listSchema = z.object({
  state: z.string().max(60).optional(),
  district: z.string().max(60).optional(),
  type: z.enum(COMPLAINT_TYPES).optional(),
  ids: z.string().max(2000).optional(),
});

complaints.get('/', (req, res) => {
  const q = listSchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'invalid' });
  const where: string[] = [];
  const args: string[] = [];
  if (q.data.state) (where.push('state = ?'), args.push(q.data.state));
  if (q.data.district) (where.push('district = ?'), args.push(q.data.district));
  if (q.data.type) (where.push('type = ?'), args.push(q.data.type));
  if (q.data.ids) {
    const ids = q.data.ids.split(',').filter(Boolean).slice(0, 100);
    if (ids.length) {
      where.push(`id IN (${ids.map(() => '?').join(',')})`);
      args.push(...ids);
    }
  }
  const rows = db.prepare(`SELECT * FROM complaints ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`).all(...args) as ComplaintRow[];
  res.json(rows.map(toPublic));
});

complaints.get('/heatmap', (_req, res) => {
  const rows = db.prepare('SELECT district, type, COUNT(*) AS count, SUM(sample) AS samples FROM complaints GROUP BY district, type').all();
  res.json(rows);
});

const statusSchema = z.object({ status: z.enum(STATUSES) });

complaints.patch('/:id/status', (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  const auth = req.get('authorization') ?? '';
  if (!token || auth !== `Bearer ${token}`) return res.status(401).json({ error: 'unauthorized' });
  const p = statusSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'invalid' });
  const r = db.prepare('UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?').run(p.data.status, new Date().toISOString(), req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'not_found' });
  res.json({ ticketId: req.params.id, status: p.data.status });
});
