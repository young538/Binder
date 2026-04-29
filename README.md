# Super 플래너

시간 기반 개인 플래너 — 목표에서 일일 실행까지. 멀티 유저 self-hosted Next.js 앱.

## 기능

- **One-Thing 보드 / 연간 / 월간 / 주간 / 회고** 다층 계획 — 같은 데이터를 여러 시간 척도로
- **시간블록 드래그 입력** — 주간 그리드에서 마우스/터치 드래그로 시간 범위 선택, 즉시 BlockEditor 모달
- **계획 vs 실제 구분** — 점선 테두리(계획) / 실선 테두리(실제) + 채도 차이로 흑백·색약에서도 구분
- **실제 기준 통계** — 카테고리별·목표별·요일별·TODO별 시간 통계는 `actual` 블록만 합산 (의도 vs 실행 분리)
- **Todo 라이프사이클** — pending / done / postponed / delegated / cancelled
- **습관 캘린더 + 회고 템플릿** — 일/주 단위 회고를 좋은 점·아쉬운 점·다음 액션으로
- **독서 기록** — 연간 단위
- **JSON 내보내기/가져오기** — 멀티 유저 환경에서도 import 시 데이터는 항상 본인 계정으로 stamp 됨
- **다중 사용자** — 한 인스턴스에서 여러 사용자가 데이터 격리 운영 (DB 기반 인증, CLI 관리)

## 스택

- Next.js 16 (App Router) + React 19 + TypeScript 5
- SQLite (better-sqlite3) + Drizzle ORM 0.45
- iron-session 쿠키 + argon2id 비밀번호 해시 (사용자 정보는 DB `users` 테이블)
- Tailwind v4 + lucide-react 아이콘
- Vitest 4 (unit) + Playwright 1.59 (E2E)

## 로컬 개발

```bash
# 1. 비밀번호 해시 + 세션키 생성 → .env.local 에 저장
node scripts/hash-password.mjs <원하는-비밀번호> > .env.local

# 2. 의존성 설치
npm install

# 3. 개발 서버
npm run dev
```

`http://localhost:3000` 접속 → `/login` → `admin / <비밀번호>` 로 로그인 (사용자명 변경하려면 `.env.local` 의 `APP_USERNAME` 수정).

DB 파일은 자동으로 `./data/binder.sqlite` 에 생성되고, 마이그레이션 + admin 사용자 시딩 + 기본 카테고리 8개 시딩이 실행됩니다.

> ⚠️ 개발 모드(Turbopack) 가 SQLite WAL 파일 변동을 코드 변경으로 오인해 무한 재컴파일하는 이슈가 있습니다. `.env.local` 의 `DB_PATH` 를 프로젝트 밖 절대경로로 바꾸세요. 예: `DB_PATH=C:/Users/me/binder-data/binder.sqlite`. Docker 운영에서는 무관 (file watcher 없음).

## 프로덕션 배포 (Docker)

> ⚠️ 본인 운영 환경 (Windows 11 + iptime DDNS + self-signed HTTPS) 의 자세한 가이드는 **`docs/RUNBOOK.md`** 를 보세요. 아래는 일반적 가이드입니다.

### 1) 환경변수 준비

```bash
node scripts/hash-password.mjs <실제-비밀번호> > app.env
```

> 파일 이름은 **`app.env`** (`.env` 가 아님). Docker Compose 는 작업 디렉터리의 `.env` 를 자체 변수 보간 source 로 자동 읽기 때문에, argon2 해시의 `$` 문자가 손상됩니다. `app.env` 로 두면 우회됩니다. 자세한 내용은 RUNBOOK.

`app.env` 예시:
```
APP_USERNAME=admin
APP_PASSWORD_HASH=$$argon2id$$v=19$$m=19456,t=2,p=1$$<salt>$$<hash>
SESSION_SECRET=<hex-64chars>
DB_PATH=/app/data/binder.sqlite
```

> `$` 는 `$$` 로 이스케이프 (compose 보간 회피).

### 2) Docker 빌드 + 실행

```bash
docker compose build
docker compose up -d
```

앱은 `127.0.0.1:3000` 에만 바인딩됩니다 (Caddy 등 리버스 프록시 경유 전제). SQLite 파일은 호스트의 `./data/` 볼륨에 보존됩니다.

### 3) HTTPS (Caddy 리버스 프록시)

이상적: Let's Encrypt 자동 발급. 본인 도메인의 CAA 레코드가 LE 를 차단하지 않는 경우만:
```bash
cp Caddyfile.example Caddyfile
# planner.example.com 을 실제 도메인으로 변경
docker compose up -d
```

CAA 차단 (예: `*.iptime.org`) 또는 도메인 없음 → Caddyfile 에 `tls internal` 추가 해 self-signed 사용. 자세한 사례는 RUNBOOK.

대안: Nginx + certbot, Cloudflare Tunnel, Tailscale 등.

## 사용자 관리 (멀티 유저 CLI)

```bash
# 사용자 추가 (자동으로 8개 기본 카테고리 시딩)
docker compose exec -T app node scripts/users.mjs add <username> <password>

# 사용자 목록
docker compose exec -T app node scripts/users.mjs list

# 비밀번호 변경
docker compose exec -T app node scripts/users.mjs passwd <username> <new-password>

# 사용자 + 모든 데이터 삭제 (CASCADE, 복구 불가)
docker compose exec -T app node scripts/users.mjs delete <username>
```

UI 측: 데스크톱 TopNav 우측 끝에 사용자명 + 로그아웃 아이콘. 모바일/공통은 Settings 페이지의 "계정" 카드에서 로그아웃.

## 데이터 모델 요약

- 모든 도메인 테이블 (`goals`, `categories`, `todos`, `focus_notes`, `annual_goals`, `habits`, `habit_logs`, `books`, `retrospectives`, `time_blocks`) 에 `user_id text NOT NULL` 컬럼.
- `settings` 테이블은 PK = `user_id` (사용자별 1행).
- `users` 테이블: `id` (ULID PK), `username` (UNIQUE), `password_hash`.
- 모든 server repo 메서드의 첫 인자가 `userId`. 모든 query 가 `eq(table.userId, userId)` 로 격리.
- 마이그레이션은 `getDb()` 첫 호출 시 자동 적용 + admin 시딩 + 기존 single-user 데이터 backfill (`pending-admin` sentinel → admin ULID).

## 운영 명령어 빠른 참조

| 작업 | 명령 |
|---|---|
| 코드 변경 반영 | `docker compose up -d --build` |
| 백업 (수동) | `cp data/binder.sqlite* backups/binder-$(date +%Y%m%d).sqlite*` |
| 로그 | `docker compose logs -f app` |
| 컨테이너 상태 | `docker compose ps` |
| 마이그레이션 생성 (스키마 변경 후) | `npx drizzle-kit generate` |

자세한 운영 가이드는 **`docs/RUNBOOK.md`**.

## 테스트

```bash
npm test            # vitest unit (38 tests)
npx playwright test # e2e (5+ tests, 멀티유저 격리·드래그·회고 등)
```

## 보안 체크리스트 (외부 노출 시)

- [x] 모든 경로는 `proxy.ts` 가 세션 검증
- [x] 비밀번호는 argon2id (DB users 테이블) 로 해시
- [x] 쿠키: httpOnly + sameSite=lax, 운영 모드에선 secure=true
- [x] 앱 포트는 `127.0.0.1` 에만 바인딩 (compose)
- [x] 사용자별 데이터 격리 (DB + repo + API + 테스트로 검증)
- [x] import 시 본인 userId 강제 stamp (account-takeover 방지)
- [ ] HTTPS 리버스 프록시 (Caddy / Nginx) — 본인 환경은 Caddy self-signed
- [ ] `SESSION_SECRET` 는 32자 이상 hex
- [ ] 필요 시 fail2ban 등으로 `/api/auth/login` 브루트포스 차단

## 폴더 구조 (핵심)

```
app/
  (app)/                 # 로그인 필요한 페이지들 (One-Thing/연간/월간/주간/회고/독서/설정)
  api/
    auth/
      login/             # POST 로그인
      logout/            # POST 로그아웃
      me/                # GET 현재 사용자 정보 (멀티유저 UI)
    {도메인}/            # 도메인별 REST API (모두 requireSession + userId 격리)
  login/                 # 로그인 페이지
components/
  annual/ mandalart/ monthly/ week/ retro/ settings/ reading/ nav/ common/ providers/
lib/
  repo/                  # 클라이언트 repo (fetch 기반, UI에서 사용)
  server/
    auth.ts              # iron-session + verifyCredentials (DB-backed)
    db/
      schema.ts          # Drizzle 스키마
      client.ts          # DB 싱글톤 + 마이그레이션 + 시딩 + backfill
      constants.ts       # 마이그레이션 sentinel 등
    repos/               # 서버 repo (모두 첫 인자 userId)
    progress.ts          # 목표 진행률 계산 (userId 격리)
  types.ts               # 공통 타입 (모든 도메인 타입에 userId)
  utils/
drizzle/                 # 마이그레이션 SQL (0000–0004)
scripts/
  users.mjs              # 멀티유저 CLI (add/list/passwd/delete)
  hash-password.mjs      # admin 시딩용 비밀번호 해시 생성
data/                    # SQLite 파일 (gitignored)
docs/
  RUNBOOK.md             # 운영 가이드 (실 환경 기준)
  INSTALL-*.md           # 신규 환경 설치 가이드
  superpowers/
    specs/               # 디자인 스펙
    plans/               # 구현 계획
proxy.ts                 # 인증 미들웨어 (Next 16에서 middleware의 새 이름)
```
