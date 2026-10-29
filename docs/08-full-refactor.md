# 전체 계층 리팩토링 기록

[전체 목차](README.md) · [유지보수 방법](06-maintenance.md) · [1차 점검 이력](07-source-doc-audit.md)

기준: **2026-10-29 로컬 작업 트리**. 앞선 작업은 DB·백업·시간표 정책과 TODO 중복 생성 수정에 집중한 부분 리팩토링이었습니다. 이번에는 서버 저장소 전체, API 인증 경계, 클라이언트 조회·전송·공통 상태, 큰 화면의 동작과 표시까지 범위를 확장했습니다. 작업 시작 전부터 있던 미커밋 변경을 보존했습니다.

## 1. 서버의 책임 분리

- [UserRepositories](../lib/server/repos/index.ts)가 DB와 인증된 사용자 ID를 받아 목표·카테고리·TODO·시간블록·연간 목표·습관·습관 로그·책·한 문장·회고·설정 **11개 저장소**를 조립합니다. 각 저장소는 조회·수정의 사용자 조건과 SQL을 소유합니다.
- 기존 함수형 export는 클래스에 위임하는 호환 진입점입니다. 새 API는 `getUserRepositories(session.userId).todos.update(id, patch)`처럼 호출하고, 테스트는 `new UserRepositories(testDb, userId)`로 운영 연결을 분리합니다.
- [authenticated](../lib/server/http.ts)가 23개 라우트 파일의 세션 처리 중복을 없앱니다. 인증 실패 Response만 반환하고 실제 설정·DB 오류는 숨기지 않습니다. 입력 검증과 HTTP 상태코드는 각 라우트에 남습니다.
- [GoalProgressService](../lib/server/progress.ts)는 DB·사용자·기준 날짜를 받아 집계합니다. 브라우저와 서버의 결과 타입은 [공통 계약](../lib/progress/types.ts)을 사용합니다.
- 한 문장 최초 upsert와 연간 기본 7행 확보는 조회부터 쓰기까지 즉시 트랜잭션으로 묶어 동시 요청의 중복 생성을 막았습니다.

기존 DatabaseConnection, BackupService, UserBackupRepository와 순수 검증·집계 모듈도 유지합니다. API URL·JSON 계약·백업 version 10·DB 스키마와 마이그레이션은 이번 단계에서 변경하지 않았습니다.

## 2. 브라우저 상태와 저장 흐름

| 구성 | 책임과 보호하는 동작 |
|---|---|
| [HttpClient](../lib/client/HttpClient.ts) | 주입 가능한 전송, JSON 오류, 인증 만료, null 해제·undefined 생략·204 응답 |
| [AsyncResource](../lib/client/AsyncResource.ts) / [useAsyncResource](../lib/hooks/useAsyncResource.ts) | 사용자·조회 키별 상태, 오래된 응답 무시, 실패 시 마지막 값 보존, 변경 리소스 구독 |
| [createBinderStore](../store/createBinderStore.ts) | 초기화 Promise 공유, 전체 성공 후 반영, 실패 재시도, 조회 완료 순서 역전 방지 |
| [useLatest](../lib/hooks/useLatest.ts) | 렌더 중 ref 쓰기 없이 최신 저장 콜백 제공 |
| [useStoredBoolean](../lib/hooks/useStoredBoolean.ts) | 접힘 설정 구독, SSR 초기값, localStorage 차단 시 메모리 대체 |
| [AutosaveQueue](../lib/autosave/queue.ts) | 순차 저장·보류값 병합·flush, 루틴 순서 저장의 350ms 지연 |
| [백업 클라이언트](../lib/repo/backup.ts) | 가져오기 완료 후 리소스 변경 알림; 패널에서 공통 store 재조회 |

StoreProvider에 초기 조회 실패 메시지와 재시도를 추가했습니다. 가져오기 성공 후 카테고리·목표·설정이 현재 화면에 반영되며, 저장 성공과 후속 재조회 실패를 구분해 안내합니다. 날짜·연도·대상 변경 시 이전 조회가 새 화면을 덮어쓰지 않도록 일일·연간·월간·독서·회고·목표 연결 화면의 조회를 공통화했습니다.

## 3. 큰 화면의 분리

줄 수는 이번 단계 시작 사본과 최종 파일의 비교이며, 삭제량이나 품질 점수가 아닙니다. 동작이 아래 전용 파일로 옮겨졌습니다.

| 기존 중심 파일 | 이전 → 이후 | 분리한 책임 |
|---|---:|---|
| TimeGrid.tsx | 725 → 484 | useTimeGridInteraction: 포인터·드래그·취소, Geometry/Commands: 계산·저장 정책 |
| DailyPage.tsx | 565 → 309 | useDailyTracker: 조회·그룹·진행률·체크·프리셋, HabitCheckRow: 행 표시 |
| HabitEditor.tsx | 390 → 55 | useHabitEditor: 일정·정렬 저장, HabitRow: 편집 행 |
| AnnualGoalTable.tsx | 496 → 29 | useAnnualGoals: 조회·변경, AnnualGoalDesktop/Mobile: 반응형 표시 |
| BlockEditor.tsx | 387 → 227 | useBlockEditor: 폼 상태·키보드·저장/삭제 잠금 |

React UI는 함수 컴포넌트로 유지합니다. 연결·사용자 범위·조회 상태·저장 정책에는 객체와 의존성 주입을 사용하고, 계산에는 순수 함수를 사용합니다. 상속이나 범용 BaseRepository를 추가하지 않았습니다.

## 4. 검증

| 검사 | 결과 |
|---|---|
| Vitest 전체 | **23개 파일·131개 통과**; 이번 단계 시작 시 117개 |
| Playwright 전체 시나리오 | **32개 통과 확인**; 아래 실행 내역 참조 |
| `npm run lint -- --max-warnings 0` | 오류·경고 0개; 기존 오류 20개·경고 3개 해소 |
| `npm run typecheck -- --incremental false` | 통과 |
| `npm run build` | Next.js 16.2.4 컴파일·TypeScript·27개 페이지 생성 통과 |
| `npm run docs:check` | 25개 Markdown 문서, 상대 파일 링크 오류 0개 |
| `git diff --check` | 통과 |

브라우저 전체 31개 실행에서 30개가 통과했고, weekly-efficiency는 리팩토링 이전부터 없던 입력란을 기다리는 오래된 준비 단계에서 실패했습니다. 현재 일일 화면 제목으로 준비 조건을 고친 뒤 이 테스트와 신규 settings-import를 실행해 2개 모두 통과했습니다. 두 실행을 합쳐 현재 32개 시나리오를 확인한 결과이며 한 번의 32개 일괄 실행 결과는 아닙니다.

검증에는 TODO 한글 조합·Enter/blur 중복 방지, 일일/주간 시간블록 CRUD·드래그·복사, PC/모바일 전환, 습관·독서·회고 저장, 계정 격리, 가져오기 후 화면 갱신이 포함됩니다. 새 단위 테스트는 지연 응답·초기화 실패/재시도·전송 계약·저장소 주입·인증 경계·초기 행 중복 방지를 확인합니다. 스크린샷 생성 테스트는 기준 이미지와의 픽셀 비교가 아닙니다.

## 5. 문서와 유지보수 기준

AGENTS, README·목차, 구조·API·운영·유지보수·검증 문서와 연간·주간·일일·회고·독서·설정의 구현 파일 안내를 현재 코드에 맞췄습니다. 1차 점검과 과거 배포 기록은 당시 결과로 표시해 보존했습니다. 데이터 모델·로그인·One-Thing·월간 문서도 관련 저장 경로와 기능 설명을 다시 대조했습니다.

새 필드는 타입·검증·저장소·API·화면·백업을 함께 확인하고, 화면 기능은 해당 훅에서 변경합니다. 구체적인 작업 순서와 예는 [유지보수 가이드](06-maintenance.md)에 있습니다.

## 6. 범위 밖의 기능과 운영 상태

논리 참조 전체의 DB 외래키 제약, 과거 백업의 버전별 자동 변환, 기기 간 실시간 동기화, TODO 요청 멱등성 키는 별도 기능입니다. 이번 리팩토링 완료와 이 기능들의 구현 여부는 구분합니다. 현재 동작의 제약은 [검증과 구현 한계](05-verification-and-limitations.md)에 남겼습니다.

리팩토링 검증은 분리된 테스트 DB를 사용했으며 그 단계에서는 운영 배포를 하지 않았습니다. 이후 사용자의 배포 요청에 따라 아래와 같이 Docker에 반영했습니다.


## 7. Docker 운영 배포 (2026-10-29 19:16 KST 확인)

기존 Compose 프로젝트 `binder`에서 `docker compose -p binder build app`으로 검증된 작업 트리를 빌드하고, `up -d --no-deps --no-build --pull never --wait --wait-timeout 90 app`으로 앱 컨테이너를 교체했습니다. Caddy는 기존 프로세스와 인증서 볼륨을 유지했습니다.

| 항목 | 결과 |
|---|---|
| 배포 이미지 | `super-planner:deploy-20261029-191113`, 이미지 ID `fc0a016e489b` |
| Next 빌드 ID | `_KpaPmh3E4NKvWnpKyFDY` |
| 앱 상태 | healthy, 재시작 횟수 0 |
| HTTP | localhost:3000/login, 로컬 Caddy HTTPS, 공개 HTTPS 모두 200 |
| 인증된 API | 기존 2개 계정, 조회 28건 모두 200, 응답 소유권 확인 |
| 비인증 API | 401 |
| DB | integrity_check=ok; 12개 테이블 전체 행의 해시가 배포 전 백업과 동일 |
| TODO 수정 | 새 이미지의 브라우저 번들에 공통 입력 수정 포함 확인 |
| 앱 로그 | 새 컨테이너 시작 이후 확인 범위에서 오류 없음 |

DB는 SQLite 온라인 backup API로 보관했고 호스트 복사본의 SHA-256도 대조했습니다. 파일은 `backups/binder-before-deploy-20261029-191113.sqlite`, 세부 결과는 같은 폴더의 `deployment-20261029-191113.json`과 `deployment-20261029-191113-verification.json`입니다. 백업에는 개인정보가 있으므로 Git에 추가하지 않습니다.

인증 조회는 컨테이너 내부에서 짧은 유효기간의 점검 세션을 생성해 읽기 전용으로 수행했습니다. 세션·비밀값·데이터 내용은 로그에 출력하지 않았고, 실제 사용자 비밀번호로 로그인하거나 운영 TODO를 생성하는 테스트는 하지 않았습니다. 환경의 DB 경로·세션 키·초기 계정 이름·비밀번호 해시는 기존 컨테이너와 같은 값입니다.

이전 이미지는 `super-planner:rollback-20261029-191113`로 보관했습니다. 이번 배포에 DB 변경이 없으므로 코드 복구가 필요하면 해당 이미지를 latest로 태그한 뒤 같은 Compose 앱을 `--no-build --pull never`로 재생성합니다. DB 백업 복원은 별도 데이터 복구가 필요한 경우에만 [운영 절차](04-development-and-operations.md)를 따릅니다.

### 남은 의존성 보안 경고

배포 중 실행한 `npm audit --omit=dev --json` 결과는 의존 패키지 기준 **critical 1, high 4, moderate 1**입니다. Next.js 16.2.4와 관련 의존성에 기존 보안 경고가 남아 있으며 npm은 Next 16.4.3으로의 갱신을 해결 경로로 보고했습니다. 이번 배포는 이미 검증한 버전으로 수행했고 패키지 버전은 바꾸지 않았습니다. 프레임워크 보안 업데이트와 호환성 검증은 후속 유지보수 대상입니다.
