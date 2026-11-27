import { expect, test } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

for (const width of [390, 1280]) {
  test(`injection journal saves, edits, graphs and restores remaining inventory at ${width}px`, async ({ page }) => {
    const user = 'e2e-injections-' + width;
    await ensureUserExists(user, 'pwTest123*');
    await page.setViewportSize({ width, height: 840 });
    await loginAs(page, user, 'pwTest123*');
    await page.goto('/injections');
    await page.getByRole('button', { name: '펜 등록' }).click();
    await page.getByRole('combobox', { name: '약물', exact: true }).selectOption('tirzepatide');
    await page.getByLabel('펜 이름').fill('연습용 기록');
    await page.getByLabel('펜 한 개의 표시 총량 (mg)').fill('5');
    await page.getByRole('button', { name: '저장' }).click();
    const card = page.getByRole('article', { name: '연습용 기록' });
    await card.getByRole('button', { name: '투여 기록 추가' }).click();
    await page.getByRole('spinbutton', { name: '실제 투여량 (mg)', exact: true }).fill('0.125');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(card).toContainText('4.875 mg');
    await page.reload();
    await expect(card).toContainText('4.875 mg');
    await page.getByLabel('그래프 약물').selectOption('tirzepatide');
    await expect(page.getByRole('img', { name: /마운자로 반감기/ })).toBeVisible();
    await page.getByLabel('그래프 종류').selectOption('amount');
    await expect(page.getByRole('img', { name: /마운자로 회차별/ })).toBeVisible();
    await page.getByRole('button', { name: /투여 기록 수정$/ }).click();
    await page.getByRole('spinbutton', { name: '실제 투여량 (mg)', exact: true }).fill('0.25');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(card).toContainText('4.75 mg');
    const journal = await (await page.request.get('/api/injections')).json();
    expect(journal.entries).toHaveLength(1);
    expect(journal.entries[0].amountMcg).toBe(250);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /투여 기록 수정$/ }).click();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(card).toContainText('기록상 잔량 5 mg');
    await expect(page.getByText('아직 기록한 주사가 없어요.')).toBeVisible();
  });
}
