import { Router } from 'express';

export const health = Router();

health.get('/', (_req, res) => {
  res.json({ ok: true, service: 'india-energy-planner', time: new Date().toISOString(), ai: Boolean(process.env.ANTHROPIC_API_KEY) });
});
