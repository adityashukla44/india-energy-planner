import { defineConfig, devices } from '@playwright/test';

const PORT = 8791;
// Uses the installed Google Chrome. Set PW_BUNDLED=1 to use Playwright's own Chromium (`npx playwright install chromium`).
const channel = process.env.PW_BUNDLED ? undefined : 'chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel } },
  ],
  // Smoke tests run against the production build (service worker included), served by the API server.
  webServer: {
    command: `npm run build -w client && PORT=${PORT} DB_PATH=./server/e2e.sqlite npx tsx server/src/index.ts`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
