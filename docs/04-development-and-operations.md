# 개발 환경과 운영

[전체 목차](README.md) · [검증](05-verification-and-limitations.md) · [과거 운영 기록](RUNBOOK.md)

이 문서는 저장소의 실행 설정을 기준으로 합니다. 실제 배포 상태를 원격 확인한 기록은 아닙니다. 기존 RUNBOOK의 개인 서버 환경과 과거 장애 이력은 유지하되, 실행·비밀번호·백업 명령은 이 문서를 우선합니다.

## 1. 실행에 필요한 것

Node.js/npm, SQLite·argon2 네이티브 모듈을 설치할 수 있는 환경이 필요합니다. Dockerfile은 `node:22-alpine`을 사용하며 빌드 단계에 python3·make·g++·libc6-compat를 설치합니다. 운영은 Node와 SQLite 파일을 유지할 수 있는 서버를 전제로 합니다.

[package.json](../package.json)의 명령:

| 명령 | 역할 |
|---|---|
| `npm run dev` | Next 개발 서버 |
| `npm run build` | production 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm test` | Vitest run |
| `npm run test:watch` | Vitest watch |
| `npm run e2e` | Playwright |
| `npm run lint` | ESLint CLI 검사 |
| `npm run typecheck` | TypeScript 검사 |
| `npm run docs:check` | 저장소 Markdown의 상대 파일 링크 검사 |

제거된 `next lint`를 ESLint CLI로 교체했습니다. Next 16의 build는 lint를 대신 수행하지 않습니다. 현재 전체 lint는 오류·경고 없이 통과합니다. 최종 검사 결과는 [전체 리팩토링 기록](08-full-refactor.md), 이전 미해결 오류는 [1차 점검 기록](07-source-doc-audit.md)을 확인합니다.

## 2. 로컬 최초 실행

프로젝트 루트의 PowerShell 예입니다. 환경변수 파일이 이미 있다면 생성 명령으로 덮어쓰지 말고 필요한 항목만 편집합니다.

```powershell
npm ci
if (Test-Path -LiteralPath .env.local) { throw '기존 .env.local을 먼저 확인하세요.' }
$binderLocalEnv = node scripts/hash-password.mjs '원하는-비밀번호'
$binderLocalEnv.Replace('DB_PATH=./data/binder.sqlite', 'DB_PATH=C:/binder-dev/binder.sqlite') | Set-Content -Encoding utf8 .env.local
npm run dev -- --port 3101
```

해시 스크립트는 argon2를 import하므로 의존성 설치가 먼저입니다. 출력에는 APP_USERNAME=admin, argon2 해시, 새로운 SESSION_SECRET, 기본 DB_PATH가 포함됩니다. `.env.local`에서 아이디와 경로를 조정한 뒤 서버를 시작합니다.

위 예에서는 `http://localhost:3101/login`을 열어 로그인합니다. 운영 Docker는 3000, Playwright는 3100을 사용하므로 개발 포트를 분리합니다.

```powershell
npm run dev -- --port 3101
```

## 3. 환경변수

| 변수 | 역할 |
|---|---|
| APP_USERNAME | 초기 사용자 이름, 기본 admin |
| APP_PASSWORD_HASH | 최초 사용자 생성용 argon2 해시 |
| SESSION_SECRET | iron-session 암호화 키, 최소 32자 |
| DB_PATH | SQLite 파일 경로, 기본 `./data/binder.sqlite` |
| NODE_ENV | production이면 secure 쿠키 |
| PORT | 서버 포트; Docker 기본 3000, E2E 3100 |

APP_PASSWORD_HASH를 바꿔도 이미 존재하는 사용자 비밀번호는 갱신되지 않습니다. 초기 사용자가 없을 때만 생성에 사용합니다. 이후 변경은 users CLI의 passwd입니다.

개발 중 프로젝트 내부 WAL 파일 변경으로 재컴파일이 반복된 사례가 있으므로 로컬 DB_PATH는 프로젝트 밖 별도 개발 DB 절대경로를 사용할 수 있습니다. 운영 DB를 개발·테스트에 공유하지 않습니다.

Dockerfile/Compose에 TZ 지정은 없습니다. 기본 `/daily` 진입은 브라우저의 오늘을 사용합니다. 반면 `/api/progress`의 date 생략 시 기준일은 서버 현재 날짜이므로 호출부에서 선택 날짜를 명시합니다.

## 4. DB 초기화 순서

[client.ts](../lib/server/db/client.ts)의 getDb()가 [DatabaseConnection](../lib/server/db/connection.ts)을 통해 최초 연결을 준비합니다. 사용자 초기화는 [bootstrap.ts](../lib/server/db/bootstrap.ts)에 분리돼 있습니다.

1. DB 디렉터리를 만들고 SQLite를 엽니다.
2. WAL과 foreign_keys pragma를 설정합니다.
3. `drizzle/`의 마이그레이션을 적용합니다.
4. 환경변수의 사용자가 없으면 생성합니다.
5. `pending-admin` 사용자 ID의 기존 데이터를 초기 사용자 ID로 바꿉니다.
6. 초기 사용자 카테고리가 하나도 없으면 기본 8개를 생성합니다.

4~6은 하나의 즉시 트랜잭션입니다. 전체 초기화 성공 후에만 연결을 캐시합니다. 마이그레이션·초기화 실패 시 연결을 닫고 다음 요청에서 다시 시도합니다. 마이그레이션 폴더가 누락되면 초기화를 실패 처리합니다.

기본 카테고리는 주원씽·부원씽·강의·개인·성장·사람·재미·낭비입니다. 습관·목표·책 전체를 자동 seed하는 것은 아닙니다. 일일 프리셋은 화면에서 별도로 추가합니다.

현재 마이그레이션은 0000_petite_joshua_kane, 0001_demonic_screwball, 0002_multi_user_schema, 0003_add_user_id, 0004_settings_per_user, 0005_annual_actual_adjustments, 0006_todo_operations입니다. 0006은 TODO 요청 중복 방지 기록과 삭제 취소용 임시 보관 테이블을 추가합니다. 0005는 연간 실적의 수동 보정값을 추가하고 기존 표시값을 유지하도록 초기화합니다. 소스 스키마를 바꿀 때는 `npx drizzle-kit generate`로 SQL을 생성·검토하고 테스트 DB에 적용합니다. 빌드 명령이 자동으로 새 migration을 생성하지는 않습니다.

## 5. 사용자 관리

CLI는 DB 초기화·마이그레이션을 수행하지 않습니다. 앱의 DB 초기화가 한 번 실행된 뒤 사용해야 합니다. `scripts/users.mjs`는 `.env.local`도 자동 로딩하지 않으므로 직접 실행 시 DB_PATH를 같은 파일로 지정합니다.

```powershell
$env:DB_PATH = 'C:/binder-dev/binder.sqlite'
node scripts/users.mjs list
node scripts/users.mjs add '새아이디' '새비밀번호'
node scripts/users.mjs passwd '아이디' '변경비밀번호'
```

Docker는 앱과 같은 환경·볼륨 안에서 실행합니다.

```powershell
docker compose -p binder exec -T app node scripts/users.mjs list
docker compose -p binder exec -T app node scripts/users.mjs add '새아이디' '새비밀번호'
docker compose -p binder exec -T app node scripts/users.mjs passwd '아이디' '변경비밀번호'
```

`delete <username>`은 사용자의 도메인 데이터와 계정 행을 트랜잭션으로 지우며 CLI 내부에 추가 확인은 없습니다. 추가 계정에는 기본 카테고리 8개가 생성됩니다. 역할·권한 등급은 없고 모든 사용자가 자기 데이터에 같은 기능을 사용합니다.

## 6. Docker 배포

[Dockerfile](../Dockerfile)은 의존성 설치 → 앱 빌드 → 실행 이미지의 3단계입니다. [next.config.ts](../next.config.ts)는 standalone 결과를 생성하고 네이티브 패키지를 serverExternalPackages로 지정합니다. 실행 이미지에 standalone·정적 파일·public·drizzle·scripts와 필요한 네이티브 패키지를 복사하며 비root 사용자로 실행합니다.

[docker-compose.yml](../docker-compose.yml)의 구성:

| 항목 | 설정 |
|---|---|
| app 환경변수 | 루트 `app.env` |
| 앱 포트 | 호스트 `127.0.0.1:3000` → 컨테이너 3000 |
| DB 볼륨 | 호스트 `./data` → `/app/data` |
| healthcheck | `/login` HTTP 응답 검사; DB 전체 기능 검사는 아님 |
| Caddy | 현재 Compose에 이미 활성화되어 있음 |
| 외부 포트 | Caddy 80/443 |
| 프록시 설정 | `Caddyfile` 읽기 전용 마운트 |
| 인증서 관련 저장 | caddy-data, caddy-config 볼륨 |
| 재시작 | unless-stopped |

이 PC의 기존 Compose 프로젝트명은 `binder`입니다. 다음 예처럼 `-p binder`를 지정해 기존 네트워크·인증서 볼륨을 재사용합니다. 새 설치는 환경에 맞는 프로젝트명을 사용합니다. 처음 설치하는 환경은 [Caddyfile.example](../Caddyfile.example)을 참고해 도메인과 upstream을 준비합니다. 기존 Caddyfile을 이유 없이 덮어쓰지 않습니다. 배포는 다음 명령입니다.

```powershell
docker compose -p binder up -d --build
docker compose -p binder ps
docker compose -p binder logs --tail 100 app
docker compose -p binder logs --tail 100 caddy
```

폴더를 이동하거나 이름을 바꾸면 기존 컨테이너의 DB·Caddyfile 연결 경로가 낡을 수 있습니다. `docker inspect super-planner`로 Source를 확인하고, 백업 및 기존 이미지 확인 후 현재 폴더에서 `docker compose -p binder up -d --no-build --pull never --force-recreate`로 재연결합니다. 이 명령은 새 소스를 빌드하지 않습니다.

production 세션은 secure 쿠키이므로 실제 로그인 사용은 HTTPS 주소로 합니다. 로컬 HTTP의 로그인 페이지가 열린다는 것만으로 인증 세션까지 정상이라는 뜻은 아닙니다.

## 7. 로컬 dotenv와 Compose 해시 표기

해시 스크립트 출력은 Next의 dotenv용으로 `$`를 `\$`로 이스케이프합니다. 현재 Compose `env_file`에 쓰는 기존 운영 방식은 별도 `app.env`와 `$$` 표기입니다. 둘을 그대로 복사해서 혼용하지 않습니다.

기존 파일이 없는 최초 준비 예:

```powershell
$binderEnvLines = node scripts/hash-password.mjs '초기-비밀번호'
$binderEnvLines.Replace('\$', '$$').Replace('DB_PATH=./data/binder.sqlite', 'DB_PATH=/app/data/binder.sqlite') | Set-Content -Encoding utf8 app.env
```

실제 해시·세션키를 문서나 Git에 넣지 않습니다. Compose가 읽는 파일명은 app.env입니다. `.dockerignore`는 app.env·환경 파일·로컬 백업·작업 사본을 빌드 컨텍스트에서 제외합니다. 새 해시 출력은 세션키도 매번 생성하므로 기존 app.env 전체를 교체하면 기존 로그인 쿠키도 영향을 받습니다.

## 8. 백업

Compose의 `backup` 서비스가 최초 실행 및 매일 **Asia/Seoul 03시**에 SQLite 온라인 백업을 수행합니다. 검증된 자동 백업은 `./backups`에 30일간 보관합니다. 매번 임시 DB로 복사해 무결성 검사·테이블 읽기·시험 쓰기/삭제를 확인하며, 검증 성공 후에만 오래된 자동 백업을 정리합니다. 수동 배포 백업은 정리 대상이 아닙니다. 호스트가 꺼져 있으면 실행되지 않으며 재시작 때 누락분을 보완합니다.

```powershell
docker compose -p binder logs --tail 30 backup
docker compose -p binder exec -T backup node scripts/backup.mjs status
docker compose -p binder exec -T backup node scripts/backup.mjs once
# 출력된 파일명으로 체크섬과 복원을 다시 확인
docker compose -p binder exec -T backup node scripts/backup.mjs verify /backups/binder-auto-실제파일명.sqlite
```

`BACKUP_RETENTION_DAYS`, `BACKUP_TIMEZONE`, `BACKUP_HOUR`는 Compose의 backup 환경변수입니다. DB 볼륨은 읽기 전용, 백업 볼륨은 쓰기 가능하며 서비스에는 네트워크와 비밀 환경변수를 주지 않습니다. Linux에서는 UID/GID 1001이 backups에 쓸 수 있어야 합니다. 복원 검사는 `/tmp` 256MB에서 수행하므로 DB가 커지면 tmpfs 크기도 늘리세요. `backup-status.json`에 최근 성공·실패를 저장하고 26시간 넘게 성공하지 못하거나 최근 시도가 실패하면 healthcheck가 실패합니다. 실패는 5분 후 재시도합니다.

자동 백업은 동일 호스트에 있으므로 디스크 고장 대비 외부 복사까지 제공하지는 않습니다. 실제 운영 DB 교체 복구는 아래 절차대로 별도로 수행합니다.


설정의 JSON 내보내기는 로그인 계정의 도메인 데이터 백업입니다. users·비밀번호·다른 계정은 제외합니다. 서버 전체 복구에는 SQLite 파일과 환경변수·프록시 설정을 별도로 보관해야 합니다.

실행 중인 WAL DB의 메인 파일만 `cat`하거나 변경 중인 DB/WAL을 따로 복사하면 일관된 백업을 보장하지 못합니다. 기존 설치 문서의 이런 예제는 사용하지 않고 SQLite backup API를 사용합니다. 현재 설치된 better-sqlite3로 컨테이너 내부 백업 파일을 만든 뒤 호스트 backups로 복사할 수 있습니다.

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
$binderBackupName = 'binder-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sqlite'
@'
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH);
db.backup('/app/data/backup-latest.sqlite')
  .then(() => db.close())
  .catch(error => { console.error(error); db.close(); process.exit(1); });
'@ | docker compose -p binder exec -T app node
if ($LASTEXITCODE -ne 0) { throw 'DB 백업 실패' }
Copy-Item -LiteralPath 'data/backup-latest.sqlite' -Destination (Join-Path 'backups' $binderBackupName)
```

이 예는 Compose의 기본 DB 경로·볼륨 기준입니다. 다른 DB_PATH를 사용하면 생성 파일 위치와 복사 경로를 맞춥니다. `backup-latest.sqlite`는 다음 실행에서 갱신되므로 날짜 이름으로 보관하는 단계까지 완료합니다. 운영 중인 정기 백업 스케줄이 저장소에 구현된 것은 아니며 자동화 등록 여부는 운영 환경에서 확인해야 합니다.

## 9. 복구 순서

1. 사용할 백업 파일을 별도 환경에서 열어 `PRAGMA integrity_check` 결과를 확인합니다.
2. 앱과 같은 DB를 여는 개발 서버·CLI 등 쓰기 프로세스를 모두 종료합니다. Compose 앱은 `docker compose -p binder stop app`으로 멈춥니다.
3. 현재 `data` 디렉터리를 별도 날짜 폴더에 보존합니다.
4. 기존 `binder.sqlite`, `binder.sqlite-wal`, `binder.sqlite-shm`을 원위치에서 함께 분리 보관합니다. 이전 WAL을 새 백업에 붙이지 않습니다.
5. 일관된 백업을 `data/binder.sqlite`에 복원하고 컨테이너 사용자가 읽고 쓸 수 있는지 확인합니다.
6. `docker compose -p binder up -d app` 후 로그를 확인하고 실제 계정으로 주요 데이터를 확인합니다.

코드 버전도 기록합니다. 더 최신 DB를 이전 코드에 바로 연결할 수 있다고 가정하지 않습니다. 환경변수를 바꾸면 단순 restart만으로 새 환경이 반영되는지 단정하지 말고 컨테이너 재생성을 확인합니다.

## 10. 과거 데이터 변환 도구

`scripts/parse-binder.mjs`는 특정 로컬 경로의 2026년 Google Sheets HTML 내보내기를 cheerio로 읽어 `scripts/data/seed-2026.json`으로 바꾸는 도구입니다. 원본 경로와 연도가 코드에 고정되어 있고 라이브 Google Sheets 연동이 아닙니다.

`public/data/seed-2026.json`도 남아 있지만 앱 첫 실행에서 자동 가져오지는 않습니다. 필요할 때 형식을 확인해 설정의 JSON 가져오기를 사용합니다. 파일에 있는 ID를 유지하는 import 특성도 확인해야 합니다.

## 11. 지속적 검증

[GitHub Actions](../.github/workflows/ci.yml)는 main push와 PR에서 Node 22 기반 설치·lint·타입·Vitest·문서 링크·npm audit·프로덕션 빌드를 실행합니다. 별도 작업에서 Chromium E2E와 Docker 빌드를 수행하며, 실패한 브라우저 테스트 결과는 7일 보관합니다. Actions는 커밋 SHA로 고정했습니다. CI는 이미지를 배포하거나 운영 DB에 접근하지 않습니다.
