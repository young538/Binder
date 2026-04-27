# Super 플래너

시간 기반 개인 플래너 — 목표에서 일일 실행까지. 단일 사용자용 self-hosted Next.js 앱.

## 스택
- Next.js 16 (App Router) + React 19 + TypeScript
- SQLite (better-sqlite3) + Drizzle ORM
- iron-session + argon2id 인증 (단일 사용자)
- Tailwind v4

## 로컬 개발

```bash
# 1. 비밀번호 해시 + 세션키 생성 → .env.local 에 저장
node scripts/hash-password.mjs <원하는-비밀번호> > .env.local

# 2. 의존성 설치
npm install

# 3. 개발 서버
npm run dev
```

`http://localhost:3000` 접속 → `/login` 으로 자동 리다이렉트 → `admin / <비밀번호>` 로 로그인.

DB 파일은 자동으로 `./data/binder.sqlite` 에 생성되고, 마이그레이션과 기본 카테고리 seed가 실행됩니다.

## 프로덕션 배포 (Docker)

### 1) 환경변수 준비

서버에서:
```bash
node scripts/hash-password.mjs <실제-비밀번호> > .env
```

`.env` 예시:
```
APP_USERNAME=admin
APP_PASSWORD_HASH=\$argon2id\$v=19\$m=19456,t=2,p=1\$....
SESSION_SECRET=<hex-64chars>
DB_PATH=/app/data/binder.sqlite
```

> `$` 문자들은 `\$` 로 이스케이프되어야 합니다. `hash-password.mjs`가 자동으로 처리.

### 2) Docker 빌드 + 실행

```bash
docker compose build
docker compose up -d
```

앱은 `127.0.0.1:3000` 에만 바인딩됩니다(로컬 프록시 경유 전제). SQLite 파일은 호스트의 `./data/` 볼륨에 보존됩니다.

### 3) HTTPS (Caddy 리버스 프록시)

외부에 노출할 때 Caddy가 Let's Encrypt로 HTTPS를 자동 발급해 줍니다.

```bash
cp Caddyfile.example Caddyfile
# Caddyfile 에서 planner.example.com 을 실제 도메인으로 변경

# docker-compose.yml 에서 caddy 서비스와 volumes 섹션 주석 해제

docker compose up -d
```

DNS는 서버 IP를 가리키도록 먼저 설정해야 합니다 (A/AAAA 레코드).

대안: Nginx + certbot, Cloudflare Tunnel, Tailscale 등도 가능.

## 운영 팁

### 데이터 백업
```bash
# 수동 JSON 내보내기 (앱 /settings 페이지에서 버튼 클릭)
# 또는 SQLite 파일 자체를 복사
cp ./data/binder.sqlite ./backups/binder-$(date +%Y%m%d).sqlite
```

WAL 모드라 복사 시 `binder.sqlite-wal` 파일도 함께 담기는 게 안전합니다.

### 비밀번호 변경
```bash
node scripts/hash-password.mjs <새-비밀번호> > .env
docker compose up -d --force-recreate app
```

### 마이그레이션
스키마 변경 후:
```bash
npx drizzle-kit generate
# drizzle/0001_*.sql 이 생성됨. 커밋 후 서버 재배포하면 자동 적용.
```

### 로그 확인
```bash
docker compose logs -f app
```

## 보안 체크리스트 (외부 노출 시)
- [x] 모든 경로는 `proxy.ts` 가 세션 검증
- [x] 비밀번호는 argon2id 해시로 저장
- [x] 쿠키: httpOnly + sameSite=lax, 운영 모드에선 secure=true
- [x] 앱 포트는 `127.0.0.1` 에만 바인딩 (Docker Compose)
- [ ] HTTPS 리버스 프록시 필수 (Caddy / Nginx)
- [ ] `SESSION_SECRET` 는 32자 이상 hex
- [ ] 필요 시 fail2ban 등으로 `/api/auth/login` 브루트포스 차단

## 폴더 구조 (핵심)
```
app/
  (app)/         # 로그인 필요한 페이지들
  api/           # REST API 라우트
  login/         # 로그인 페이지
components/
  annual/ mandalart/ monthly/ week/ retro/ settings/ reading/ nav/ common/ providers/
lib/
  repo/          # 클라이언트 repo (fetch 기반, UI에서 사용)
  server/
    db/          # Drizzle 스키마 + 클라이언트
    repos/       # 서버 repo (SQL 조작)
  types.ts       # 공통 타입
  utils/
drizzle/         # 자동 생성된 마이그레이션 SQL
data/            # SQLite 파일 (gitignore)
proxy.ts         # 인증 미들웨어 (Next 16에서 middleware의 새 이름)
```
