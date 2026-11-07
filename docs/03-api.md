# API 명세

[전체 목차](README.md) · [데이터 모델](02-data-model.md)

기준: [app/api](../app/api), [브라우저 repository](../lib/repo), [서버 repository](../lib/server/repos). 모든 URL은 같은 앱 origin의 경로입니다.

## 1. 공통 계약

요청·응답은 JSON이 기본이며 세션 쿠키를 사용합니다. 브라우저 공통 wrapper는 `credentials: same-origin`을 지정합니다. 로그인 외 도메인 API는 공통 `authenticated()` 경계에서 `requireSession()`을 호출합니다. 인증 실패 Response는 그대로 반환하며 실제 DB·설정 예외를 인증 실패로 바꾸지 않습니다. 도메인 핸들러는 `getUserRepositories(session.userId)`로 저장소를 조립합니다. 로그아웃은 세션을 읽어 파기하며 proxy의 인증 경로에 속합니다.

- 생성 성공은 대부분 201과 생성 행입니다.
- 목록은 JSON 배열입니다.
- ID PATCH와 완료 토글은 대상이 없거나 다른 사용자 소유면 404입니다.
- 일반 DELETE는 대상 유무와 관계없이 `{ "ok": true }`입니다. TODO 삭제는 복원 가능한 경우 `undo: {id, expiresAt}`도 반환합니다.
- 기간 단건 조회인 focus-notes·retrospectives는 없으면 200과 null입니다.
- 인증 실패는 proxy에서 JSON 401, requireSession에서 텍스트 401일 수 있습니다.
- 기본 오류 객체는 `{ "error": "설명" }`이며 도메인 DB 예외가 모두 이 형식으로 정규화되지는 않습니다.

변경 API는 `lib/server/validation.ts`에서 요청·DB 참조를 확인하고, `lib/validation/mutations.ts`의 순수 입력 규칙으로 필드와 관계를 검증합니다. 알 수 없는 필드와 id·userId·생성/수정 시각 등 서버 관리 필드는 400으로 거절합니다. 날짜·ISO 주차·상태·일정·시간 범위·12개월 배열을 검사하고, 전달한 참조 ID는 현재 사용자 소유인지 확인합니다. PATCH는 기존 값과 합친 시간 구간·기간 키도 검사합니다. 이 계약은 HTTP 경계에 적용되며 내부 repository 호출은 신뢰된 호출로 취급합니다.

## 2. 인증

| 메서드·경로 | 입력 | 응답 |
|---|---|---|
| POST `/api/auth/login` | username, password | `{ok:true}` + 쿠키; JSON 오류/누락 400, 인증 실패 401 |
| POST `/api/auth/logout` | 없음 | `{ok:true}`, 세션 파기 |
| GET `/api/auth/me` | 없음 | `{userId, username}` |

## 3. ID별 CRUD 도메인

아래 7개 도메인은 공통으로 목록/생성 경로와 ID별 PATCH·DELETE를 제공합니다. **GET `/도메인/[id]`는 구현하지 않습니다.**

| 도메인 | GET 목록 쿼리 | POST 정상 입력 | PATCH 수정 필드 |
|---|---|---|---|
| `/api/goals` | 없음 | title, level, order, parentId?, color? | title, level, parentId, color, order |
| `/api/categories` | 없음 | name, color, order | name, color, order |
| `/api/todos` | 아래 별도 설명 | title, scope, scopeKey, status, order, parentGoalId?, priority?, categoryId?, note?, repeatRule?, sourceRetro? | 동일 도메인 필드; completedAt/repeatGenerated는 수정 불가 |
| `/api/annual-goals` | `year` 필수 | year, order 또는 year, ensureSeven:true | year, order, title, deadline, action, metric, target, monthlyTargets, monthlyActuals, parentGoalId |
| `/api/habits` | 없음 | name, color, order, schedule?, categoryId?, note?, parentGoalId?, annualGoalId? | 동일 도메인 필드 |
| `/api/books` | `year` 필수 또는 `all=true`로 모든 연도 | year, order, title, category?, oneThing?, keywords?, reviewUrl?, startedAt?, finishedAt? | 동일 도메인 필드 |
| `/api/time-blocks` | `startDate`, `endDate` 필수 | date, startMin, endMin, text, kind, categoryId, goalId?, todoId? | 동일 도메인 필드 |

예를 들어 책 수정은 PATCH `/api/books/[id]`, 삭제는 DELETE `/api/books/[id]`입니다. `?`는 정상 생성 입력에서 선택 가능한 필드를 뜻합니다. null로 지울 수 있는 필드는 [공통 타입](../lib/types.ts)을 확인합니다.

annual-goals의 일반 POST는 빈 제목과 12개의 null 계획·실적 배열을 만듭니다. `ensureSeven:true`면 최소 7개를 확보한 전체 배열을 200으로 반환합니다. 현재 행 조회와 부족분 삽입을 한 즉시 트랜잭션으로 처리해 동시 초기화가 중복 행을 만들지 않게 합니다. 일반 POST는 year·order만 허용하며 제목은 이후 PATCH합니다.

## 4. TODO 조회와 상태

`GET /api/todos`는 다음 우선순위를 사용합니다.

1. startDate와 endDate가 모두 있으면 해당 범위의 day TODO만 조회합니다.
2. 그 외에는 scope, scopeKey, parentGoalId 중 주어진 조건들을 AND로 조회합니다.
3. 조건이 없으면 본인 TODO 전체를 반환합니다.

예: `/api/todos?scope=day&scopeKey=2026-09-07`, `/api/todos?parentGoalId=...`, `/api/todos?startDate=2026-09-01&endDate=2026-09-30`.

`POST /api/todos/[id]/toggle-done`은 body 없이 done↔pending을 전환합니다. done 외 상태는 done이 됩니다. 임의 상태 선택은 일반 PATCH `{status:"postponed"}` 같은 요청입니다. 현재 공통 UI는 다섯 상태 선택 메뉴를 사용합니다.

우선순위는 1·2·3이며 PATCH `{priority:null}`로 해제합니다. 키 생략은 기존 값을 유지합니다. 생성 API는 같은 제목의 여러 TODO를 허용합니다. `Idempotency-Key` 헤더(영문·숫자·밑줄·하이픈, 8~128자)를 보내면 사용자+키별로 한 번만 생성하고 같은 본문 재요청에 최초 응답을 반환합니다. 같은 키에 다른 본문은 409, 잘못된 키는 400입니다. 헤더가 없는 기존 클라이언트는 매 요청을 생성합니다. 공통 입력은 한글 조합·Enter/blur 잠금을 적용하고 실패 후 동일 초안 재시도에 최초 키와 본문을 재사용합니다.

| 메서드·경로 | 입력 | 응답 |
|---|---|---|
| DELETE `/api/todos/[id]` | 없음 | `{ok:true, undo?:{id, expiresAt}}`; 30초 동안 복원 가능 |
| POST `/api/todos/[id]/restore` | 없음 | 같은 ID의 복원된 TODO; 없음/다른 사용자 404, 만료 410 |
| POST `/api/todos/rollover` | `{date:"2026-12-31", ids:["..."]}` | `{moved:1, date:"2027-01-01"}` |

이월은 현재 사용자의 지정 날짜 day TODO 중 선택 ID의 pending·postponed만 다음 날 끝으로 이동합니다. ID·카테고리·목표·상태는 유지하고 시간블록은 옮기지 않습니다. IDs는 1~500개이며 재요청 시 이미 이동한 행은 0개 처리합니다. 삭제·복원 재요청도 중복 행을 만들지 않습니다. 복원 시 삭제된 카테고리·목표 연결은 null이 됩니다.

## 전체 검색

수집함 TODO도 동일한 검색에 포함되며 결과는 `/inbox`로 이동합니다.

`GET /api/search?q=검색어&type=todos&offset=0`은 인증 사용자 소유 데이터만 검색합니다. 검색어는 trim 후 1~100자, type은 생략하거나 todos·goals·annualGoals·habits·books·focusNotes·retrospectives·timeBlocks·categories, offset은 0~10000 정수입니다. 잘못된 값은 400입니다.

응답은 `{items:[{kind,id,title,excerpt,period,href}], offset, hasMore}`이고 한 페이지는 20개입니다. 최근 수정 순(동률은 kind·id)으로 정렬하며 `%`, `_`, 따옴표도 일반 문자로 검색합니다. 반환 링크는 관련 화면이며 항목 자동 강조나 직접 편집은 제공하지 않습니다.

## 5. 기간별 메모·회고·습관 로그

| 메서드·경로 | 입력 | 응답 |
|---|---|---|
| GET `/api/focus-notes` | 쿼리 scope, scopeKey 필수 | FocusNote 또는 null |
| PUT `/api/focus-notes` | scope, scopeKey, text | 저장된 FocusNote |
| GET `/api/retrospectives` | 쿼리 type, dateOrWeek 필수 | Retrospective 또는 null |
| PUT `/api/retrospectives` | type, dateOrWeek, rating?, template?, freeText? | 저장된 Retrospective |
| GET `/api/habit-logs` | 쿼리 startDate, endDate 필수 | HabitLog 배열 |
| POST `/api/habit-logs` | habitId, date | `{added:true}` 또는 `{added:false}` |

범위는 양 끝을 포함합니다. 습관 로그 POST는 완료 값을 지정하는 멱등 API가 아니라 토글입니다. 같은 요청을 두 번 보내면 원래 상태로 돌아옵니다. 별도 로그 ID 수정·삭제 경로는 없습니다.

회고 PUT은 기존 레코드의 최상위 필드를 부분 수정하지만 template이 제공되면 명시한 필드만 병합합니다. 다음 두 요청의 저장 위치는 다릅니다.

```json
{"scope":"day","scopeKey":"2026-09-07","text":"오늘의 일반 메모"}
```

```json
{"type":"daily","dateOrWeek":"2026-09-07","template":{"good":"운동을 마침"},"rating":4}
```

## 6. 설정과 목표 진행률

| 메서드·경로 | 입력 | 응답 |
|---|---|---|
| GET `/api/settings` | 없음 | 사용자 설정 또는 기본값; userId 제외 |
| PATCH `/api/settings` | firstDayOfWeek?, gridMinutes?, dayStartHour?, dayEndHour?, theme? | 저장된 설정, 없던 행이면 생성 |
| GET `/api/progress?goalId=...` | 단일 ID | GoalProgress |
| GET `/api/progress?goalIds=a,b` | 쉼표 구분 ID | ID를 키로 하는 객체 |

goalId가 있으면 goalIds보다 우선합니다. 둘 다 없으면 400입니다. `date=YYYY-MM-DD`를 선택적으로 전달합니다. 생략하면 서버 현재 날짜가 기준이며 잘못된 날짜는 400입니다. 잘못된 목표 ID에 반드시 404를 반환하는 API가 아니라 해당 ID로 연결 데이터를 계산합니다.

GoalProgress는 goalId, numeric?, habits?, todos?, timeInvested, overall입니다. timeInvested는 weekMin·monthMin·yearMin, overall은 존재하는 수치·습관·TODO 비율의 평균입니다. [계산 범위](02-data-model.md)를 확인하세요.

## 7. Export와 Import

`GET /api/export`의 응답 구조:

```json
{
  "version": 11,
  "generatedAt": "ISO 시각",
  "goals": [], "categories": [], "timeBlocks": [],
  "retrospectives": [], "todos": [], "focusNotes": [],
  "annualGoals": [], "habits": [], "habitLogs": [], "books": [], "weeklyTemplates": [],
  "settings": null
}
```

`POST /api/import` 입력은 `{ "mode": "merge", "data": { ...내보낸 데이터... } }`입니다. mode는 UI에서 merge 또는 replace를 사용합니다. 서버는 mode enum, 데이터 컬렉션·필드·참조를 사전 검증합니다. version을 기준으로 자동 변환하는 기능은 없습니다.

각 행의 userId는 로그인 사용자로 강제 교체합니다. 다른 계정 ID와의 충돌은 사전 검증에서 거절하고, 같은 계정의 기존 ID는 `onConflictDoNothing()`으로 건너뜁니다. merge는 기존 행 갱신이 아닙니다. replace는 본인 도메인 행을 먼저 삭제합니다. settings는 전달될 때만 upsert하며 replace 삭제 대상에서 제외됩니다.

`BackupService`가 사전 검증과 전체 쓰기를 같은 즉시 트랜잭션 안에서 실행합니다. 내보내기도 하나의 읽기 트랜잭션을 사용합니다. 성공은 `{ok:true, mode, counts}`입니다. 사전 검증 실패는 400이며, 쓰기 중 DB 실패는 500 오류와 롤백입니다. counts는 시도한 입력 수이며 실제 삽입 수가 아닙니다. 가져오기는 `UserBackupRepository`가 컬렉션을 삽입한 뒤 연간 실적 기준선을 보존하고, 연결된 습관의 연·월 목표를 재계산합니다. merge의 기존 실적 기준선은 삽입 전에도 보존합니다.

## 8. 클라이언트 오류와 갱신

`lib/repo/http.ts`는 401 리다이렉트, 비정상 응답의 error 메시지 추출, JSON 직렬화를 담당합니다. 도메인 mutation 함수는 성공 후 `notifyMutation()`을 호출하지만 화면이 그 알림을 구독해야 갱신됩니다.

로그인과 설정의 import/export는 자체 fetch를 사용하므로 공통 wrapper의 오류 처리와 정확히 같지 않습니다. API에 없는 정렬·검색·집계 기능을 URL 쿼리만 붙여 사용할 수는 없습니다.

## 계획·실행 연결 API (2026-11-06)

모든 경로는 인증 사용자 소유 데이터만 처리합니다. 다른 사용자 소유의 템플릿 적용·책 상세는 404입니다. 잘못된 날짜·주차·본문은 400입니다.

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| GET `/api/weekly-templates` | 없음 | WeeklyTemplate 배열 |
| POST `/api/weekly-templates` | `{name, sourceWeek:"2026-W53"}` | 201, 현재 주 계획의 스냅샷; 계획 1~500개 필요 |
| DELETE `/api/weekly-templates/[id]` | 없음 | `{ok:true}`; 적용한 시간블록은 유지 |
| POST `/api/weekly-templates/[id]/apply` | `{week:"2027-W01"}` | `{added, skipped}`; 원자적 적용, 기존 항목은 수정하지 않음 |
| GET `/api/books?all=true` | 없음 | 모든 연도의 본인 책 배열 |
| GET `/api/books/[id]/history` | 없음 | `{bookId,title,totalPages,readingDays,entries:[{date,bookId,bookTitle,pages,memo}]}` |
| GET `/api/goal-review?date=2026-12-31` | 기준 날짜 | `{start,end,goals:[{goal,descendantCount,pendingTodos,completedTodos,habits,actualMinutes,inactive}]}` |

수집함 조회는 `/api/todos?scope=inbox&scopeKey=inbox`입니다. 회고 연결·반복 생성은 기존 TODO POST/PATCH와 상태 토글 경로를 사용합니다. 선택 필드 `sourceRetro={type,dateOrWeek}`와 `repeatRule={unit,interval,basis}`를 허용합니다. 두 필드의 null은 해제입니다. `completedAt`·`repeatGenerated`는 일반 POST/PATCH에서 거절하며 서버 응답·백업에는 포함합니다. 회고 생성 요청은 같은 원본·제목·기간의 기존 항목이 있으면 이를 반환합니다. 일반 TODO는 제목 중복을 허용합니다.

반복은 done이 아닌 상태에서 done으로 바뀔 때만 다음 날짜 항목을 생성합니다. 전체 저장 규칙과 예시는 [연결 기능 안내](10-planning-workflow.md)를 확인하세요.

## 기존 입력 검증과 백업 호환성

잘못된 JSON과 허용되지 않는 변경 필드는 400 오류입니다. 선택 연결의 null 해제는 유지합니다. 가져오기는 삭제/병합 전에 전체 payload와 참조를 검증합니다. 다른 계정 ID와 충돌하거나 존재하지 않는 참조를 담은 백업은 거절하며, replace 검증 실패 시 기존 데이터를 삭제하지 않습니다. 과거에 삭제된 대상을 가리키는 백업은 해당 연결을 정리한 뒤 가져와야 합니다.

연간 목표 export에는 계산된 monthlyActuals와 내부 monthlyActualAdjustments가 함께 포함됩니다. 일반 목표 PATCH로 보정값을 직접 보내는 것은 허용하지 않으며, 정상 백업 가져오기에서만 복원합니다. 회고 PUT의 template은 전달한 개별 필드만 병합하고 생략된 필드는 보존합니다.

한 문장(`focus-notes`) upsert는 사용자·scope·scopeKey 조회와 생성/수정을 즉시 트랜잭션으로 묶습니다. 최초 저장이 동시에 요청돼도 이 저장 경로에서 같은 논리 키의 행을 중복 생성하지 않습니다. DB 스키마에 모든 논리 키의 UNIQUE 제약을 추가한 것은 아닙니다.
