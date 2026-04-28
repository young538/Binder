import { test, expect } from '@playwright/test';
import { ensureUserExists, loginAs, resetDb } from './_helpers';

// Each spec uses its own user so test data on the server-side SQLite DB
// does not leak between tests in the same suite (each user's todos and
// time blocks are scoped to that user_id).
test.beforeAll(async () => {
  await ensureUserExists('e2e-week-input', 'pwTest123*');
});

test('create, edit, delete time block', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.waitForURL(/\/week\//);

  // Wait for store to be ready (loading screen to disappear)
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  // First empty time slot in the grid
  const firstCell = page.locator('[data-testid="time-slot"]').first();
  await firstCell.click();

  const textInput = page.getByPlaceholder('내용');
  await textInput.fill('E2E 블록');
  await page.getByRole('button', { name: '저장' }).click();

  await expect(page.getByText('E2E 블록').first()).toBeVisible();

  // Edit
  await page.getByText('E2E 블록').first().click();
  await textInput.fill('수정됨');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('수정됨').first()).toBeVisible();

  // Delete (confirm dialog auto-accept)
  page.on('dialog', (d) => d.accept());
  await page.getByText('수정됨').first().click();
  await page.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('수정됨')).toHaveCount(0);
});

test('drag across multiple slots opens BlockEditor with that range', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  const slots = page.locator('[data-testid="time-slot"][data-row]');
  await expect(slots.first()).toBeVisible();

  // Pick the first sub-column's first three rows. Slots are rendered in
  // sub-column order, so nth(0)..nth(2) are guaranteed to share the same
  // sub-column (which holds setPointerCapture). gridMinutes=30 default ⇒
  // a 3-row drag spans 90 minutes.
  const start = slots.nth(0);
  const end = slots.nth(2);

  const startBox = (await start.boundingBox())!;
  const endBox = (await end.boundingBox())!;

  // Pointer Events: down inside sub-column, move within capture, then up.
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 10 });
  await page.mouse.up();

  // BlockEditor opens
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toBeVisible();

  // Verify time inputs span > 1 slot.
  const timeInputs = page.locator('input[type=time]');
  const startVal = await timeInputs.nth(0).inputValue();
  const endVal = await timeInputs.nth(1).inputValue();
  expect(startVal).not.toEqual(endVal);

  // Parse HH:MM and assert the dragged range is at least 60 minutes
  // (3 rows × 30min = 90; allow ≥ 60 to keep the test resilient if the
  // default gridMinutes ever changes to 20).
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  expect(toMin(endVal) - toMin(startVal)).toBeGreaterThanOrEqual(60);
});

test('single click still opens BlockEditor with one-slot range (fallback)', async ({ page }) => {
  await resetDb(page);
  await loginAs(page, 'e2e-week-input', 'pwTest123*');
  await page.waitForURL(/\/week\//);
  await expect(page.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

  const slot = page.locator('[data-testid="time-slot"][data-row]').first();
  await slot.click();
  await expect(page.getByRole('heading', { name: /블록 추가/ })).toBeVisible();
});
