# 데이터 모델과 연결 규칙

[전체 목차](README.md) · [API](03-api.md) · [구현 한계](05-verification-and-limitations.md)

기준 파일: [공통 타입](../lib/types.ts), [Drizzle 스키마](../lib/server/db/schema.ts), [서버 repositories](../lib/server/repos).

## 1. 공통 저장 규칙

SQLite는 서버 파일에 저장하며 WAL 모드입니다. 식별자는 ULID 문자열, 날짜는 주로 `YYYY-MM-DD`, 생성·수정 시각은 ISO 문자열입니다. TypeScript는 camelCase, SQL은 snake_case 컬럼을 사용합니다.

도메인 행은 userId를 갖습니다. 생성 함수는 서버에서 id·userId·시각을 부여하며 조회·수정·삭제는 사용자 조건을 사용합니다. settings는 userId 자체가 기본키입니다. 마이그레이션 호환용 기본 userId는 `pending-admin`이고 DB 초기화에서 실제 초기 사용자 ID로 바꿉니다.

연결 ID는 논리적 관계입니다. 현재 스키마에는 이 관계를 강제하는 `.references()`가 없습니다. `foreign_keys=ON`을 설정했다고 아래 관계의 삭제·참조 검증이 자동으로 생기는 것은 아닙니다.

## 2. 테이블과 주요 필드

| 테이블 | 주요 필드 | 쓰이는 화면 |
|---|---|---|
| users | id, username(고유), passwordHash, createdAt, updatedAt | 로그인, CLI |
| goals | title, parentId, level, color, order, 시각 | 보드, 목표 선택, 요약 |
| categories | name, color, order | 설정, TODO·습관·시간 색 |
| todos | title, scope, scopeKey, status, order, parentGoalId, priority, categoryId, note, repeatRule, sourceRetro, completedAt, repeatGenerated, 시각 | 일·주·월 TODO·수집함·반복 |
| focus_notes | scope, scopeKey, text, updatedAt | 한 문장, 자유노트, 일일 메모 |
| annual_goals | year, order, title, deadline, action, metric, target, monthlyTargets, monthlyActuals, monthlyActualAdjustments(내부), parentGoalId, 시각 | 연간, 보드 연결 |
| habits | name, color, order, schedule, categoryId, note, parentGoalId, annualGoalId, 시각 | 일일 관리, 일·주·월 체크 |
| habit_logs | habitId, date, createdAt | 체크 여부와 달성 수 |
| books | year, order, category, title, oneThing, keywords, reviewUrl, startedAt, finishedAt, 시각 | 독서, 일일 책 선택 |
| weekly_templates | name, blocks(JSON), 시각 | 요일별 계획 시간표 스냅샷 |
| retrospectives | type, dateOrWeek, rating, template, freeText, 시각 | 일·주 회고, 일일 독서 |
| time_blocks | date, startMin, endMin, text, kind, categoryId, goalId, todoId, 시각 | 일일·주간 시간표, 회고 통계 |
| settings | userId, firstDayOfWeek, gridMinutes, dayStartHour, dayEndHour, theme | 공통 표시 설정 |

배열·객체인 monthlyTargets, monthlyActuals, monthlyActualAdjustments, schedule, template은 SQLite TEXT의 JSON으로 저장합니다. 월별 배열은 12개 요소를 전제로 하며 1월 인덱스가 0입니다. 배열 길이를 DB 제약으로 강제하지는 않습니다.

## 3. 관계와 의미

| 연결 | 의미 | 자동 동작 |
|---|---|---|
| goals.parentId → goals.id | One-Thing → 코어 → 서브 | 보드 배치; 일반 서버 DELETE는 자손을 삭제하지 않음 |
| annual_goals.parentGoalId → goals.id | 수치 목표의 상위 방향 | 목표 진행 요약에서 직접 연결 조회 |
| todos.parentGoalId → goals.id | 실행 항목의 상위 목표 | 해당 목표 TODO 진행률 |
| habits.parentGoalId → goals.id | 습관의 상위 목표 | 해당 목표 습관 진행률 |
| habits.annualGoalId → annual_goals.id | 반복과 연간 숫자의 연결 | 일정으로 목표 계산, 연결된 체크 로그로 월 실적 조회 계산 |
| habit_logs.habitId → habits.id | 특정 날짜의 완료 | 체크 토글 |
| time_blocks.todoId → todos.id | 어떤 할 일에 쓴 시간인지 | TODO별 시간 합산; 완료 상태 자동 변경 없음 |
| time_blocks.goalId → goals.id | 어떤 목표에 쓴 시간인지 | 목표별 시간 합산 |
| categoryId → categories.id | 색과 분류 | 표시용; 삭제 시 자동 연결 해제 없음 |

연간·월간·주간·일일 계획은 복사 계층이 아닙니다. 연간 목표 생성으로 월 TODO가 생기지 않고 주 TODO를 완료해도 일 TODO가 완료되지 않습니다. 동일 날짜의 일 TODO나 습관 로그만 여러 화면에서 같은 레코드로 조회합니다.

## 4. 기간 키는 도메인마다 다르다

| 데이터 | scope/type | key 예 |
|---|---|---|
| 일 TODO | day | `2026-09-07` |
| 주 TODO | week | `2026-W37` |
| 월 TODO | month | `2026-09` |
| 연 TODO(타입/API 지원) | year | `2026` |
| 수집함 TODO | inbox | `inbox` |
| 올해 한 문장 | year | `year:2026` |
| 이번 달 한 문장 | month | `month:2026-09` |
| 이번 주 한 문장 | week | `week:2026-W37` |
| 일일 메모 | day | `2026-09-07` |
| 보드 자유노트 | board | `main` |
| 일일 회고 | daily | `2026-09-07` |
| 주간 회고 | weekly | `2026-W37` |

접두사 생성은 [period.ts](../lib/utils/period.ts)에 있습니다. 연 TODO는 타입·API 지원이고 현재 연간 페이지의 표는 AnnualGoal입니다. 서로 혼용하지 않습니다.

## 5. TODO와 PATCH

상태는 pending(대기), done(완료), postponed(연기), delegated(위임), cancelled(취소)입니다. 연기·위임은 상태값 변경이며 날짜를 자동 이동하거나 다른 계정에 업무를 전달하지 않습니다. 완료 토글 API는 done이면 pending, 그 외 상태이면 done으로 바꿉니다.

priority는 1·2·3 또는 `null`입니다. 생성 시 생략할 수 있고 PATCH에서 `null`을 보내면 해제합니다. note는 저장할 수 있지만 모든 TODO UI에서 편집하지는 않습니다.

PATCH는 키 생략/undefined = 변경 없음, null = 선택값 해제, 값 = 교체입니다. `stripUndefined()`는 undefined만 제거합니다. 필드 허용 목록이나 사용자 입력 검증기가 아닙니다. JSON 객체 내부까지 재귀 병합하지도 않습니다.

## 6. 습관 일정과 목표 계산

| schedule | 예 | 월 목표 계산 |
|---|---|---|
| daily | `{ "kind": "daily" }` | 그 달 날짜 수 |
| weekdays | `{ "kind": "weekdays", "days": [1,3,5] }` | 해당 요일 수 |
| perWeek | `{ "kind": "perWeek", "count": 3 }` | `round(3 × 월 날짜 수 / 7)` |
| perMonth | `{ "kind": "perMonth", "count": 5 }` | 5 |

schedule이 없으면 매일로 간주합니다. 요일은 일=0, 월=1, … 토=6입니다. 주간 UI의 월요일부터 표시하는 인덱스와 구별합니다.

`syncAnnualTargets()`는 연결된 습관의 12개월 목표와 연 target을 같은 트랜잭션에서 계산합니다. 마지막 습관 연결을 해제하거나 삭제하면 자동 목표는 0이 됩니다. 월 목표를 모두 지우면 연 목표도 0으로 갱신합니다.

연간 실적은 현재 연결된 습관의 해당 연도 날짜별 로그와 수동 보정값을 합쳐 조회 때 계산합니다. 한 습관의 같은 날짜 중복 로그는 한 번만 셉니다. 습관 연결 변경·삭제에 따라 자동 실적도 즉시 바뀝니다. 월 실적을 수동 입력하면 해당 시점의 자동 실적과의 차이를 내부 `monthlyActualAdjustments`에 보관합니다. 표시값은 0 미만으로 내려가지 않습니다.

마이그레이션 `0005`는 기존 표시 실적을 유지하도록 보정값을 초기화합니다. 예전에 이미 어긋난 실적을 과거 사실대로 복원할 수는 없으므로 기존 표시값을 기준선으로 삼습니다. 새 백업은 보정값까지 함께 내보냅니다. 습관 로그 토글은 즉시 트랜잭션에서 실행합니다. 체크 가능 요일은 UI에서 제한하며 API는 날짜 형식과 습관 소유권을 검사합니다.

## 7. 시간과 진행률 계산

시간블록의 분은 자정부터 지난 분입니다. 09:00~10:30은 startMin=540, endMin=630, 길이 90분입니다. kind는 plan 또는 actual입니다. 계획과 실제를 같은 시간에 별도 저장할 수 있습니다.

| 계산 위치 | 범위와 기준 |
|---|---|
| 주간 GoalCoverageBar | 선택 주 actual만 |
| 주간 회고 WeeklySummary의 실행 통계 | 선택 주 actual만, 일 TODO 완료율 |
| PlanActualComparison | 선택 주 plan/actual을 카테고리별로 각각 합산, 실제−계획 차이 |
| aggregate.ts | 전달받은 모든 블록; 종류 필터 없음 |
| `/api/progress` | 선택 date 기준(생략 시 현재 날짜); actual 시간만 |

목표 진행률은 해당 goalId에 **직접 연결된** 데이터를 계산합니다. 수치 진행은 선택 연도의 연결 연간 목표들을 합산합니다. 습관은 선택 월의 유효한 중복 제거 로그/공통 일정 기대치, TODO는 선택 연·월 및 월과 겹치는 주의 데이터로 제한합니다. 수치·습관·TODO의 존재하는 비율을 단순 평균해 overall로 표시하며 시간은 overall에 포함하지 않습니다.

비율은 100%로 제한합니다. 실제 시간은 선택 주·월·연별 합계이고 연 경계 주의 다른 연도 블록도 포함합니다. 월간/주간 목표 요약은 해당 월/주의 시작 날짜를 전달합니다. 보드 자손 진행을 자동으로 상위 목표에 합산하지 않습니다.

## 8. 회고와 독서 JSON

회고 template은 good·bad·nextStep·reading 필드를 갖습니다. 일일 독서는 reading에 `{bookId?, bookTitle, pages, memo}`를 JSON 문자열로 한 번 더 직렬화합니다. 따라서 template을 파싱한 후 reading도 따로 파싱해야 합니다.

회고 upsert는 즉시 트랜잭션 안에서 기존 행을 읽고 전달된 template 필드만 병합합니다. 클라이언트도 편집한 필드만 보내므로 reading과 good·bad·nextStep을 각각 저장해도 다른 필드를 보존합니다. 같은 필드를 여러 탭에서 동시에 수정하는 경우에는 마지막 서버 쓰기가 반영됩니다.

## 9. 삭제·무결성·내보내기

일반 목표·TODO·카테고리·책 DELETE는 해당 행만 삭제합니다. 연간 목표 DELETE는 연결 습관의 annualGoalId도 해제합니다. 보드 자손 삭제는 클라이언트, 습관 로그 삭제는 서버 습관 함수, 계정 전체 삭제는 CLI의 명시적 여러 테이블 DELETE가 담당합니다. DB CASCADE 삭제가 아닙니다.

기간 조회 인덱스와 사용자 인덱스는 있지만 `habitId+date`, `scope+scopeKey`, `type+dateOrWeek`의 논리상 단일 레코드를 모두 UNIQUE로 강제하지 않습니다. 습관 토글, 회고·한 문장 upsert는 즉시 트랜잭션으로 read/write를 직렬화합니다. 연간 기본 7행 확보도 조회와 부족분 삽입을 같은 즉시 트랜잭션에서 수행합니다. 다른 경로와 외부 직접 DB 쓰기까지 UNIQUE 제약으로 강제하는 것은 아닙니다.

내보내기는 version 11의 11개 배열과 settings를 사용합니다. 주간 템플릿과 새 TODO 필드도 포함하며 이전 필드만 있는 백업은 계속 가져올 수 있습니다. 컬렉션·가져오기 계약은 `lib/backup.ts`, 실제 내보내기 타입은 `lib/server/backup/service.ts`의 `BackupDocument`입니다. [API의 export 응답](03-api.md)이 형식 기준입니다.

## TODO 작업 기록

`sourceRetro`는 `{type:'daily'|'weekly', dateOrWeek}` 형태의 원본 회고 위치이며 ID 외래키가 아닙니다. `repeatRule`은 `{unit:'day'|'week'|'month', interval:1..365, basis:'scheduled'|'completed'}`이고 day TODO에만 허용합니다. 두 필드는 null로 해제할 수 있습니다. `completedAt`과 `repeatGenerated`는 서버가 관리하는 완료 시각·다음 항목 생성 여부이며 JSON 백업에서도 보존합니다.

주간 템플릿의 `blocks`는 `dayOffset`(월=0~일=6), `startMin`, `endMin`, `text`, `categoryId`, `goalId?` 배열입니다. TODO 연결은 포함하지 않습니다. 상세 규칙은 [연결 기능 안내](10-planning-workflow.md)를 확인하세요. 기존 목표 진행률은 직접 연결 기준을 유지하며 `/goal-review`만 자손을 포함합니다.

0006 마이그레이션은 `todo_create_requests`(user_id+request_key 복합 PK, 본문 해시·최초 응답·생성 시각)와 `todo_trash`(TODO ID PK, 소유자·스냅샷·만료 시각)를 추가합니다. 요청 기록은 삭제 이후의 지연 재요청도 새 항목을 만들지 않도록 유지합니다. 휴지통은 30초 후 복원이 차단되고 다음 TODO 삭제 시 만료 행을 정리합니다.

운영용 두 테이블은 SQLite 전체 백업에 포함되며 사용자 JSON 내보내기에는 포함하지 않습니다. JSON replace는 본인의 휴지통을 비우고 요청 기록은 유지합니다. 계정 CLI 삭제는 두 테이블도 함께 삭제합니다.
