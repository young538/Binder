# 운영 가이드 (현재 배포 구성)

이 문서는 **현재 실제 운영 중인 배포 환경**을 정확히 기록합니다. 일반 설치 가이드는 `INSTALL-windows-server.md` 를 참고하세요. 이 문서는 거기서 결정된 선택지·트러블슈팅·운영 명령어를 한곳에 모은 운영 노트입니다.

## 1. 환경 개요

| 항목 | 값 |
|---|---|
| OS | Windows 11 Pro (10.0.26200) |
| 컨테이너 런타임 | Docker Desktop (WSL2 백엔드) |
| 도메인 | `young538.synology.me` (primary), `young538.iptime.org` (fallback) |
| 공인 IP | 119.196.34.251 (가정용 회선, 변동 가능) |
| 서버 LAN IP | 192.168.0.222 (DHCP 예약 고정) |
| 서버 MAC | `B4:2E:99:88:B3:03` |
| 외부 노출 포트 | 80, 443 (TCP) |
| 리버스 프록시 | Caddy 2 (컨테이너) |
| TLS | Let's Encrypt (`young538.synology.me`), self-signed fallback (`young538.iptime.org`) |
| 환경변수 파일 | `app.env` (루트, gitignored) |
| DB 파일 | `./data/binder.sqlite` (호스트 bind mount) |

접속 URL: `https://young538.synology.me`
모바일은 공인 인증서가 발급된 이 주소를 사용합니다. `https://young538.iptime.org` 는 Caddy 내부 CA 인증서를 쓰는 fallback 주소라 브라우저 경고가 뜰 수 있습니다.

## 2. 왜 iptime 주소는 self-signed 인가

처음에는 Caddy + Let's Encrypt 자동 발급으로 시도했으나 다음 차단으로 **공인 인증서 발급 불가** 판정.

```
$ dig CAA iptime.org
iptime.org. CAA 0 issue ";"
iptime.org. CAA 0 issuewild ";"
```

`";"` 는 RFC 8659에서 "**모든 공인 CA에서 발급 차단**"을 의미. iptime이 정책적으로 모든 `*.iptime.org` 하위 도메인의 공인 인증서 발급을 차단해 놓아 사용자가 변경할 수 없습니다.

현재는 같은 공인 IP를 가리키는 `young538.synology.me` 를 primary 주소로 추가했고, 이 도메인은 CAA 제한이 없어 Let's Encrypt 인증서 발급에 성공했습니다.

**우회 옵션 비교**:

| 방법 | 결과 | 사용자 부담 |
|---|---|---|
| Let's Encrypt (`*.iptime.org`) | ❌ CAA 차단 | — |
| Let's Encrypt (`young538.synology.me`) | ✅ 현재 primary | Synology DDNS 유지 |
| DuckDNS / 다른 무료 DDNS | ✅ 가능 | 가입 1분, IP 갱신 스크립트 1개 |
| 직접 도메인 구매 | ✅ 가능 | 비용 + Cloudflare/Caddy 설정 |
| Tailscale Funnel | ✅ 가능 | 본인 기기에 클라이언트 설치 |
| Caddy self-signed (`young538.iptime.org`) | ⚠️ fallback | 첫 접속 시 1회만 예외 추가 |
| 평문 HTTP | ❌ 작동 불가 | iron-session `secure` 쿠키 미전송 |

## 3. 환경변수 파일이 `.env`가 아니라 `app.env`인 이유

처음에는 `.env` 한 파일에 `APP_PASSWORD_HASH` 를 dotenv 표준대로 `\$argon2id\$v=...` 로 이스케이프해 저장했으나, **Docker Compose가 작업 디렉터리의 `.env` 를 자체 변수 보간 source로 자동 읽기 때문에** 다음 충돌이 발생:

- Compose가 `.env` 의 `\$argon2id` 부분을 `${argon2id}` 로 해석 시도 → 정의되지 않은 변수라 빈 문자열로 치환
- 컨테이너에 전달된 `APP_PASSWORD_HASH` 가 **42자로 손상** (정상은 97자)
- 로그인 시도 시 argon2 verify 실패

**해결**: 이름을 `.env` 가 아닌 `app.env` 로 두면 Compose가 자체 보간 대상으로 읽지 않음. 그리고 hash 값의 모든 `$` 를 `$$` 로 이스케이프해 `env_file` 처리 단계의 보간도 회피.

```env
# app.env (gitignored)
APP_USERNAME=young538
APP_PASSWORD_HASH=$$argon2id$$v=19$$m=19456,t=2,p=1$$<salt>$$<hash>
SESSION_SECRET=<64-hex>
DB_PATH=/app/data/binder.sqlite
```

## 4. 운영 명령어

### 4.1 코드 변경 반영

```powershell
docker compose up -d --build
```

- 변경된 코드로 이미지 재빌드 (캐시 활용)
- `super-planner` 컨테이너만 재생성, Caddy 는 그대로
- DB 파일은 `./data` bind mount 라 보존됨
- Drizzle 마이그레이션은 앱 시작 시 자동 적용

### 4.2 비밀번호 변경

**일반 사용자 비번 변경** — 멀티유저 CLI 가 가장 깔끔 (5.5 참고):
```powershell
docker compose exec -T app node scripts/users.mjs passwd <username> <new-password>
```
DB 의 `users.password_hash` 만 갱신 — 컨테이너 재기동 불필요.

**`app.env` 의 admin 시딩 비번 변경** — 신규 부트(빈 DB)에서만 효과 있음. 이미 시딩된 admin 의 비번을 바꾸려면 위 CLI 의 `passwd` 사용. 그래도 시딩 비번 자체를 바꾸고 싶다면:

```powershell
node scripts/hash-password.mjs <새-비밀번호>
```
출력의 `APP_PASSWORD_HASH=...` 줄을 복사 → `app.env` 줄 교체 (단, `$` 를 `$$` 로 모두 이스케이프). 그리고:
```powershell
docker compose up -d --force-recreate app
```

### 4.3 로그 확인

```powershell
# 앱
docker compose logs -f app

# Caddy (인증서 / 요청)
docker compose logs -f caddy
```

### 4.4 컨테이너 상태

```powershell
docker compose ps
```

### 4.5 백업 (수동)

```powershell
$date = Get-Date -Format "yyyyMMdd-HHmm"
New-Item -ItemType Directory -Force backups | Out-Null
Copy-Item "data\binder.sqlite*" "backups\" -Force
Rename-Item "backups\binder.sqlite" "backups\binder-$date.sqlite" -Force
```

WAL 모드라 `binder.sqlite-wal`, `binder.sqlite-shm` 도 함께 복사하는 게 안전. 자동화는 작업 스케줄러로.

### 4.6 전체 재기동

```powershell
docker compose down
docker compose up -d
```

`./data` 와 `caddy-data` 볼륨은 보존. 인증서도 그대로 (재발급 안 함).

## 5. 외부 노출 인프라

### 5.1 공유기 (iptime, `192.168.0.1`)

**DHCP 예약**: 고급설정 → 내부 네트워크 → DHCP 사용 IP 정보 → 수동 등록
- MAC `B4:2E:99:88:B3:03` → IP `192.168.0.222`

**포트포워드**: 고급설정 → NAT/라우터 관리 → 포트포워드 설정

| 규칙 | 내부 IP | 외부 포트 | 내부 포트 | 프로토콜 |
|---|---|---|---|---|
| Planner-HTTP | 192.168.0.222 | 80 | 80 | TCP |
| Planner-HTTPS | 192.168.0.222 | 443 | 443 | TCP |

**DDNS**: 특수기능 → DDNS 설정 → 호스트 `young538.iptime.org` 정상 등록 상태

### 5.2 Windows 방화벽

Docker Desktop이 자체적으로 컨테이너 포트 노출 시 방화벽 예외를 처리하므로 별도 규칙은 불필요한 것으로 확인됨. (정확한 동작은 `Get-NetFirewallRule -DisplayName "Docker*"` 로 점검 가능.)

명시적 규칙을 두고 싶다면 (관리자 PowerShell):
```powershell
New-NetFirewallRule -DisplayName "Super Planner HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Super Planner HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

## 5.5 사용자 관리 (멀티 유저)

이 인스턴스는 한 컨테이너에서 여러 사용자를 격리해 운영. 사용자 추가/비밀번호 변경/삭제는 CLI 스크립트로만 가능 (UI 없음).

### 사용자 추가
```powershell
docker compose exec -T app node scripts/users.mjs add <username> <password>
```
신규 사용자는 자동으로 8개 기본 카테고리가 시딩됩니다. 비밀번호는 argon2id 로 해시되어 DB 의 `users` 테이블에만 저장됩니다.

### 사용자 목록
```powershell
docker compose exec -T app node scripts/users.mjs list
```
출력: `<id>\t<username>\t<created_at>` (비밀번호 해시 노출 없음)

### 비밀번호 변경
```powershell
docker compose exec -T app node scripts/users.mjs passwd <username> <new-password>
```

### 사용자 삭제 (CASCADE)
```powershell
docker compose exec -T app node scripts/users.mjs delete <username>
```
⚠️ 해당 사용자의 모든 도메인 데이터 (10 테이블) + settings 가 단일 트랜잭션으로 함께 삭제됩니다. 복구 불가. 백업이 있는 상태에서만 실행하세요.

### 데이터 격리 보장

- 모든 도메인 테이블이 `user_id text NOT NULL` 컬럼을 가짐 (10개: goals, categories, todos, focus_notes, annual_goals, habits, habit_logs, books, retrospectives, time_blocks). `settings` 는 PK 자체가 `user_id`.
- 모든 server repo 메서드의 첫 인자가 `userId`, 모든 query 에 `eq(table.userId, userId)` 필터.
- 모든 API route 가 `requireSession()` 으로 `{ userId, username }` 를 받아 repo 에 전달. body 의 userId 는 무시.
- Import route 는 import 파일의 userId 를 무시하고 현재 세션 userId 로 강제 stamp — 다른 계정의 export 파일도 안전하게 본인 계정에 들어옴 (account-takeover 방지).
- `tests/unit/repo-isolation.test.ts` + `tests/e2e/multiuser.spec.ts` 가 cross-user leak 방지를 자동 검증.

### UI 측 (사용자 정보 + 로그아웃)

- 데스크톱 (lg breakpoint 이상) — TopNav 우측에 작은 회색 사용자명 + ⚙ 설정 + ⎋ 로그아웃 아이콘.
- 모바일/공통 — `/settings` 페이지 최상단 "계정" 카드에 "로그인됨: <username>" + 로그아웃 버튼.
- 둘 다 `POST /api/auth/logout` 호출 후 `/login` 으로 이동.
- 현재 사용자 정보는 `GET /api/auth/me` → store 에 캐시 (init 시).

### 신규 운영 환경 첫 부트
- `app.env` 의 `APP_USERNAME` / `APP_PASSWORD_HASH` 에 admin 1명만 자동 시딩됨 (`ensureAdminUser`).
- 추가 사용자는 위 CLI 로 등록 — `ensureCategoriesForUser` 가 신규 사용자 별 8개 기본 카테고리 시딩.
- 기존 single-user 운영 데이터가 있던 DB 는 첫 부트 시 자동 마이그레이션:
  - 0003 마이그레이션이 모든 도메인 테이블에 `user_id text NOT NULL DEFAULT 'pending-admin'` 추가 → 모든 기존 행이 sentinel 값으로 채워짐.
  - 0004 마이그레이션이 `settings` 도 동일 패턴으로 PK 변경.
  - 런타임 `backfillUserId` 가 `'pending-admin'` 인 모든 행을 admin 사용자의 ULID 로 swap.
  - 결과: 기존 single-user 데이터 100% 보존, admin 계정에 매핑됨.

## 6. 자동 시작 체인 (PC 재부팅 후 자동 복구)

1. Windows 부팅
2. 사용자 자동 로그인 (`netplwiz` 에서 비밀번호 입력 해제 시) — Docker Desktop 이 user session 에서만 시작되므로 필수
3. Docker Desktop 자동 시작 (Settings → General → "Start Docker Desktop when you sign in")
4. `restart: unless-stopped` 정책으로 두 컨테이너 자동 기동
5. iptime 공유기는 이미 24/7 동작 (DDNS 자동 갱신)

소요 시간: 부팅 + Docker 초기화 약 2~3분.

## 7. 트러블슈팅

### 7.1 외부에서 접속 안 됨

진단 순서:
```powershell
# 1. DDNS 가 현재 공인 IP 가리키는지
Invoke-RestMethod "https://dns.google/resolve?name=young538.synology.me&type=A"
$publicIp = Invoke-RestMethod "https://api.ipify.org"
# 두 값 일치해야 함. 아니면 Synology/iptime DDNS 갱신 상태 확인.

# 2. 외부 포트 도달
Invoke-WebRequest -Uri "https://ports.yougetsignal.com/check-port.php" `
    -Method POST -Body @{ remoteAddress = "young538.synology.me"; portNumber = "443" } -UseBasicParsing

# 3. 컨테이너 살아 있는지
docker compose ps
docker compose logs --tail 50 caddy
```

원인별 처방:
- DDNS 미갱신 → Synology/iptime DDNS 갱신 상태 확인
- 외부 포트 closed → 공유기 포트포워딩 다시 확인 (내부 IP 가 192.168.0.222 인지)
- ISP 80/443 차단 → 비표준 포트 (예: 8443) 로 변경하거나 Tailscale/Cloudflare Tunnel 로 우회
- 컨테이너 down → `docker compose up -d`

### 7.2 로그인이 안 됨 / 즉시 로그아웃됨

iron-session 쿠키가 `secure: true` 라 HTTPS 가 아니면 쿠키가 안 박힘. **반드시 `https://young538.synology.me` 로 접속**해야 함. `young538.iptime.org` fallback 을 쓸 때만 self-signed 경고에서 "예외 추가"를 눌러야 쿠키 정상 동작.

### 7.3 비밀번호가 틀린 것처럼 거부됨

`APP_PASSWORD_HASH` 가 `app.env` 에서 손상돼 컨테이너에 전달됐을 가능성. 검증:
```powershell
docker compose exec app sh -c 'echo HASH_LEN=${#APP_PASSWORD_HASH}'
# 정상은 97 정도. 50 미만이면 손상.
```

손상이면 `app.env` 의 `APP_PASSWORD_HASH=` 줄에서 `$` 가 모두 `$$` 로 이스케이프되어 있는지 확인.

### 7.4 인증서 만료 (1년 후)

Caddy `tls internal` 의 self-signed 인증서는 90일 유효, **자동 갱신**됩니다 (Caddy 가 백그라운드 처리). 문제 시 재발급:
```powershell
docker compose restart caddy
```

### 7.5 데이터 손실/복구

```powershell
docker compose down
Copy-Item "backups\binder-YYYYMMDD-HHMM.sqlite" "data\binder.sqlite" -Force
docker compose up -d
```

WAL 파일이 백업에 있으면 함께 복사. 없으면 SQLite가 깨끗한 상태로 다시 시작.

## 8. 알려진 보안 한계

본인 1인용으로 설계되어 다음 한계가 있음:

- **self-signed 인증서**: MITM 공격 이론적으로 가능 (브라우저 신뢰 체인 부재). 본인이 인증서 핑거프린트를 한 번 신뢰한 후엔 해당 브라우저에서만 안전.
- **로그인 brute force**: rate limit 미적용. 외부 노출 중이라면 fail2ban 같은 추가 보호 권장.
- **사용자 관리 UI 부재**: 사용자 추가/삭제/비번 변경은 모두 CLI 로만 가능 (`scripts/users.mjs`). 운영자만 컨테이너 셸 접근 가능하다는 전제.
- **사용자 간 ID 충돌 시 import 가 silently skip**: import route 는 ID 충돌 시 onConflictDoNothing 으로 처리. 실 운영에서 ULID 충돌 가능성은 사실상 0.
- **타이밍 공격 가능성**: unknown username 시 argon2 verify 를 skip 해 응답 시간이 미세하게 다름. 단일 사용자에서 멀티 사용자로 옮긴 직후 외부 노출 시 enumeration 위험. 가정 네트워크 한정 운영이면 무관.
- **세션 만료**: 30일 (`maxAge: 60*60*24*30` in `lib/server/auth.ts`). 길다고 느끼면 줄이고 컨테이너 재기동.

## 9. 변경 이력

- 2026-04-28 — **최초 배포** (Docker + Caddy + iptime DDNS + self-signed). LE 발급 차단(CAA `0 issue ";"`) 발견 후 self-signed 로 전환. `.env` → `app.env` 분리 (compose 변수 보간 충돌 해결). `docs/RUNBOOK.md` 작성.
- 2026-04-30 — 모바일 브라우저의 self-signed 차단을 피하기 위해 `young538.synology.me` 를 primary 도메인으로 추가. Caddy/Let's Encrypt 인증서 발급 성공, `young538.iptime.org` 는 self-signed fallback 으로 유지.
- 2026-04-28 — **멀티 유저 지원** (11-task 리팩토링, plan: `docs/superpowers/plans/2026-04-28-multi-user-support.md`).
  - DB: `users` 테이블, 10개 도메인 테이블에 `user_id`, `settings` PK = `user_id`.
  - 인증: `verifyCredentials(username, password)` 가 DB users 에서 lookup, session 에 `userId` + `username` 저장.
  - server repos / API routes 모두 session.userId 로 격리.
  - 기존 single-user 데이터: sentinel `'pending-admin'` default + runtime backfill 로 admin 에 자동 매핑 (보존).
  - CLI: `scripts/users.mjs add | list | passwd | delete`. delete 는 모든 도메인 + settings CASCADE.
  - 신규 사용자 추가 시 `ensureCategoriesForUser` 가 기본 카테고리 8개 자동 시딩.
  - Dockerfile 에 `node_modules/ulid` 명시 복사 (CLI 가 ulid 사용).
  - Turbopack 회로 import 회피용 `lib/server/db/constants.ts` 분리.
  - 격리 검증: `tests/unit/repo-isolation.test.ts`, `tests/e2e/multiuser.spec.ts`.
  - leemia79 사용자 추가, young538 데이터 보존 검증 완료.
- 2026-04-28 — **로그아웃 UI** + 현재 사용자 표시 (TopNav 우측 + Settings AccountPanel). 새 endpoint `GET /api/auth/me`, 새 client repo `lib/repo/auth.ts` (`getMe`, `logout`), store 에 `me: Me | null` 추가.
- 2026-04-28 — **주간 그리드 UX/디자인 개선** (6-task, plan: `docs/superpowers/plans/2026-04-28-week-grid-drag-and-design.md`).
  - 빈 슬롯에 Pointer Events 드래그로 시간 범위 선택 → BlockEditor 자동 오픈 (단일 클릭 fallback 유지).
  - 계획 = 점선 테두리 + 10% 채움, 실제 = 실선 테두리 + 24% 채움 (좌측 카테고리 컬러 바 유지).
  - 컬럼 plan/actual 배경색 제거, 일자 묶음 사이 강한 구분선, 오늘 컬럼 zinc-50.
  - 헤더: 요일+일자 semibold + 우측 상단 작은 NotebookPen 회고 아이콘. row 2 의 이모지 제거 ("계획"/"실제" 텍스트만).
  - 시간 라벨 11px tabular-nums, 정시 마크 zinc-200.
  - 빈 슬롯 hover: cursor-cell + 옅은 배경.
  - 유틸: `tint.soft(hex, alpha?)` 시그니처 확장, `WEEKDAYS_KO` 상수 추가.
  - BlockEditor 의 종류 토글 이모지 제거.
- 2026-04-28 — 드래그 선택 표시 단일 사각형 overlay (이전: 행마다 개별 outline → 시각이 "여러 사각형" 으로 보였음).
- 2026-04-28 — 모바일 "+ 블록 추가" FAB 가 BottomNav 와 겹쳐 가려지던 문제 fix (`bottom: calc(safe-area-inset-bottom + 76px)`, `pb-36`).
- 2026-04-28 — **시간 통계는 actual 기준만** (카테고리별 / 목표별 / 요일별 / TODO별 / 총 기록시간). 계획 블록은 통계에서 제외. UI 에 "통계는 ✅ 실제 기록 기준" 라벨 추가. 영향 컴포넌트: `components/week/GoalCoverageBar.tsx`, `components/retro/WeeklySummary.tsx`.
