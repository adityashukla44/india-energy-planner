import { expect, test, type Page } from '@playwright/test';

const PAGES = ['/', '/map', '/planner', '/costs', '/rollout', '/impact', '/subsidies', '/help', '/complaints', '/heatmap', '/data'];

/** Console errors that come from headless WebGL, not from the app. */
const IGNORED = [/WebGL/i, /GPU stall/i, /THREE\.WebGLRenderer/i, /favicon/i];

async function withDistrict(page: Page, lang = 'en') {
  await page.addInitScript((l) => {
    try {
      if (!localStorage.getItem('iep-store'))
        localStorage.setItem('iep-store', JSON.stringify({ state: { selectedDistrictId: 'jaisalmer', language: l }, version: 1 }));
    } catch {
      /* ignore */
    }
  }, lang);
}

for (const path of PAGES) {
  test(`${path} renders without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !IGNORED.some((r) => r.test(m.text())) && errors.push(m.text()));
    await withDistrict(page);
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeAttached();
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'no horizontal page scroll').toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('every language switches the interface', async ({ page }) => {
  await withDistrict(page);
  await page.goto('/planner');
  const heading = page.locator('h1').first();
  await expect(heading).toContainText('system design');
  for (const [code, word] of [['hi', 'सिस्टम'], ['ta', 'வடிவமைப்பு'], ['bn', 'নকশা']] as const) {
    await page.evaluate((c) => {
      const s = JSON.parse(localStorage.getItem('iep-store')!);
      s.state.language = c;
      localStorage.setItem('iep-store', JSON.stringify(s));
    }, code);
    await page.reload();
    await expect(heading).toContainText(word);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(code);
  }
});

test('a complaint gets a ticket ID and appears in the list', async ({ page }) => {
  await withDistrict(page);
  await page.goto('/complaints');
  await page.getByLabel('What\'s happening?').fill('Smoke test: no power on the main road since 9 am.');
  await page.getByRole('button', { name: 'Submit complaint' }).click();
  await expect(page.getByText(/Ticket IEP-[A-Z0-9]{6}/)).toBeVisible();
  await expect(page.getByText(/^IEP-[A-Z0-9]{6}$/).first()).toBeVisible();
});

test('the assistant falls back to FAQ answers without an API key', async ({ page }) => {
  await withDistrict(page);
  await page.goto('/help');
  await page.getByLabel('Ask a question…').fill('How much subsidy can a 3 kW home get?');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('How much subsidy does PM Surya Ghar give?').last()).toBeVisible();
});

test.describe('offline', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'service worker test runs in Chromium');
  test('works offline after the first visit, and queues complaints', async ({ page, context }) => {
    await withDistrict(page);
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // now controlled by the service worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.goto('/costs');
    await expect(page.locator('h1').first()).toContainText('20-year costs');
    await page.goto('/complaints');
    await page.getByLabel('What\'s happening?').fill('Offline smoke test: voltage very low.');
    await page.getByRole('button', { name: 'Submit complaint' }).click();
    await expect(page.getByText('Waiting to send')).toBeVisible();

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.getByText('Waiting to send')).toBeHidden({ timeout: 15_000 });
  });
});
