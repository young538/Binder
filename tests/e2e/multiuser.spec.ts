import { test, expect } from '@playwright/test';
import { loginAs, ensureUserExists } from './_helpers';

test.describe('multi-user isolation', () => {
  test.beforeAll(async () => {
    await ensureUserExists('userA', 'passwordA1*');
    await ensureUserExists('userB', 'passwordB1*');
  });

  test('userA cannot see userB todos', async ({ browser }) => {
    const TODO_A = 'A의 할일 격리테스트';
    const TODO_B = 'B의 할일 격리테스트';
    // After save, an existing todo title is rendered as a non-placeholder
    // <input> with the title as its value (see TodoListSection.tsx). The
    // "add" input has placeholder="할 일", so we filter that out to avoid
    // a brief race where the still-mounted add input also has the same
    // value before React re-renders.
    const savedTodoInput = (text: string) =>
      `input[type="text"][value="${text}"]:not([placeholder])`;

    // Saves a weekly todo. Waits for the "add" input to unmount (i.e. the
    // 추가 button to reappear) before returning so callers can assert against
    // the saved todo without racing the controlled input clearing.
    const addWeeklyTodo = async (page: import('@playwright/test').Page, text: string) => {
      const addBtn = page.getByRole('button', { name: '추가' }).first();
      await addBtn.click();
      const input = page.getByPlaceholder('할 일');
      await input.fill(text);
      await input.press('Enter');
      // After Enter, add() in TodoListSection sets draft='' + adding=false,
      // which unmounts the input and re-renders the 추가 button.
      await expect(page.getByPlaceholder('할 일')).toHaveCount(0, { timeout: 10000 });
    };

    // --- userA: log in and add a weekly todo
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await loginAs(pageA, 'userA', 'passwordA1*');
    // Login redirects to '/' → /week/<isoweek>; wait for the loading state to clear.
    await pageA.waitForURL(/\/week\//);
    await expect(pageA.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
    await addWeeklyTodo(pageA, TODO_A);
    await expect(pageA.locator(savedTodoInput(TODO_A))).toBeVisible({ timeout: 10000 });

    // --- userB: separate browser context → separate cookies → fresh session
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await loginAs(pageB, 'userB', 'passwordB1*');
    await pageB.waitForURL(/\/week\//);
    await expect(pageB.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });

    // userB lands on the same ISO week as userA — userA's todo MUST NOT appear.
    await expect(pageB.locator(savedTodoInput(TODO_A))).toHaveCount(0);

    // Sanity: userB can create their own todo without leaking to userA either.
    await addWeeklyTodo(pageB, TODO_B);
    await expect(pageB.locator(savedTodoInput(TODO_B))).toBeVisible({ timeout: 10000 });
    await expect(pageB.locator(savedTodoInput(TODO_A))).toHaveCount(0);

    // Reload userA — should still only see A's todo, never B's.
    await pageA.reload();
    await expect(pageA.getByText('로딩 중…')).toHaveCount(0, { timeout: 60000 });
    await expect(pageA.locator(savedTodoInput(TODO_A))).toBeVisible({ timeout: 10000 });
    await expect(pageA.locator(savedTodoInput(TODO_B))).toHaveCount(0);

    await ctxA.close();
    await ctxB.close();
  });
});
