# Repository Guidelines

Super 플래너(Binder)는 목표·일정·습관·독서·회고를 관리하는 다중 사용자 앱입니다. Next.js 16.4.3 App Router, React 19, TypeScript, Tailwind CSS 4, Zustand, SQLite와 Drizzle ORM을 사용합니다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 프로젝트 구조와 변경 위치

| 경로 | 역할 |
| --- | --- |
| `app/` | 페이지·레이아웃·`app/api/` HTTP 핸들러. `(app)`은 로그인 이후 라우트 그룹 |
| `components/` | `daily/`, `week/`, `annual/` 등 기능별 화면과 `common/` 공통 UI |
| `lib/repo/`, `lib/client/`, `lib/hooks/` | 브라우저 API, 비동기 리소스, 공통 React 훅 |
| `lib/server/` | 인증, 입력 검증, `db/` 연결·스키마, `repos/` SQL 처리 |
| `lib/types.ts`, `store/` | 공통 도메인 타입과 Zustand 상태 |
| `drizzle/`, `scripts/` | SQL 마이그레이션·메타데이터와 계정 관리 도구 |
| `tests/unit/`, `tests/e2e/` | 단위·컴포넌트 테스트와 브라우저 테스트 |
| `public/`, `docs/` | 정적 자산과 기능·API·운영 문서 |

저장 흐름은 `components/기능 훅 → lib/repo → app/api → UserRepositories → SQLite`입니다. `lib/server/repos/index.ts`가 DB와 인증 사용자를 11개 저장소에 주입합니다. 조회 상태는 `AsyncResource`와 `useAsyncResource`, 공통 데이터 초기화는 `createBinderStore`에 둡니다. 백업은 `BackupService → UserBackupRepository`, DB 연결은 `DatabaseConnection`이 담당합니다. 입력 규칙은 `lib/validation/`, 시간표 계산·조작은 `lib/time-grid/`에 두고 [유지보수 가이드](docs/06-maintenance.md)를 따릅니다. DB 필드 변경 시 타입·스키마·마이그레이션·입력 검증·양쪽 repository·import/export를 함께 점검하세요.

## 설치·실행·검증 명령

Node.js 22.22 이상(22.x LTS)과 npm을 사용합니다. `better-sqlite3`와 `argon2`는 네이티브 모듈이므로 설치 환경에 빌드 도구가 필요할 수 있습니다.

| 명령 | 설명 |
| --- | --- |
| `npm ci` | 잠금 파일 기준 의존성 설치 |
| `npm run dev -- --port 3101` | 운영 3000·E2E 3100과 분리한 개발 서버 |
| `npm run build` / `npm run start` | 프로덕션 빌드 / 빌드 결과 실행 |
| `npx eslint .` / `npx tsc --noEmit` | ESLint 검사 / 타입 검사 |
| `npm test` / `npm run test:watch` | Vitest 단발 실행 / 변경 감시 |
| `npm run e2e` | Playwright Chromium 테스트 |

`npm run lint -- --max-warnings 0`으로 오류·경고 없이 통과해야 합니다. `npm run lint`는 ESLint CLI를 실행하고, `npm run typecheck`는 타입을 검사합니다. `npm run docs:check`로 문서의 상대 파일 링크를 확인하세요. Next.js 16의 빌드는 lint 검사를 대신하지 않습니다.

## 코드 스타일과 데이터 처리

- TypeScript의 strict 설정을 유지하고, 들여쓰기 2칸·세미콜론·기존 파일의 따옴표 스타일을 따릅니다. 경로 별칭은 `@/`입니다. 별도 Prettier 설정은 없습니다.
- 책임과 의존성을 기준으로 분리하고 상속보다 조합을 우선합니다. React 화면은 함수 컴포넌트를 유지하며, 연결·트랜잭션·조작 정책은 생성자로 의존성을 받는 객체에 둡니다. 새 TODO 입력은 `TodoCreateInput`을 재사용해 한글 조합 Enter와 중복 제출을 방지하고 `onCreate(title, requestKey)`의 키를 createTodo에 전달합니다.
- 컴포넌트·타입은 PascalCase, 함수·변수는 camelCase를 사용합니다. 예: `WeeklyViews.tsx`, `listTodos`. Next.js 파일명은 `page.tsx`, `layout.tsx`, `route.ts` 규칙을 따릅니다.
- 브라우저 이벤트·상태가 필요한 컴포넌트에 `'use client'`를 선언하고, DB·인증 코드는 `lib/server/`에 둡니다.
- API는 `authenticated()` 경계에서 얻은 `userId`로 `getUserRepositories(userId)`를 만들고 기존 `readMutation()` 검증을 재사용합니다. 요청 본문의 소유자 값을 신뢰하지 않습니다.
- 조회 훅의 key에는 날짜·연도·목표 ID 등 조회 범위를 포함합니다. `useAsyncResource`는 사용자도 분리하고 늦은 응답을 무시합니다. 변경 알림에는 해당 리소스 이름을 지정하세요. 렌더링 중 ref를 갱신하지 말고 `useLatest`와 이벤트 핸들러를 사용합니다.
- PATCH의 키 생략·`undefined`는 변경 없음, `null`은 명시적 해제입니다. 자동 저장 변경 시 순차 저장·실패 복구·날짜 이동 동작을 유지하세요.

## 테스트 작성과 실행 기준

- Vitest와 React Testing Library를 사용하며, 파일명은 `tests/unit/*.test.ts` 또는 `*.test.tsx`입니다. DB 테스트는 기존 예처럼 Node 환경과 전용 임시 DB를 사용합니다.
- E2E는 `tests/e2e/*.spec.ts`에 작성합니다. 설정상 서버는 3100, DB는 `tmp-test/e2e.sqlite`입니다. 재사용되는 3100 서버도 이 테스트 DB를 사용하는지 확인하세요.
- 개별 실행 예: `npm test -- tests/unit/api-validation.test.ts`, `npm run e2e -- tests/e2e/weekly-habits.spec.ts`.
- 커버리지 수치 임계값은 설정돼 있지 않습니다. 동작 변경은 관련 회귀 테스트로 검증하고, UI 변경은 PC·모바일의 저장·재조회·레이아웃을 확인하세요. 단순 문서 변경은 diff 검토로 확인합니다.

## 환경변수와 DB 관리

- 로컬은 `.env.local`, Docker는 `app.env`를 사용합니다. `.env.example`을 참고해 `APP_USERNAME`, `APP_PASSWORD_HASH`, `SESSION_SECRET`(최소 32자), `DB_PATH`를 설정하세요. 기존 환경 파일은 보존합니다.
- 개발 DB는 운영 `data/binder.sqlite`와 분리하고 프로젝트 밖 절대경로를 권장합니다. 프로젝트 내부 WAL 파일 변경이 개발 서버의 재컴파일을 유발할 수 있습니다.
- 스키마 변경은 `npx drizzle-kit generate`로 SQL을 생성·검토하고 테스트 DB에서 검증합니다. 마이그레이션은 앱의 최초 DB 접근 때 적용되며, 빌드가 새 SQL을 생성하지는 않습니다.
- 기존 비밀번호는 `scripts/users.mjs passwd`로 변경합니다. `APP_PASSWORD_HASH` 변경은 기존 계정을 갱신하지 않습니다. CLI 실행 전 DB 초기화와 `DB_PATH`를 확인하세요.
- 비밀값·DB·WAL·백업을 커밋하지 마세요. 실행 중 백업은 SQLite backup API를 사용하며, 복구 절차는 [개발과 운영](docs/04-development-and-operations.md)을 따릅니다.

## Docker 운영 시 확인사항

Compose는 앱의 3000 포트를 호스트 `127.0.0.1:3000`에 연결하고 Caddy가 80·443에서 프록시합니다. `./data`와 `./Caddyfile`은 호스트 경로 연결이고, 인증서는 별도 볼륨에 보관됩니다.

프로젝트 폴더 이동·이름 변경 후에는 컨테이너가 예전 경로를 참조하는지 `docker inspect`로 확인하세요. 경로 재연결에는 현재 폴더에서 기존 Compose 프로젝트명을 지정한 컨테이너 재생성이 필요합니다. 이 PC의 기존 프로젝트명은 `binder`입니다. 운영 변경 전 DB 백업과 이미지·볼륨 보존을 확인하세요.

상태는 `docker compose -p binder ps`, 로그는 `docker compose -p binder logs --tail 100 app caddy`로 확인합니다. 자동 백업 서비스는 `./backups`에 서울 새벽 3시 온라인 백업·임시 복원 검사를 수행하고 30일 보관합니다. `docker compose -p binder logs --tail 30 backup`으로 확인합니다. 앱 healthcheck는 `/login` 응답만 검사하므로 `healthy`만으로 DB 정상 여부를 판단하지 말고, 실제 로그인·데이터 조회도 확인하세요.

## 커밋과 Pull Request

- 최근 이력의 `feat(week): ...`, `fix(auth): ...`, `chore(ui): ...` 형식을 우선합니다. 범위에는 변경 기능을 쓰고 제목은 결과를 간결하게 설명하세요.
- 한 커밋은 관련된 변경으로 구성합니다. 작업 전 `git status`를 확인하고 기존 미커밋 변경을 임의로 되돌리거나 섞지 마세요.
- PR에는 문제·변경 후 동작·관련 이슈·실행한 검증과 결과를 적습니다. UI 변경은 PC·모바일 스크린샷, DB 변경은 마이그레이션·데이터 보존·복구 방법을 포함하세요.
- 상세 설명은 [문서 목차](docs/README.md), [구조](docs/01-architecture.md), [검증과 한계](docs/05-verification-and-limitations.md)를 참고하고, 변경된 동작의 문서도 갱신합니다.
