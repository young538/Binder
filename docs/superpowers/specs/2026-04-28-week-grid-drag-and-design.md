# 주간 시간블록 그리드 — 드래그 입력 + 디자인 정돈 (Spec)

**Date**: 2026-04-28
**Status**: Draft (사용자 검토 대기)

## 문제

운영 중인 `/week/<isoweek>` 페이지의 시간블록 입력 UX/디자인에 두 가지 문제가 있다.

1. **시간 범위 지정이 번거롭다**. 빈 슬롯을 클릭하면 `BlockEditor` 모달이 열리지만 시작/종료 시간은 클릭한 슬롯 한 칸뿐이라, 1 시간짜리 블록을 만들려면 모달 안에서 종료 시간을 직접 변경해야 한다. 직관적인 드래그 입력이 없다.
2. **계획(plan) 과 실제(actual) 의 시각 구분이 약하다**. 컬럼 배경에 `blue-50/20` 과 `emerald-50/20` 의 옅은 톤만 깔려 있고, 블록 자체는 계획/실제 모두 동일한 디자인이다. 컬럼 헤더의 이모지(`🗓️ / ✅`) 외에는 어느 컬럼이 무엇인지 한눈에 들어오지 않는다.
3. 부수적으로 시간 라벨, 빈 슬롯 호버, 텍스트 위계 등 디자인 디테일이 정돈되지 않은 인상이다.

## 결정 사항

브레인스토밍에서 사용자와 합의된 결정:

- **드래그 동작 결과**: 드래그를 끝내면 `BlockEditor` 모달이 자동으로 열리고 시작/종료 시간이 드래그 범위로 채워진다 (옵션 A). 모달의 텍스트, 카테고리, todo 연결 흐름은 기존과 동일하게 유지한다.
- **계획/실제 블록 구분**: 점선 vs 실선 테두리 (옵션 A). 색에만 의존하지 않고 흑백 인쇄·색약 사용자에게도 구분 가능하다.
- **전체 구조**: 현재의 7일 × [계획 | 실제] 14 컬럼 구조 그대로 유지하고 시각 디테일만 정돈 (옵션 A). 단일 컬럼 겹치기·토글은 별도 후속 작업 후보로 남긴다.

## 상세 설계

### 1. 드래그 인터랙션

**현재**: `<button>` 슬롯을 onClick. `setEditor({ ... startMin, endMin: startMin + gridMinutes ... })`.

**변경 후**:
- 빈 슬롯 영역에 `onPointerDown` 핸들러를 단다 (mouse + touch 통합).
- pointerDown → 시작 슬롯 인덱스 기록, 임시 상태 `dragRange = { col, kind, startRow, currentRow }` 셋업.
- pointerMove → 같은 컬럼 내에서 currentRow 갱신. 다른 컬럼/일자로 이동해도 dragRange 의 col/kind 는 고정 (시작 컬럼에 묶임).
- pointerUp → 두 가지 분기:
  - `currentRow === startRow` → 단순 클릭으로 간주, 기존 동작과 같은 1-슬롯 블록으로 모달 오픈.
  - `currentRow !== startRow` → `BlockEditor` 모달 오픈, `startMin = min * gridMinutes`, `endMin = (max + 1) * gridMinutes` (마지막 슬롯도 포함하도록 +1).
- pointerCancel/Leave → dragRange 초기화 (모달 안 엶).
- `setPointerCapture` 로 드래그 중 다른 요소로 빠져나가도 끝까지 추적.

**드래그 중 시각**: 선택 범위 슬롯들에 `bg-blue-100/40 dark:bg-blue-900/30 outline-2 outline-dashed outline-blue-400` 클래스 추가. 모바일은 동일하지만 outline 두께 살짝 더 진하게(2.5px).

**기존 onClick 핸들러는 제거**한다. pointerUp 안에서 short-drag 분기로 같은 효과를 낸다.

### 2. 블록 디자인

**현재 (`WeekGrid.tsx:246-279`)**:
```tsx
<button className="absolute ... rounded-md shadow-sm ..."
  style={{
    background: tint.soft(color),
    borderLeft: `3px solid ${tint.bar(color)}`,
  }}>
```

**변경 후**:
```tsx
<button className={`absolute ... rounded-md ... ${kind === 'plan'
    ? 'border-2 border-dashed'
    : 'border-2 border-solid shadow-sm'}`}
  style={{
    background: kind === 'plan' ? tint.soft(color, 0.10) : tint.soft(color, 0.24),
    borderColor: tint.bar(color),
    borderLeftWidth: 3,        // 카테고리 컬러 바 강조 유지
    borderLeftColor: tint.bar(color),
    borderLeftStyle: 'solid',  // 좌측은 항상 solid (브랜딩)
  }}>
```

`tint.soft` 가 현재 단일 인자라면 두 번째 인자(opacity) 를 받도록 시그니처 확장이 필요할 수 있다. 확장 어렵다면 `style` 안에서 직접 rgba 계산.

**텍스트**:
- `text-[10px]` → `text-[12px]`
- `font-medium` → `font-semibold`
- 시간 표시는 `spanRows >= 2` 조건 유지 (텍스트 잘리지 않도록).

### 3. 컬럼 시각 톤

**현재**: `bg-blue-50/20` / `bg-emerald-50/20` 가 plan/actual 컬럼 배경에 깔려 있고 오늘 컬럼은 `bg-blue-50/40`.

**변경 후**:
- plan/actual 컬럼 배경 제거 — 투명.
- 일자 묶음 사이 (`col % 2 === 0`) 에 `border-r border-zinc-200 dark:border-zinc-800` 의 1px 강한 구분선.
- plan↔actual 사이는 `border-r border-zinc-100/70 dark:border-zinc-900` 매우 옅게.
- 오늘 컬럼: `bg-zinc-50 dark:bg-zinc-900/30` (현재의 파랑 톤보다 차분).

### 4. 헤더 정돈

**현재**:
- Row 1: 한 컬럼당 회고 버튼, "{m}/{d}" 옆에 "회고 📝".
- Row 2: "🗓️ 계획" / "✅ 실제".

**변경 후**:
- Row 1: 두 sub-col 을 span 하는 부분에 `<요일> <m>/<d>` 큰 글씨 (text-sm font-semibold), 우측 상단에 작은 📝 아이콘 버튼 (회고). 일자 클릭 자체는 회고 sheet 오픈에서 빠지고, 📝 아이콘만 회고 트리거.
- Row 2: 이모지 제거. `계획` / `실제` 텍스트만, `text-[11px] text-zinc-500 dark:text-zinc-500 font-medium`.

요일 표기 (월/화/수…) 는 `lib/utils/date.ts` 에 이미 있는 한국어 weekday 유틸이 있는지 확인하고, 없으면 단순 배열로 처리.

### 5. 빈 슬롯 호버 / 드래그 affordance

- 기본: 투명, 그리드 라인 (정시 마크) 만.
- hover: `bg-zinc-100/50 dark:bg-zinc-800/40` + `cursor-cell`.
- 드래그 선택 범위: 위 §1 의 outline + bg.
- 정시 마크의 border 는 zinc-100 → zinc-200 으로 한 톤 진하게 해 시각 위계를 살린다.

### 6. 시간 라벨 (좌측 컬럼)

- 폰트: `text-xs` → `text-[11px] tabular-nums`.
- 색: `text-zinc-400` → `text-zinc-500 dark:text-zinc-500`.
- 정시: 위에 1px `border-t-zinc-200 dark:border-t-zinc-800`.
- 30분 단위에는 매우 옅은 ticking line (현재 없음). `border-t-zinc-100/60` 정도.

## 영향 받는 파일

**Modify**:
- `components/week/WeekGrid.tsx` — 6 섹션 모두의 변경 위치
- `lib/utils/color.ts` — `tint.soft` 가 opacity 인자 받도록 (필요 시)
- `lib/utils/date.ts` — 한국어 요일 유틸 추가 (필요 시)
- `tests/e2e/week-input.spec.ts` — 드래그 인터랙션 추가 검증; 기존 클릭 fallback 도 검증 유지

**Create**: 없음.

## 인수 기준 (Acceptance Criteria)

- [ ] 빈 슬롯에서 드래그하면 BlockEditor 모달이 열리며 시작/종료 시간이 드래그 범위와 일치한다.
- [ ] 같은 슬롯에서 떼면 (드래그 거리 0) 기존과 같은 1-슬롯 블록 모달이 열린다.
- [ ] 드래그 중에는 선택 범위가 시각적으로 highlight 된다.
- [ ] 모바일 (터치) 에서도 같은 동작이 작동한다.
- [ ] 계획 블록은 점선 테두리, 실제 블록은 실선 테두리로 한눈에 구별된다.
- [ ] 컬럼 배경의 plan/actual 색이 사라지고 오늘 컬럼만 차분한 zinc-50 톤으로 강조된다.
- [ ] Row 1 헤더에 요일+일자가 명시적으로 보이고, 회고는 작은 📝 아이콘으로만 트리거된다.
- [ ] 빈 슬롯 호버 시 cursor-cell 과 옅은 배경 호버가 보인다.
- [ ] `tests/e2e/week-input.spec.ts` 가 통과한다 (드래그 케이스 추가 후).
- [ ] 시각적 회귀: existing data 가 있는 운영 DB 에서 기존 블록이 깨지지 않는다.

## 범위 외 (Out of Scope)

- 단일 컬럼 겹치기 (옵션 B)
- 토글 모드 (옵션 C)
- BlockEditor 모달 자체의 내부 변경
- 모바일 (DayListView) 의 시간블록 그리드 — 이번 spec 은 데스크톱 `WeekGrid` 만
- 시간블록 드래그 이동 (생성된 블록을 드래그해 시간 옮기기)
- 블록 크기 조절 (resize handle)

## 알려진 이슈 / Open Questions

- `tint.soft(color, opacity)` 시그니처가 정말 두 인자를 받을 수 있도록 변경 가능한지, 또는 inline rgba 계산이 더 안전한지 implementer 가 결정.
- 한국어 요일 ("월/화/…") 표기가 다른 화면 (월간/만다라트) 과 일관된 톤으로 잡혀 있는지 점검 필요. 일관 안 맞으면 본 spec 변경 시 함께 정렬.

## 변경 이력

- 2026-04-28 — 작성. 사용자 합의된 옵션 A/A/A 반영. 검토 대기.
