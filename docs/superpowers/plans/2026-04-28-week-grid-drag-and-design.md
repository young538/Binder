# 주간 그리드 드래그 + 디자인 정돈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/week/<isoweek>` 의 시간블록 입력을 클릭 단일 슬롯에서 드래그 범위 선택으로 확장하고, 계획/실제 블록의 시각 구분을 점선·실선 테두리로 강화하며, 컬럼·헤더·호버·시간라벨의 디자인 디테일을 정돈한다.

**Architecture:** 메인 변경 위치는 `components/week/WeekGrid.tsx` 한 파일. 드래그는 React Pointer Events (`onPointerDown` / `onPointerMove` / `onPointerUp`) 와 setPointerCapture 로 처리해 마우스/터치 통합. opacity-aware 색 유틸(`lib/utils/color.ts:tint.soft(hex, alpha?)`) 과 한국어 요일 유틸(`lib/utils/date.ts:WEEKDAYS_KO`) 을 작은 보조로 추가한다. BlockEditor 모달 자체는 그대로 두고, 드래그가 끝났을 때 `initial.startMin/endMin` 에 드래그 범위를 넣어 호출하기만 한다.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript 5 / Tailwind v4 / Vitest 4 / Playwright 1.59. lucide-react 아이콘 (📝 대신 `NotebookPen` 작은 아이콘으로 대체).

---

## 사전 결정 사항 (spec 에서 확정)

- 드래그 끝 → `BlockEditor` 모달 자동 오픈 (옵션 A).
- 계획 = 점선 테두리 + 옅은 채움(10%), 실제 = 실선 테두리 + 진한 채움(24%).
- 14 컬럼 (7일 × [계획 | 실제]) 구조 그대로 유지.

## 파일 변경 맵

**Modify**:
- `lib/utils/color.ts` — `tint.soft` 가 두 번째 인자(alpha) 를 옵션으로 받음. 기존 호출자(0.7) 동작 유지.
- `lib/utils/date.ts` — `WEEKDAYS_KO = ['월','화','수','목','금','토','일']` 상수 export.
- `components/week/WeekGrid.tsx` — 드래그 인터랙션 + 블록 디자인 + 헤더/컬럼/호버/시간라벨 디테일.
- `components/week/BlockEditor.tsx` — 헤더 안에 종류 토글의 이모지(`🗓️` / `✅`) 제거, "계획" / "실제" 텍스트만 (그리드의 신규 톤과 일치 시키기 위함). 그 외 변경 없음.
- `tests/e2e/week-input.spec.ts` — 드래그 케이스 추가, 기존 클릭 fallback 도 검증.
- `docs/RUNBOOK.md` — `9. 변경 이력` 한 줄 추가.

**Create**: 없음.

**Delete**: 없음.

---

## Task 1: 색·요일 유틸 보강

**Goal:** opacity-aware `tint.soft` 와 한국어 요일 상수를 추가한다. 기존 호출자 영향 없게 후방 호환.

**Files:**
- Modify: `lib/utils/color.ts`
- Modify: `lib/utils/date.ts`
- Test: `tests/unit/color.test.ts` (신규), `tests/unit/date.test.ts` (확장)

- [ ] **Step 1: tint 시그니처 테스트 (실패) 작성**

`tests/unit/color.test.ts` 신규:
```ts
import { describe, it, expect } from 'vitest';
import { tint } from '@/lib/utils/color';

describe('tint.soft', () => {
  it('defaults to 0.70 alpha when no second arg', () => {
    expect(tint.soft('#3366ff')).toBe('rgba(51,102,255,0.7)');
  });
  it('accepts custom alpha', () => {
    expect(tint.soft('#3366ff', 0.10)).toBe('rgba(51,102,255,0.1)');
    expect(tint.soft('#3366ff', 0.24)).toBe('rgba(51,102,255,0.24)');
  });
  it('falls back when hex is invalid', () => {
    expect(tint.soft('not-a-hex', 0.5)).toBe('rgba(161,161,170,0.5)');
  });
});
```

Run: `npm test -- tests/unit/color.test.ts` → FAIL (`tint.soft` 가 두 번째 인자 무시).

- [ ] **Step 2: `tint.soft` 시그니처 변경**

`lib/utils/color.ts:14` 한 줄 변경:
```ts
soft:   (hex: string, alpha = 0.70) => hexToRgba(hex, alpha),
```
나머지 줄 그대로.

Run: `npm test -- tests/unit/color.test.ts` → PASS (3/3).

- [ ] **Step 3: 한국어 요일 상수 추가 + 테스트**

`tests/unit/date.test.ts` 끝에 추가:
```ts
import { WEEKDAYS_KO } from '@/lib/utils/date';

describe('WEEKDAYS_KO', () => {
  it('starts with monday', () => {
    expect(WEEKDAYS_KO).toEqual(['월','화','수','목','금','토','일']);
  });
});
```

`lib/utils/date.ts` 끝에 추가:
```ts
export const WEEKDAYS_KO = ['월','화','수','목','금','토','일'] as const;
```

Run: `npm test` → 모두 PASS (이전 + 신규 4개).

- [ ] **Step 4: tsc 검증**

Run: `npx tsc --noEmit` → 0 errors. 기존 `tint.soft(color)` 호출자(WeekGrid 한 곳) 는 default alpha 0.70 으로 그대로 동작.

- [ ] **Step 5: Commit**

```bash
git add lib/utils/color.ts lib/utils/date.ts tests/unit/color.test.ts tests/unit/date.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): opacity-aware tint.soft + Korean weekday constant

tint.soft(hex, alpha?) now accepts an optional alpha; default 0.70
preserves all existing callers. WEEKDAYS_KO is a 7-tuple starting
Monday, used by the upcoming WeekGrid header redesign.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 드래그 인터랙션 (Pointer Events)

**Goal:** 빈 슬롯에서 pointer drag 로 시간 범위 선택 → 떼면 BlockEditor 가 그 범위로 열린다. 단순 클릭(드래그 0) 은 1-슬롯 모달 (현재 동작) 유지.

**Files:**
- Modify: `components/week/WeekGrid.tsx`

- [ ] **Step 1: 드래그 상태 정의 추가**

`WeekGrid.tsx` 의 `EditorState` 다음에:
```ts
interface DragState {
  date: string;
  kind: TimeBlockKind;
  startRow: number;
  currentRow: number;
}
```

`useState` 줄에 추가:
```ts
const [drag, setDrag] = useState<DragState | null>(null);
```

- [ ] **Step 2: 빈 슬롯 컨테이너 핸들러 분리**

현재(`WeekGrid.tsx:222-238`) 각 row 가 `<button onClick={...}>` 로 직접 모달 오픈. 이 모델을 버리고:
- 각 sub-column 의 `<div>` 컨테이너에 `onPointerDown` 등록.
- 각 row 는 시각만 (border-top, height) — `<button>` 은 `<div data-testid="time-slot" data-row={row}>` 로 변경.

Sub-column 의 `<div>` 부분:
```tsx
<div
  key={`col-${col}-${kind}`}
  className={`relative ${...}`}
  style={{ gridColumn, gridRow: `3 / span ${totalRows}` }}
  onPointerDown={(e) => {
    if ((e.target as HTMLElement).closest('[data-block]')) return; // 기존 블록 클릭
    const row = Number((e.target as HTMLElement).getAttribute('data-row'));
    if (Number.isNaN(row)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ date: dateStr, kind, startRow: row, currentRow: row });
  }}
  onPointerMove={(e) => {
    if (!drag || drag.date !== dateStr || drag.kind !== kind) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const row = Number(target?.getAttribute('data-row'));
    if (Number.isNaN(row)) return;
    if (row !== drag.currentRow) setDrag({ ...drag, currentRow: row });
  }}
  onPointerUp={(e) => {
    if (!drag || drag.date !== dateStr || drag.kind !== kind) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const minRow = Math.min(drag.startRow, drag.currentRow);
    const maxRow = Math.max(drag.startRow, drag.currentRow);
    const startMin = dayStartHour * 60 + minRow * gridMinutes;
    const endMin = dayStartHour * 60 + (maxRow + 1) * gridMinutes;
    setEditor({ date: drag.date, startMin, endMin, kind: drag.kind });
    setDrag(null);
  }}
  onPointerCancel={() => setDrag(null)}
>
  {Array.from({ length: totalRows }).map((_, row) => {
    const startMin = dayStartHour * 60 + row * gridMinutes;
    const isHourMark = startMin % 60 === 0;
    const inDrag =
      drag &&
      drag.date === dateStr &&
      drag.kind === kind &&
      row >= Math.min(drag.startRow, drag.currentRow) &&
      row <= Math.max(drag.startRow, drag.currentRow);
    return (
      <div
        key={row}
        data-testid="time-slot"
        data-row={row}
        className={`block w-full transition cursor-cell
          ${inDrag
            ? 'bg-blue-100/50 dark:bg-blue-900/30 outline outline-2 outline-dashed outline-blue-400'
            : 'hover:bg-zinc-100/50 dark:hover:bg-zinc-800/40'}
          ${isHourMark ? 'border-t border-zinc-200 dark:border-zinc-800' : ''}
        `}
        style={{ height: ROW_HEIGHT }}
      />
    );
  })}
  {/* 기존 블록 렌더링은 그대로 */}
</div>
```

블록 렌더링은 다음 task 에서 점선/실선으로 교체. 이번 task 는 인터랙션만.

기존 블록 `<button>` 에 `data-block="true"` 속성 추가 (위 onPointerDown 의 `closest('[data-block]')` 가드용).

- [ ] **Step 3: 수동 검증 (개발 서버)**

`npm run dev` (포트 3000 사용 중이면 `PORT=3100 npm run dev`). 브라우저에서 `/week/<isoweek>` 접속:
- 빈 슬롯에서 mouseDown → 아래로 드래그 → mouseUp. BlockEditor 가 드래그 범위로 열려야 한다.
- 빈 슬롯에서 한 번 클릭 (drag 없음). BlockEditor 가 해당 슬롯 1칸 범위로 열려야 한다.
- 기존 블록 클릭. 편집 모달 (existing 채워짐) 열려야 한다.
- 같은 컬럼이 아닌 다른 sub-col 로 드래그 끌고 가도, drag.date/drag.kind 가 시작점에 묶여 있어 시작 컬럼 범위만 선택된다.

문제 발생 시 stop & report.

- [ ] **Step 4: tsc 검증**

```bash
npx tsc --noEmit
```
Expect: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add components/week/WeekGrid.tsx
git commit -m "$(cat <<'EOF'
feat(week): drag-to-select time range opens BlockEditor

Replaces per-slot button onClick with pointer-event drag on each
sub-column container. setPointerCapture keeps the drag tied to the
starting column even if the cursor wanders. mouseUp opens BlockEditor
with startMin/endMin reflecting the drag range; a zero-distance drag
falls back to the previous one-slot click behavior. Touch devices
get the same flow because Pointer Events unify mouse and touch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 블록 디자인 — 점선/실선 + 텍스트 위계

**Goal:** 계획 블록은 점선 테두리 + 10% 채움, 실제 블록은 실선 테두리 + 24% 채움. 텍스트 위계 정돈.

**Files:**
- Modify: `components/week/WeekGrid.tsx` (블록 렌더링 부분)

- [ ] **Step 1: 블록 렌더링 변경**

기존 `subBlocks.map((b) => { ... <button ... className="absolute ... rounded-md shadow-sm ..." style={{ background: tint.soft(color), borderLeft: `3px solid ${tint.bar(color)}` }}> ... })` 를 다음으로:

```tsx
{subBlocks.map((b) => {
  const topRow = (b.startMin - dayStartHour * 60) / gridMinutes;
  const spanRows = (b.endMin - b.startMin) / gridMinutes;
  const color = catColor(b.categoryId);
  const isPlan = (b.kind ?? 'plan') === 'plan';
  return (
    <button
      key={b.id}
      data-block="true"
      onClick={(e) => {
        e.stopPropagation();
        setEditor({
          date: b.date,
          startMin: b.startMin,
          endMin: b.endMin,
          kind: b.kind ?? 'plan',
          existing: b,
        });
      }}
      className={`absolute left-0.5 right-0.5 rounded-md text-left overflow-hidden transition
        ${isPlan
          ? 'border-2 border-dashed hover:shadow-sm'
          : 'border-2 border-solid shadow-sm hover:shadow-md'}
      `}
      style={{
        top: topRow * ROW_HEIGHT + 1,
        height: spanRows * ROW_HEIGHT - 2,
        background: tint.soft(color, isPlan ? 0.10 : 0.24),
        borderColor: tint.bar(color),
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        borderLeftColor: tint.bar(color),
      }}
      title={b.text}
    >
      <div className="px-1.5 py-1">
        <div className="text-[12px] font-semibold leading-tight text-zinc-800 dark:text-zinc-100 truncate">
          {b.text || '(내용 없음)'}
        </div>
        {spanRows >= 2 && (
          <div className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-0.5 truncate">
            {minutesToTimeStr(b.startMin)}–{minutesToTimeStr(b.endMin)}
          </div>
        )}
      </div>
    </button>
  );
})}
```

> 변경 포인트:
> - `data-block="true"` (Task 2 의 onPointerDown 가드용).
> - `border-2 dashed` 또는 `border-2 solid` 를 isPlan 으로 분기.
> - `tint.soft(color, 0.10 | 0.24)` — Task 1 의 새 시그니처 사용.
> - 좌측 컬러 바는 항상 solid 3px (브랜드 인식).
> - 텍스트: 10px → 12px / font-medium → font-semibold. 시간 표시도 9px → 10px.

- [ ] **Step 2: 수동 검증**

`npm run dev` 후 `/week/...`:
- 기존 블록 중 plan 인 것은 점선 테두리, actual 은 실선.
- 채움 농도 plan 옅음 / actual 진함.
- 좌측 컬러 바 그대로 보임.
- 텍스트 가독성 향상 (12px 굵은 텍스트).

- [ ] **Step 3: Commit**

```bash
git add components/week/WeekGrid.tsx
git commit -m "$(cat <<'EOF'
feat(week): plan vs actual blocks distinguished by dashed/solid border

Plan blocks now render with a 2px dashed border and 10% category
fill; actual blocks use a 2px solid border and 24% fill. Category
color stays as a solid 3px left bar on both. Block text bumped from
10px medium to 12px semibold for legibility, and the time line in
the block jumps to 10px. Distinction works in monochrome and is
robust to color-vision differences.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 컬럼 / 헤더 / 호버 / 시간라벨 디자인 정돈

**Goal:** plan/actual 컬럼 색 노이즈 제거, 일자 묶음 사이 강한 구분선, 헤더 정돈, 시간 라벨 가독성.

**Files:**
- Modify: `components/week/WeekGrid.tsx` (헤더 + 컬럼 배경 + 시간 라벨)
- Modify: `components/week/BlockEditor.tsx` (kind 토글 이모지 제거)

- [ ] **Step 1: BlockEditor 토글 이모지 제거**

`components/week/BlockEditor.tsx:140` 의 `🗓️ 계획` → `계획`, `:151` 의 `✅ 실제` → `실제`. 그 외 변경 없음.

- [ ] **Step 2: WeekGrid 시간 라벨 변경**

`WeekGrid.tsx` 의 `Time labels column` (line ~180) 의 `<div>` className 변경:
```tsx
<div
  key={`t-${row}`}
  className={`text-[11px] tabular-nums pr-2 text-right text-zinc-500 dark:text-zinc-500 border-r border-zinc-100 dark:border-zinc-900 ${
    isHourMark ? 'border-t border-zinc-200 dark:border-zinc-800' : 'border-t border-zinc-100/60 dark:border-zinc-900/40'
  }`}
  style={{ gridColumn: 1, gridRow: row + 3, height: ROW_HEIGHT }}
>
  {isHourMark ? minutesToTimeStr(startMin) : ''}
</div>
```

- [ ] **Step 3: WeekGrid Row 1 (일자) 헤더 변경**

기존 `<button onClick={() => setRetroDate(dateStr)} ...>` 를 다음으로 (각 일자):
```tsx
import { WEEKDAYS_KO } from '@/lib/utils/date';
import { NotebookPen } from 'lucide-react';
// ...

<div
  key={`h1-${i}`}
  className={`relative border-b border-zinc-200 dark:border-zinc-800 py-2 px-2 text-center
    ${isToday
      ? 'bg-zinc-50 dark:bg-zinc-900/30'
      : 'bg-white dark:bg-zinc-950'}
    ${i % 2 === 0 ? '' : ''}
  `}
  style={{ gridColumn: `${i * 2 + 2} / span 2`, gridRow: 1 }}
>
  <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
    <span className="text-zinc-500 dark:text-zinc-400 mr-1">{WEEKDAYS_KO[i]}</span>
    {d.getMonth() + 1}/{d.getDate()}
  </div>
  <button
    onClick={() => setRetroDate(dateStr)}
    title="회고"
    className="absolute top-1 right-1 p-1 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
  >
    <NotebookPen size={12} />
  </button>
</div>
```

- [ ] **Step 4: WeekGrid Row 2 (계획/실제) 헤더 변경**

기존 `<div className="text-center text-[10px] py-1 bg-blue-50/60 ...">🗓️ 계획</div>` 를:
```tsx
<div
  className="text-center text-[11px] py-1 text-zinc-500 dark:text-zinc-500 font-medium border-b border-zinc-100 dark:border-zinc-900"
  style={{ gridColumn: i * 2 + 2, gridRow: 2 }}
>
  계획
</div>
```
같은 패턴으로 `실제` 도 (이모지·blue-50·emerald-50 다 제거, 단순 zinc 텍스트만).

- [ ] **Step 5: 컬럼 sub-col 배경 제거 + 일자 사이 구분선**

기존 `kindBg` 변수 제거. sub-column 의 `<div>`:
```tsx
<div
  key={`col-${col}-${kind}`}
  className={`relative
    ${isToday ? 'bg-zinc-50 dark:bg-zinc-900/30' : ''}
    ${kind === 'plan'
      ? 'border-r border-zinc-100/70 dark:border-zinc-900'
      : 'border-r border-zinc-200 dark:border-zinc-800'}
  `}
  style={{ gridColumn, gridRow: `3 / span ${totalRows}` }}
  /* onPointerDown/Move/Up/Cancel 그대로 (Task 2 코드) */
>
  ...
</div>
```

> kind === 'plan' (=col*2+2) 의 우측 border 는 plan↔actual 사이 옅은 선. kind === 'actual' (=col*2+3) 의 우측 border 는 일자 묶음 사이 강한 선. 이렇게 하면 컬럼 배경 없이도 일자 구분이 명확.

- [ ] **Step 6: 빈 슬롯 hover 톤 정돈**

Task 2 에서 만든 row `<div>` 의 className 의 hover 톤을 `bg-zinc-100/50` 그대로 유지. 정시 마크 border 를 `border-zinc-200` 으로 한 톤 진하게.

- [ ] **Step 7: 수동 검증**

`npm run dev` → `/week/...`:
- 일자별 큰 구분선이 보임 (계획-실제 사이는 옅음).
- 헤더에 "월 4/28" 형태로 요일+일자, 우측 상단 작은 노트 아이콘이 회고 트리거.
- Row 2 에 이모지 없는 "계획" / "실제" 옅은 텍스트.
- 빈 슬롯 hover 시 옅은 zinc 배경 + cursor-cell.
- 시간 라벨이 또렷해짐 (zinc-500 11px tabular).
- 오늘 컬럼이 zinc-50 (파스텔 블루 아닌).

- [ ] **Step 8: tsc + 단위 테스트**

```bash
npx tsc --noEmit
npm test
```
Expect: 0 errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add components/week/WeekGrid.tsx components/week/BlockEditor.tsx
git commit -m "$(cat <<'EOF'
feat(week): tone down columns, polish headers, time labels

Removes the blue/emerald sub-column tints; the visual difference
now lives in the block borders themselves (Task 3) and a stronger
1px zinc-200 divider between day groups, with a faint zinc-100
divider between plan and actual within a day.

Row-1 header shows weekday + date in semibold, with a small
NotebookPen icon top-right that triggers the retrospective sheet
(no longer a giant button across the whole header). Row-2 uses
plain "계획" / "실제" text in zinc-500. BlockEditor's kind toggle
loses its emojis to match.

Time labels go to 11px tabular-nums in zinc-500 with stronger
zinc-200 hour rules; today's column is now a calm zinc-50 instead
of pastel blue.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: E2E 드래그 검증 + 회귀

**Goal:** Playwright E2E 에 드래그 케이스 추가, 기존 1-슬롯 클릭 fallback 도 명시적으로 검증.

**Files:**
- Modify: `tests/e2e/week-input.spec.ts`

- [ ] **Step 1: 기존 spec 한번 통과 확인**

```bash
cd /e/WorkSpace\ -\ Person/Binder
npx playwright test tests/e2e/week-input.spec.ts
```
Expect: PASS. 만약 실패 — 디자인 변경으로 selector 가 깨졌다는 의미. 그 spec 의 selector 를 새 DOM 에 맞춰 갱신 후 PASS 확인.

- [ ] **Step 2: 드래그 케이스 추가**

`tests/e2e/week-input.spec.ts` 끝에:
```ts
test('drag across multiple slots opens BlockEditor with that range', async ({ page }) => {
  await loginAs(page, 'e2e-week-input', 'passwordA1*');
  // Navigate to current week (use the pattern other tests use)
  const isoweek = /* same helper used by existing tests */;
  await page.goto(`/week/${isoweek}`);

  const slots = page.locator('[data-testid="time-slot"][data-row]');
  await expect(slots.first()).toBeVisible();

  // Pick the first plan column's first three rows
  const planSlots = page.locator('[data-testid="time-slot"][data-row]').locator(
    'xpath=ancestor::div[contains(@class, "relative")][1]/descendant::*[@data-row]'
  );

  const start = slots.nth(0); // adjust to the plan-col-of-Monday's first slot
  const end = slots.nth(2);   // 3-slot drag

  const startBox = (await start.boundingBox())!;
  const endBox = (await end.boundingBox())!;

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2, { steps: 10 });
  await page.mouse.up();

  // BlockEditor opens
  const dialog = page.getByRole('heading', { name: /블록 추가/ });
  await expect(dialog).toBeVisible();

  // Verify time range covers ~3 slots (gridMinutes default = 30, so 90 minutes)
  const startInput = page.locator('input[type=time]').first();
  const endInput = page.locator('input[type=time]').nth(1);
  const startVal = await startInput.inputValue();
  const endVal = await endInput.inputValue();
  expect(startVal).not.toEqual(endVal);
  // Optional: parse and assert end - start >= 60 minutes
});

test('single click still opens BlockEditor with one-slot range (fallback)', async ({ page }) => {
  await loginAs(page, 'e2e-week-input', 'passwordA1*');
  // ... navigation as above ...

  const slot = page.locator('[data-testid="time-slot"][data-row]').first();
  await slot.click();

  const dialog = page.getByRole('heading', { name: /블록 추가/ });
  await expect(dialog).toBeVisible();
});
```

> The existing `tests/e2e/week-input.spec.ts` already has a navigation helper to the current week and a `loginAs` import. Reuse them — don't duplicate. If the helper doesn't exist for `e2e-week-input` user, the file already calls `ensureUserExists('e2e-week-input', ...)` in beforeAll (per Task 10 of the prior multi-user plan).

- [ ] **Step 3: 실행**

```bash
npx playwright test tests/e2e/week-input.spec.ts
```
Expect: All tests in this file PASS.

- [ ] **Step 4: 전체 e2e 회귀**

```bash
npx playwright test
```
Expect: 5+ tests PASS (multiuser, cascade, daily-retro, weekly-retro, week-input). 깨지면 selector 업데이트.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/week-input.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): drag-range selection + click fallback for week grid

Adds two cases on tests/e2e/week-input.spec.ts:
1. mouse down on slot N, mouse up on slot N+2 -> BlockEditor opens
   with start/end times spanning the dragged range
2. single click on a slot still opens BlockEditor with the
   one-slot range (preserves the prior behavior)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 운영 배포 + RUNBOOK 갱신

**Goal:** main 에 머지 (이미 main 에서 작업 중이면 push), 운영 컨테이너 재기동, 사용자 검증, RUNBOOK 변경 이력 추가.

- [ ] **Step 1: tsc + npm test + e2e 모두 통과 재확인**

```bash
cd /e/WorkSpace\ -\ Person/Binder
npx tsc --noEmit
npm test
npx playwright test
```
Expect: 0 errors, all tests PASS.

- [ ] **Step 2: 운영 컨테이너 재배포**

```powershell
docker compose up -d --build app
docker compose logs --tail 30 app
```
Healthcheck `healthy` 까지 대기. (`docker inspect --format '{{.State.Health.Status}}' super-planner` → `healthy`)

- [ ] **Step 3: 사용자 검증 부탁**

브라우저 hard refresh 후 `/week/<isoweek>`:
- 빈 슬롯 드래그로 시간 범위 → 모달 열려야 함.
- 기존 블록 plan = 점선, actual = 실선.
- 헤더, 컬럼, 시간 라벨이 정돈되어 보여야 함.
- 모바일 (휴대폰 데이터로 https) 에서도 터치 드래그가 동작해야 함.

문제 발견 시 STOP, 디버그.

- [ ] **Step 4: RUNBOOK 변경 이력 한 줄 추가**

`docs/RUNBOOK.md` 의 `## 9. 변경 이력` 끝에:
```md
- 2026-04-28 — 주간 그리드 UX/디자인 개선: 드래그로 시간 범위 선택, 계획·실제 블록 점선·실선 구분, 헤더·컬럼·시간라벨 디자인 정돈.
```

- [ ] **Step 5: 마지막 commit + push**

```bash
git add docs/RUNBOOK.md
git commit -m "docs(runbook): log week grid UX/design pass"
git push origin main
```

---

## 종합 체크리스트

1. ☐ Task 1 — color/date 유틸 보강
2. ☐ Task 2 — 드래그 인터랙션
3. ☐ Task 3 — 블록 점선/실선
4. ☐ Task 4 — 컬럼/헤더/호버/시간라벨
5. ☐ Task 5 — E2E 드래그 검증
6. ☐ Task 6 — 운영 배포 + RUNBOOK

## 예상 소요 시간

- Inline 실행: 60~90분 (디자인 디테일 손보는 task 4 가 가장 큼)
- Subagent-driven: 90~150분 (task 별 review 포함, 작은 변경이라 review 도 빠름)

## Worktree 권장

운영 컨테이너가 main 디렉토리에서 데이터 마운트 중이지만, 이번 변경은 코드만이고 DB 스키마 변동 없음. main 에서 직접 작업해도 위험 낮음. 그래도 격리하고 싶으면 `git worktree add .worktrees/week-redesign -b feat/week-redesign` 으로 분리. Task 5 의 E2E 가 PORT=3100 + 별도 DB 를 사용하므로 운영 :3000 컨테이너와 충돌하지 않음 (이전 multi-user 작업에서 정리됨).

## 위험 요소

1. **DOM 셀렉터 깨짐** — 헤더 구조 변경으로 기존 e2e spec 의 selector (회고 버튼 텍스트 등) 가 깨질 수 있음. Task 5 Step 1 에서 먼저 통과 확인하고 깨지면 동시 갱신.
2. **Pointer Events 호환성** — Next.js 16 / React 19 에서 setPointerCapture 가 정상 동작해야 함. 모든 modern 브라우저는 지원하지만, 만약 일부 환경에서 잡힌 pointer 가 안 떨어지면 onPointerCancel 로 안전 폴백.
3. **카테고리 색이 너무 옅으면 점선이 안 보임** — `tint.bar(color)` 가 hex 원본을 쓰니 일반적으로 선명한데, 사용자 카테고리에 매우 옅은 파스텔 색이 있으면 점선 가시성 떨어질 수 있음. 시각 검증 시 점검.
4. **운영 hot reload** — `docker compose up -d --build` 는 컨테이너 재생성. 사용자가 작성 중인 todo/시간블록이 있는 상태에서 적용해도 DB 는 보존되지만 입력 중 텍스트는 사라짐. 사용 적은 시간대에 배포 권장.

---

## 변경 이력

- 2026-04-28 — 작성. Spec (`docs/superpowers/specs/2026-04-28-week-grid-drag-and-design.md`) 의 결정 사항 반영. 6 tasks.
