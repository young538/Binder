# 1차 소스·문서 대조와 부분 리팩토링 기록

[전체 목차](README.md) · [유지보수 가이드](06-maintenance.md) · [검증 이력](05-verification-and-limitations.md)

이 문서는 **1차 작업 종료 시점의 이력**입니다. 이후 전체 저장소·화면 구조 정리, lint 해소, 가져오기 후 갱신은 [2차 전체 리팩토링 기록](08-full-refactor.md)을 우선합니다.

점검 기준은 **2026-10-29의 작업 트리**입니다. 이미 존재하던 미커밋 구현과 문서를 보존하고 그 위에 수정했습니다. 이전 커밋이나 현재 실행 중인 Docker 이미지와 동일한 상태라는 뜻은 아닙니다.

## 1. 대조 범위

라우트·레이아웃, 기능별 화면과 공통 입력/시간표, 브라우저 repository와 store, 인증·검증·DB repository, Drizzle 스키마·마이그레이션, 백업·설정, 테스트·Docker·운영 스크립트를 연결해 확인했습니다. 의존성 소스 전체나 모든 UI 분기를 전수 검증한 것은 아닙니다. Next.js 작업은 설치된 16.2.4의 `node_modules/next/dist/docs/`를 기준으로 했습니다.

| 문서 묶음 | 확인·수정 내용 |
|---|---|
| README / docs 목차 | 현재 화면, 문서 진입점, 점검 기준일과 새 유지보수 문서 연결 |
| AGENTS / CLAUDE | 한국어 변경 지침·검증 명령·책임 경계 보강, CLAUDE의 AGENTS 참조 확인 |
| 구조 / 데이터 모델 | 루트의 일일 이동, 공통 TODO 입력, DB·백업·시간표 책임, 실제 백업 타입 반영 |
| API 명세 | 필드/HTTP 검증 경계, import 원자성·소유권, export 읽기 트랜잭션 대조 |
| 로그인 / One-Thing / 연간 / 독서 | 라우트·컴포넌트·저장 경로·화면 연결 설명 대조 |
| 월간 / 주간 / 일일 | TODO 입력·우선순위, 공통 시간표, 루트 이동, 실제 습관 편집 위치 반영 |
| 회고 | 일일 인라인 기록과 주간에서 여는 시트 구분 |
| 설정 | 시간 범위 검증, 다른 사용자 ID 충돌 거절, 가져오기 후 연간 집계 보정 설명 수정 |
| 개발·운영 | 유효한 lint 명령, 안전한 환경 초기화, Compose 프로젝트명 binder, DB 연결 실패 처리 |
| RUNBOOK | 당시 장애·배포 이력으로 정리, 현재 절차와 중복된 오래된 복구 예시 제거 |
| INSTALL 두 문서 / Study | 현재 운영·구조 문서로 연결되는 안내 확인 |
| 검증·한계 | 과거 배포 이력을 유지하고 이번 로컬 검증과 남은 제약 구분 |

문서 안의 상대 파일 링크는 `npm run docs:check`로 추가 검사합니다. 외부 도메인·당시 IP·인증서 정책은 과거 기록으로 표시하며 현재 네트워크 사실로 재확인한 것은 아닙니다.

## 2. 확인한 문제와 반영한 수정

| 문제 | 수정·보호 조건 |
|---|---|
| TODO Enter/blur 중복 제출, 한글 조합 Enter 조기 제출 | 공통 TodoCreateInput, 동기 ref 잠금, IME·반복 키 처리, 실패 시 초안 보존 |
| 월간 TODO 우선순위 3에서 해제 불가 | JSON에서 생략되는 undefined 대신 null 전송, null→1 순환 처리 |
| 월간 빈 습관 안내가 옛 설정 위치를 가리킴 | 현재 일일 루틴 관리로 안내 수정 |
| DB 초기화 실패 후 불완전한 연결이 캐시될 수 있음 | DatabaseConnection이 성공 후 캐시, 실패 시 닫고 다음 접근에서 재시도 |
| 백업 route에 SQL·검증·트랜잭션이 집중 | BackupService와 사용자별 repository 분리, 검증부터 쓰기까지 한 즉시 트랜잭션 |
| 설정 기본값 중복, 읽기/병합/쓰기 경계 분산 | DEFAULT_SETTINGS와 SettingsRepository로 통합, 병합 검증과 저장을 원자적으로 처리 |
| 시간표에 계산과 저장 정책이 섞임 | Geometry와 Commands 추출, 이벤트에서 드래그 ref/state 갱신 |
| 검증 규칙이 HTTP·DB에 결합 | 순수 필드 규칙과 서버 참조 검증 분리, 기존 import 경로는 재노출로 호환 |
| next lint와 실제 설치 버전 불일치 | ESLint CLI로 교체, typecheck·docs:check 명령 추가 |
| Docker 빌드 컨텍스트에 운영 환경·백업 포함 가능 | app.env·backups·테스트/임시 작업 폴더 제외 |

기존 API URL·백업 version 10·DB 스키마는 이번 리팩토링에서 바꾸지 않았습니다. 기존 함수형 repository 진입점을 유지하고 변경 위험이 큰 경계부터 객체로 분리했습니다. 사용하지 않는 예전 BinderData 타입을 제거하고 실제 export 결과에서 BackupDocument를 유도합니다.

## 3. 1차 검증 결과

| 검사 | 결과 |
|---|---|
| `npm test -- --maxWorkers=4 --reporter=dot` | **19개 파일·117개 통과**; 시작 시 15개 파일·96개 통과 |
| Playwright 관련 4개 파일 | **16개 통과**: todo-create 4, daily-drag 3, week-input 8, multiuser 1 |
| `npm run typecheck -- --incremental false` | 통과 |
| `npm run build` | Next.js 16.2.4 프로덕션 컴파일·TypeScript·페이지 생성 통과 |
| `npm run docs:check` | 24개 Markdown 문서의 상대 파일 링크 오류 없음 |
| 새 객체·검증·TODO 공통 입력·교체 API·관련 테스트 대상 ESLint | 오류·경고 없음 |
| 전체 ESLint | **실패: 기존 오류 20개·경고 3개**; 시작 시 오류 20개·경고 4개 |
| `git diff --check` | 통과 |

TODO 회귀 테스트는 수정 전 Enter/blur/Enter에서 생성 함수가 3회 호출되고 한글 조합 Enter도 제출되는 문제를 재현했습니다. 수정 후 브라우저에서 일일 PC 1280px·모바일 390px, 주간, 월간의 POST 요청 1회와 API 재조회 결과 1행을 확인했습니다. 단위 테스트는 실패 재시도·Escape 취소, 월간 우선순위 해제까지 포함합니다.

백업 테스트는 10개 컬렉션 왕복, 사용자 격리, 설정 보존, SQL trigger로 중간 삽입을 실패시킨 전체 롤백을 확인합니다. DB 연결 테스트는 실제 마이그레이션 적용, 초기화 중단 롤백, 닫힌 연결의 재시도를 확인합니다. 테스트 DB와 계정을 사용했으며 운영 DB에 테스트 데이터를 쓰지 않았습니다. 전체 E2E를 모두 실행한 결과는 아니며 위 4개 파일을 실행했습니다.

당시 전체 lint의 미해결 항목은 다음과 같습니다. 2차 작업에서 모두 해소했으며 아래 표는 이력을 보존한 것입니다. 규칙을 끄지 않았으며 빌드 성공과 별도로 남겨 둡니다.

| 규칙 | 개수 | 위치 |
|---|---|---|
| react-hooks/set-state-in-effect | 오류 13 | SubCard, CollapsibleSection, TodoTitleEditor, DailyPage/Reading/TimeBlocks, HabitEditor, ConnectedItemsPanel, MandalartBoard, GoalSummaryStrip, HabitCalendar, DayListView |
| react-hooks/refs | 오류 5 | TimeGrid, MandalartBoard, BlockEditor 2곳, useAutosaveRecord |
| react-hooks/immutability | 오류 1 | HabitEditor의 선언 이전 함수 참조 |
| prefer-const | 오류 1 | daily-drag.spec.ts |
| 접근성·effect 의존성·미사용 변수 | 경고 3 | TodoTitleEditor, HabitEditor, parse-binder.mjs |

TimeGrid와 HabitCalendar도 기존 lint 지적이 남은 파일입니다. DayTodoDrawer의 effect 의존성 경고는 날짜별 조회의 cleanup을 명시해 해결했습니다. 기존 effect와 자동 저장의 생명주기 전반을 바꾸는 작업은 이번 경계 분리와 별도로 검증이 필요합니다.

## 4. 1차 종료 시 남았던 범위

백업의 버전별 데이터 변환, 전체 논리 참조의 DB 외래키 제약, 기기 간 실시간 갱신, import 이후 전체 store 재초기화는 추가 구현 대상입니다. TODO 수정은 한 입력 세션의 이벤트 중복을 방지하며, 서버의 요청별 멱등성 키를 추가한 것은 아닙니다.

기존 큰 화면 컴포넌트와 함수형 CRUD repository 전체를 클래스화하지 않았습니다. 새로운 정책은 이번에 만든 책임 경계를 사용해 확장하고, 다른 기능은 관련 변경을 할 때 나눕니다. 상세 동작 제약은 [검증과 현재 구현 한계](05-verification-and-limitations.md)를 유지합니다.

이번 변경은 로컬 소스·문서·검증 결과입니다. Docker 이미지 재빌드와 운영 배포는 수행하지 않았습니다.
