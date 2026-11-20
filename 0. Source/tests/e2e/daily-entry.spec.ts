import { expect, test } from '@playwright/test';
import { ensureUserExists, loginAs } from './_helpers';

test.use({ timezoneId: 'Asia/Seoul' });

for (const width of [1280, 390]) {
  test(`today entry, midnight tab navigation and expanded records (${width}px)`, async ({ page }) => {
    const username = `e2e-daily-entry-${width}`;
    await ensureUserExists(username, 'pwTest123*');
    await page.setViewportSize({ width, height: 950 });
    // UTC is still September 9. Entry must use the browser's September 10.
    await page.clock.setFixedTime(new Date('2026-09-09T16:30:00Z'));
    await loginAs(page, username, 'pwTest123*');
    await expect(page).toHaveURL(/\/daily\/2026-09-10$/);
    await expect(page.getByLabel('일일 메모')).toHaveCount(0);
    await expect(page.getByLabel('읽은 쪽수', { exact: true })).toBeVisible();
    const record = page.getByRole('region', { name: '하루 기록', exact: true });
    await expect(record.getByRole('textbox', { name: '✓ 좋았던 것', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '일일 회고 열기' })).toHaveCount(0);

    const memo = `오늘의 생각
일을 마무리한 뒤 기록을 남기니 하루 동안 배운 것이 더 또렷하게 보인다. 바쁘게 지나간 순간도 글로 적으면 의미를 발견할 수 있다.

내일 챙길 것
아침에 가장 중요한 일을 먼저 정하고, 저녁에는 오늘보다 조금 더 여유롭게 돌아보기. ${Date.now()}`;
    const good = `미뤄 두었던 일을 끝내고 독서 시간을 지켰다.

짧게라도 집중하는 시간을 만든 덕분에 기분 좋게 하루를 마무리할 수 있었다. ${Date.now()}`;
    const reading = `기억할 문장 · p.42
작게 시작하고 꾸준히 이어 가는 것이 중요하다.

나의 생각
오늘은 완벽한 계획을 세우기보다 책을 펴고 한 페이지를 읽는 것으로 시작했다. 짧은 기록도 쌓이면 내가 무엇을 배웠는지 돌아볼 수 있다.

내일 해 볼 일
아침에 10쪽을 읽고 기억하고 싶은 문장 하나를 적어 두기. ${Date.now()}`;
    const readingNote = page.getByRole('textbox', { name: '독서 노트', exact: true });
    await readingNote.fill(Array(10).fill(reading).join('\n\n'));
    await expect.poll(() => readingNote.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
    for (const field of ['✓ 좋았던 것', '✍️ 자유 메모']) {
      const input = record.getByRole('textbox', { name: field, exact: true });
      await input.fill(Array(12).fill(good).join('\n\n'));
      await expect.poll(() => input.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
    }
    await record.getByRole('textbox', { name: '✍️ 자유 메모', exact: true }).fill(memo);
    await page.getByLabel('독서 노트', { exact: true }).fill(reading);
    await record.getByRole('textbox', { name: '✓ 좋았던 것', exact: true }).fill(good);
    await expect.poll(async () => {
      const response = await page.request.get('/api/retrospectives?type=daily&dateOrWeek=2026-09-10');
      const saved = await response.json();
      return { good: saved?.template?.good, reading: JSON.parse(saved?.template?.reading ?? '{}').memo };
    }).toEqual({ good, reading });
    await expect.poll(async () => (await (await page.request.get('/api/retrospectives?type=daily&dateOrWeek=2026-09-10')).json())?.freeText).toBe(memo);

    await page.reload();
    await expect(record.getByRole('textbox', { name: '✍️ 자유 메모', exact: true })).toHaveValue(memo);
    await expect(record.getByRole('textbox', { name: '✓ 좋았던 것', exact: true })).toHaveValue(good);
    await expect(page.getByLabel('독서 노트', { exact: true })).toHaveValue(reading);

    await expect.poll(() => record.locator('textarea').evaluateAll(inputs => inputs.every(input => input.scrollHeight <= input.clientHeight + 2))).toBe(true);
    await record.screenshot({ path: `test-results/daily-record-readable-${width}.png` });
    await page.screenshot({ path: `test-results/daily-reading-focus-${width}.png`, fullPage: true });

    // An explicit historical date remains accessible.
    await page.goto('/daily/2026-09-07');
    await expect(page).toHaveURL(/\/daily\/2026-09-07$/);
    await page.clock.setFixedTime(new Date('2026-09-10T16:30:00Z'));
    await page.locator('nav:visible').getByRole('link', { name: '일일', exact: true }).click();
    await expect(page).toHaveURL(/\/daily\/2026-09-11$/);
    await expect(record.getByRole('textbox', { name: '✍️ 자유 메모', exact: true })).not.toHaveValue(memo);
    await page.goto('/daily');
    await expect(page).toHaveURL(/\/daily\/2026-09-11$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/daily\/2026-09-11$/);
    await expect(page.getByLabel('읽은 쪽수', { exact: true })).toBeVisible();
    await expect(record.getByRole('textbox', { name: '✓ 좋았던 것', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/daily-expanded-${width}.png`, fullPage: true });
  });
}
