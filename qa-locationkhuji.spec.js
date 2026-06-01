const { test, expect } = require('playwright/test');

async function gotoMap(page, path = '/map') {
  await page.goto('http://localhost:3000/login?next=/map', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('demo-user').click();
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/map/, { timeout: 15000 });
  await page.waitForFunction(() => window.localStorage.getItem('lk_auth')?.includes('dev-test-token'), null, { timeout: 10000 });
  if (path !== '/map') {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: 'domcontentloaded' });
  }
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
}

test.describe('LocationKhuji QA smoke and functional checks', () => {
  test('home page loads and empty hero search does not navigate', async ({ page }) => {
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Location').first()).toBeVisible();
    await page.locator('form').first().locator('button[type="submit"]').click();
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('map route redirects unauthenticated users', async ({ page }) => {
    await page.goto('http://localhost:3000/map', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login\?next=\/map/);
  });

  test('authenticated map loads with default radius shown', async ({ page }) => {
    await gotoMap(page);
    await expect(page.getByText(/1 km/).first()).toBeVisible();
  });

  test('AI search button executes search and map click confirmation appears', async ({ page }) => {
    await gotoMap(page);
    await page.getByRole('button', { name: /AI Search/i }).click();
    const input = page.getByRole('textbox', { name: /Ask AI|Search area/i });
    await input.fill('pharmacy in mirpur 10');
    const responsePromise = page.waitForResponse((res) => res.url().includes('/api/listings/ai-search') && res.request().method() === 'POST');
    await page.locator('aside form').locator('button[type="submit"]').click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(page.getByText(/1 km/).first()).toBeVisible({ timeout: 15000 });

    const mapBox = await page.locator('.leaflet-container').boundingBox();
    expect(mapBox).toBeTruthy();
    await page.mouse.click(mapBox.x + 80, mapBox.y + mapBox.height - 120);
    await expect(page.getByText(/Search here instead/i)).toBeVisible({ timeout: 5000 });
  });

  test('mobile, tablet, and desktop map layouts render without console page errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoMap(page);
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    }
    expect(errors).toEqual([]);
  });
});
