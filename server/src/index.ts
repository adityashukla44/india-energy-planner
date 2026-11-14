import './env.js';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from './routes/chat.js';
import { complaints } from './routes/complaints.js';
import { health } from './routes/health.js';
import { seedSamplesIfEmpty } from './samples.js';

const here = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'worker-src': ["'self'", 'blob:'],
        'connect-src': ["'self'"],
      },
    },
  }),
);
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }));
app.use(express.json({ limit: '128kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

app.use('/api/health', health);
app.use('/api/complaints', complaints);
app.use('/api/chat', chat);

// Production: serve the built client (PWA) with SPA fallback.
const dist = resolve(here, '../../client/dist');
if (existsSync(dist)) {
  app.use(
    express.static(dist, {
      index: false,
      maxAge: '1h',
      setHeaders: (res, file) => {
        // The service worker and manifest must revalidate so updates reach users promptly.
        if (/(sw\.js|registerSW\.js|manifest\.webmanifest|index\.html)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')));
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

const seeded = seedSamplesIfEmpty();
if (seeded) console.log(`Fresh database: loaded ${seeded} sample complaints.`);

// Behind a host's proxy (Render, Railway, Fly), trust it so rate limiting sees real client IPs.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.listen(PORT, '0.0.0.0', () => console.log(`Listening on port ${PORT}`));
