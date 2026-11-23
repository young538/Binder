# 인생 OS 확장 기능 (컨디션 · 이브닝 셧다운 · 월/연 회고 · 지표 · 원칙 노트 · 일정/인맥 · 구독/월정액 · 런처)

[전체 목차](../README.md) · [데이터 모델](../02-data-model.md) · [API](../03-api.md)

## 목적과 URL

바인더의 목표–프로젝트–실행 루프를 생활 전반으로 확장하는 기능 묶음입니다.

- `/dashboard`: 오늘 일정·하이라이트/할 일·주의 항목·진행 중 프로젝트·고정 구독·상태 지표 스파크라인 통합 대시보드
- `/daily/[date]`: 10초 컨디션 체크인, 계획 → 실제 시간블록 확정, 이브닝 셧다운 마감 루틴, 오늘의 일정·기념일·구독 결제 스트립
- `/retrospective/month/[yyyymm]`, `/retrospective/year/[year]`: 월간·연간 실행 집계 및 회고
- `/metrics`: 상태·추세 지표 트래커 (체중, 순자산, 수면 평균 등)
- `/notes`: 영구 지식·내 원칙·의사결정 복기·프로젝트 레퍼런스 노트
- `/life`: 약속·D-Day·기념일(`.ics` 가져오기 포함) 및 소중한 사람 안부 CRM
- `/subscriptions`: 구독·월정액 고정비 관리, 월/연 환산 요약, 결제일 갱신 및 예정 알림

---

## 1. 일일 컨디션 체크인 · 계획→실제 확정 · 이브닝 셧다운

1. **10초 컨디션 체크인 (`DailyCheckinBar`)**:
   - `/daily/[date]` 상단에 수면 시간(`0~24`h), 에너지(`1~5`), 스트레스(`1~5`), 컨디션 메모를 입력합니다.
   - `GET/PUT /api/daily-checkins`를 통해 날짜별로 즉시 upsert 되며, 같은 버튼을 다시 누르면 해당 평점을 `null`로 해제합니다.
2. **계획 → 실제 확정 (`DailyTimeBlocks`)**:
   - 일일 시간표에 `plan` 블록이 남아 있고 동일 시간·제목의 `actual` 블록이 아직 없으면 **계획 → 실제 확정** 버튼을 표시합니다.
   - `POST /api/time-blocks/confirm-actuals`가 계획 블록의 카테고리·목표·프로젝트·할 일 연결(`projectId`·`goalId`·`todoId`)을 유지한 채 `actual` 블록으로 일괄 복사하며, 동일 `(startMin, endMin, text)` 블록은 중복 생성하지 않습니다.
3. **이브닝 셧다운 (`EveningShutdownBanner` · `EveningShutdownDialog`)**:
   - `GET /api/evening-shutdown?date=YYYY-MM-DD`로 미확정 계획, 미완료 오늘 할 일, 당일 컨디션·일일 회고 현황을 불러옵니다.
   - 3단계 마감 대화상자에서 ① 계획 블록 실제 확정, ② 미완료 할 일 내일로 이월 또는 수집함 이동(`repeatRule` 자동 해제), ③ 수면·에너지·일일 회고 작성을 순서대로 마무리합니다.
   - 완료 상태는 `localStorage` 키 `binder:evening-shutdown:<userId>:<date>`로 표시하며, 필요 시 **마감 다시 열기**로 재진입할 수 있습니다.

---

## 2. 회고 내비게이션 · 월/연 회고 · 원칙 승격

1. **기간 이동 및 단위 전환 (`RetroPeriodHeader`)**:
   - 주간(`/retrospective/week/[isoweek]`), 월간(`/retrospective/month/[yyyymm]`), 연간(`/retrospective/year/[year]`) 회고 상단에 이전/다음 기간 이동 화살표와 `주간` · `월간` · `연간` 전환 탭을 제공합니다.
2. **월간·연간 실행 요약 (`MonthlyRetroPage` · `YearlyRetroPage`)**:
   - 해당 기간의 `actual` 시간 합계, 할 일 완료 수, 완료된 프로젝트(`completedAt` 기준), 완독 책 수, 일일 체크인 평균 수면·에너지를 집계합니다. 월간 회고에는 카테고리별 계획 대비 실제 비교와 습관 달성률도 포함됩니다.
3. **내 원칙으로 남기기 (`RetroPrincipleAction`)**:
   - `RetroTemplate`의 **내일/다음주 1가지** 아래 **내 원칙으로 남기기** 버튼으로 회고 내용(`nextStep` · `good` · `bad` · `freeText`)을 `binder_notes`의 `principle` · `insight` · `decision` 노트로 승격할 수 있습니다. 원본 회고 좌표(`sourceRetro`)를 함께 저장해 노트 카드에서 원래 회고 URL로 되돌아갈 수 있습니다.

---

## 3. 상태 지표 트래커 (`/metrics`)

- 목표 방향(`up`: 증가 목표, `down`: 감소 목표, `target`: 목표치 유지)과 단위, 선택 목표(`goalId`), 목표 수치(`targetValue`), 색상을 지정해 지표를 만듭니다.
- 카드 내 인라인 폼으로 특정 날짜(`YYYY-MM-DD`)의 측정 수치를 기록(`POST /api/metrics/[id]/entries`)하면 SVG 스파크라인(`MetricSparkline`), 직전 기록 대비 변화량(Delta), 목표 대비 진행률을 즉시 계산해 표시합니다. 동일 날짜 재입력 시 기존 엔트리를 갱신(upsert)하며 지표 삭제 시 엔트리도 트랜잭션으로 함께 삭제됩니다.

---

## 4. 지식 · 원칙 · 의사결정 노트 (`/notes`)

- **유형**: `principle`(내 원칙), `decision`(의사결정), `insight`(인사이트), `reference`(레퍼런스).
- **의사결정 복기**: `decision` 노트에 복기 예정일(`reviewDate`)을 두면 해당 날짜 이후 복기 결과(`decisionOutcome`)가 비어 있을 때 `/notes` 상단과 오늘 모닝 부팅(`dueDecisions`)에서 복기 알림을 표시합니다.
- **고정·연결·빠른 입력**: `pinned` 설정으로 목록 상단에 고정하며 상위 목표(`goalId`)와 프로젝트(`projectId`)를 연결할 수 있습니다. 프로젝트 카드(`/projects`)에서도 해당 프로젝트에 연결된 노트를 확인하고 **노트 추가** 링크로 바로 이동할 수 있습니다. `QuickCapture`(`Alt+N`)의 **빠른 노트** 탭에서도 즉시 저장합니다.

---

## 5. 일정 · 기념일 · 소중한 사람 (`/life`)

1. **일정 · D-Day · 기념일 (`LifeEventsSection`)**:
   - `event`(단발/기간 일정), `dday`(D-Day), `anniversary`(매년 반복 기념일; `02-29`는 비윤년 `02-28`로 보정)를 관리합니다.
   - 다가오는 일정은 모닝 부팅(3일 이내 `upcomingEvents`), 일일 트래커 상단 스트립, 월간 달력 셀과 날짜 서랍에 자동 표시됩니다.
   - 일일(`/daily/[date]`)·주간(`/week/[isoweek]`) 시간표의 `계획` 컬럼에는 시간 지정 일정이 오버레이로 겹쳐 표시되며, 클릭 한 번으로 `BlockEditor`를 열어 계획 시간블록으로 가져올 수 있습니다(종일 일정은 날짜 헤더에 배지 표시).
2. **Google 캘린더 · Google Tasks 양방향 연동 ([GoogleCalendarPanel](../../0.%20Source/src/components/settings/GoogleCalendarPanel.tsx) · [syncService.ts](../../0.%20Source/src/lib/server/googleCalendar/syncService.ts) · [tasksSyncService.ts](../../0.%20Source/src/lib/server/googleCalendar/tasksSyncService.ts) · [autoSync.ts](../../0.%20Source/src/lib/server/googleCalendar/autoSync.ts))**:
   - Google OAuth 2.0(`calendar`, `tasks`, `userinfo.email`)으로 인증해 선택한 Google 캘린더 일정을 `-30일 ~ +180일` 범위로 가져오고(구글 측 삭제 일정 반영 포함), 선택한 Google Tasks 목록의 할 일을 바인더의 수집함(`inbox`)·일간(`day`) 할 일과 프로젝트 매핑(`tasksProjectMap`) 기준으로 양방향 동기화합니다.
   - 앱 열기/탭 복귀/10분 간격 접속 체크([GoogleCalendarAutoSync](../../0.%20Source/src/components/providers/GoogleCalendarAutoSync.tsx))와 서버 시작 hook([instrumentation.ts](../../0.%20Source/src/instrumentation.ts)) 기반 15분 백그라운드 스케줄러로 Google 캘린더와 Google Tasks 변경분을 함께 자동 가져옵니다(`syncEnabled`/`tasksSyncEnabled` 켜짐 기준).
   - 바인더에서 일반 일정을 생성·수정·삭제하면 연결된 Google 캘린더에, 수집함·일간 할 일을 생성·완료·수정·이월·삭제·복원하면 연결된 Google Tasks 목록에 실시간 반영됩니다(단, `dday`·`anniversary`·`.ics` 외부 일정 및 주/월/연 단위 목표 할 일은 로컬 유지). Tasks API 권한 누락 등 오류는 캘린더 동기화와 격리해 `tasksLastSyncError`에만 기록합니다.
   - `/inbox`([TodoHubPage](../../0.%20Source/src/components/inbox/TodoHubPage.tsx))는 수집함·오늘·예정·전체·프로젝트별 보기, 검색/우선순위/완료 필터, 원클릭 `오늘`/`내일`/프로젝트 분류와 Google Tasks 동기화 카드를 제공합니다.
3. **`.ics` 가져오기 (`IcsImportDialog` · `lib/ics.ts`)**:
   - `.ics` 파일 업로드, 원문 붙여넣기, 또는 직접 `https://` 구독 URL(2MB 제한, 사설/루프백 IP 및 리다이렉트 차단)을 통해 RFC 5545 `VEVENT`를 파싱합니다.
   - 줄 바꿈 접기(line unfolding), `VALUE=DATE` 배타적 `DTEND` -1일 보정, UTC `Z` 시각의 `Asia/Seoul` 변환을 지원하며, `externalUid` 기준으로 중복 생성 대신 기존 일정을 갱신합니다.
4. **소중한 사람 CRM (`PeopleSection`)**:
   - 이름, 관계, 안부 주기(`cadenceDays`), 최근 연락일(`lastContactAt`), 생일, 선물 아이디어를 관리합니다.
   - 안부 주기가 지난 인물은 목록 상단에 강조 표시되며 모닝 부팅(`duePeople`)에 노출됩니다. **오늘 안부 완료** 버튼으로 최근 연락일을 오늘로 갱신하거나 **오늘 할 일에 연락 추가** 버튼으로 `day` 할 일을 생성할 수 있습니다.

---

## 6. 구독 · 월정액 고정비 관리 (`/subscriptions`)

- **결제 정보·통화·주기**: 서비스명, 금액(`amount`), 통화(`KRW`·`USD`·`JPY`·`EUR`), 결제 주기(`monthly`·`yearly`·`weekly`·`quarterly`), 상태(`active`·`paused`·`cancelled`), 매월 결제 기준일(`billingDay` `1~31`), 다음 결제일(`nextBillingDate`), 분류(`category`), 결제 수단(`paymentMethod`), 관리 링크(`url`), 메모(`note`)를 관리합니다.
- **월/연 고정비 요약**: 활성(`active`) 구독을 통화별로 합산해 월 예상 고정비(연간 ÷12, 분기 ÷3, 주간 ×52÷12)와 연간 예상 지출, 7일 내 결제 예정 건수를 KPI 카드로 표시합니다.
- **결제일 갱신·일시정지·알림**: **다음 결제일로 갱신** 버튼 한 번으로 주기와 `billingDay`(말일 보정 포함)에 맞춰 다음 결제일을 전진시키며, 일시정지/재개/해지 전환도 즉시 반영합니다. 활성 구독의 3일 이내 결제 예정은 모닝 부팅(`upcomingEvents`의 `subscription`)에, 반복 결제 날짜는 일일 스트립·월간 달력 마커에 자동 노출되며 `/subscriptions?subscription=<id>` 딥링크 하이라이트를 지원합니다.

---

## 7. 커맨드 팔레트 (`Ctrl/Cmd+K`)

- 로그인 이후 모든 화면에서 `Ctrl+K`(macOS `Cmd+K`) 또는 상단/더보기 **⌘K 런처** 버튼으로 전역 커맨드 팔레트(`CommandPalette`)를 엽니다.
- 화면 빠른 이동, 입력 문구 그대로 **수집함에 할 일 추가** 또는 **인사이트 노트 저장**, `/api/search` 15종 통합 검색 결과 즉시 점프를 지원합니다.

---

## 8. 인생 OS 통합 대시보드 (`/dashboard`)

- **통합 스냅샷 (`GET /api/dashboard?date=YYYY-MM-DD`)**: `DashboardRepository`([dashboard.ts](../../0.%20Source/src/lib/server/repos/dashboard.ts))가 단일 읽기 트랜잭션으로 오늘 일정(Google 캘린더 동기화 일정 포함), 다가오는 7일 일정·생일·구독 결제, 오늘 하이라이트·할 일(완료 토글 지원)·시간 실행, 주간 습관 달성률, 오늘 컨디션 체크인, 진행 중 프로젝트(다음 행동 누락 경고 포함), 구독 월/연 고정비, **이번 달 가계부(지출·수입·예산 사용률·상위 분류)**, 상태 지표 스파크라인(`MetricSparkline`)을 묶어 반환합니다.
- **주의 배너**: 이월 대기 할 일, 다음 행동 없는 프로젝트, 안부 연락 도래 인물, 복기 예정 의사결정, 7일 이내 구독 결제가 있으면 상단에 바로가기 배지를 표시합니다.

---

## 9. 가계부 · 뱅크샐러드 엑셀 가져오기 (`/finance`)

- **네비게이션 통합**: 상단 데스크톱(`홈 · 일일 · 할 일` + `플래너`/`목표·실행`/`재무`/`지식 · 기록` 드롭다운)과 모바일 하단(`홈 · 일일 · 할 일 · 가계부 · 더보기`)에서 1클릭으로 진입할 수 있으며, **빠른 메모 (`Alt+N`)**의 **빠른 지출** 탭에서 현금·수동 지출을 즉시 기록합니다.
- **뱅크샐러드 통합 엑셀(`.xlsx`) 및 CSV 2단계 가져오기 ([parser.ts](../../0.%20Source/src/lib/server/finance/parser.ts) · [FinanceImportDialog.tsx](../../0.%20Source/src/components/finance/FinanceImportDialog.tsx))**: `가계부 내역` 시트(암호 설정된 엑셀 복호화 지원)와 UTF-8/EUC-KR CSV를 파싱해 미리보기(`신규 / 중복 건너뜀 / 지출·수입·이체`) 후 SHA-256 `externalHash` 기준으로 중복 없이 단일 트랜잭션 등록합니다.
- **예산·구독 고정비·회고 연동 ([FinancePage.tsx](../../0.%20Source/src/components/finance/FinancePage.tsx) · [finance.ts](../../0.%20Source/src/lib/finance.ts))**: `이체` 및 `합계 제외(excluded)` 항목을 뺀 순 지출·수입·순저축·일평균 가용액을 계산하며, 매월 기본/특정 월 예산, 활성 구독 고정비 자동 반영(`syncSubscriptionsForMonth`), `/api/search` 가계부 검색, 월간 회고(`/retrospective/month`) 및 AI 월간 회고 코치를 연결합니다.

---

## 구현 파일

| 파일 | 역할 |
|---|---|
| [DashboardPage](../../0.%20Source/src/components/dashboard/DashboardPage.tsx) / [app/(app)/dashboard/page.tsx](../../0.%20Source/src/app/(app)/dashboard/page.tsx) | 인생 OS 통합 대시보드 컨트롤 룸 |
| [MonthlyRetroPage](../../0.%20Source/src/components/retro/MonthlyRetroPage.tsx) / [YearlyRetroPage](../../0.%20Source/src/components/retro/YearlyRetroPage.tsx) | 월·연 회고 집계 및 자동 저장 |
| [RetroPeriodHeader](../../0.%20Source/src/components/retro/RetroPeriodHeader.tsx) / [RetroPrincipleAction](../../0.%20Source/src/components/retro/RetroPrincipleAction.tsx) | 회고 기간 이동·전환과 원칙 승격 |
| [DailyCheckinBar](../../0.%20Source/src/components/daily/DailyCheckinBar.tsx) / [DailyTimeBlocks](../../0.%20Source/src/components/daily/DailyTimeBlocks.tsx) | 10초 컨디션 입력 및 계획→실제 확정 |
| [EveningShutdownBanner](../../0.%20Source/src/components/daily/EveningShutdownBanner.tsx) / [EveningShutdownDialog](../../0.%20Source/src/components/daily/EveningShutdownDialog.tsx) | 3단계 이브닝 셧다운 루틴 |
| [MetricsPage](../../0.%20Source/src/components/metrics/MetricsPage.tsx) / [MetricCard](../../0.%20Source/src/components/metrics/MetricCard.tsx) / [MetricSparkline](../../0.%20Source/src/components/metrics/MetricSparkline.tsx) | 상태 지표 CRUD, 기록 입력, SVG 스파크라인 |
| [NotesPage](../../0.%20Source/src/components/notes/NotesPage.tsx) / [NoteEditorDialog](../../0.%20Source/src/components/notes/NoteEditorDialog.tsx) | 원칙·의사결정·인사이트·레퍼런스 관리 |
| [LifePage](../../0.%20Source/src/components/life/LifePage.tsx) / [LifeEventsSection](../../0.%20Source/src/components/life/LifeEventsSection.tsx) / [IcsImportDialog](../../0.%20Source/src/components/life/IcsImportDialog.tsx) / [PeopleSection](../../0.%20Source/src/components/life/PeopleSection.tsx) | 일정·기념일·`.ics` 가져오기·소중한 사람 CRM |
| [SubscriptionsPage](../../0.%20Source/src/components/subscriptions/SubscriptionsPage.tsx) / [SubscriptionEditorDialog](../../0.%20Source/src/components/subscriptions/SubscriptionEditorDialog.tsx) | 구독·월정액 CRUD, 요약 카드, 결제일 갱신 |
| [FinancePage](../../0.%20Source/src/components/finance/FinancePage.tsx) / [FinanceImportDialog](../../0.%20Source/src/components/finance/FinanceImportDialog.tsx) / [parser.ts](../../0.%20Source/src/lib/server/finance/parser.ts) | 가계부, 월 예산, 뱅크샐러드 엑셀/CSV 가져오기 |
| [CommandPalette](../../0.%20Source/src/components/nav/CommandPalette.tsx) / [QuickCapture](../../0.%20Source/src/components/inbox/QuickCapture.tsx) / [TodoHubPage](../../0.%20Source/src/components/inbox/TodoHubPage.tsx) | `Ctrl/Cmd+K` 런처, 빠른 입력·수집함/오늘/예정/프로젝트 통합 허브 |
| [ics.ts](../../0.%20Source/src/lib/ics.ts) / [lifeEvents.ts](../../0.%20Source/src/lib/lifeEvents.ts) / [metrics.ts](../../0.%20Source/src/lib/metrics.ts) / [subscriptions.ts](../../0.%20Source/src/lib/subscriptions.ts) / [eveningShutdown.ts](../../0.%20Source/src/lib/eveningShutdown.ts) | 순수 도메인 파싱·D-Day·스파크라인·구독 환산·마감 유틸리티 |
| [app/(app)/metrics/page.tsx](../../0.%20Source/src/app/(app)/metrics/page.tsx) / [notes](../../0.%20Source/src/app/(app)/notes/page.tsx) / [life](../../0.%20Source/src/app/(app)/life/page.tsx) / [subscriptions](../../0.%20Source/src/app/(app)/subscriptions/page.tsx) | App Router 페이지 진입점 |
