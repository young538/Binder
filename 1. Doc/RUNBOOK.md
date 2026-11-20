# 과거 운영 환경과 장애 기록

현재 설치·배포·계정·백업·복구 명령은 [개발과 운영](04-development-and-operations.md)을 사용합니다. 이 문서의 주소·장비·정책은 당시 관찰 기록이며 현재 네트워크 상태를 보장하지 않습니다.

## 당시 배포 환경

2026-04~09 기록: Windows 11 Pro, Docker Desktop의 WSL2 백엔드, Caddy 2, 외부 TCP 80·443, 앱 호스트 바인딩 127.0.0.1:3000을 사용했습니다. 기본 주소는 `young538.synology.me`, 대체 주소는 `young538.iptime.org`였습니다. 당시 LAN IP는 192.168.0.222, 공인 IP는 119.196.34.251이었으며 실제 값은 환경에서 다시 확인해야 합니다.

기본 주소는 공인 인증서를, 대체 주소는 Caddy 내부 CA를 사용하도록 설정했습니다. 당시 iptime.org CAA 레코드의 발급 제한 때문에 대체 주소에서 공인 인증서를 받지 못한 것이 선택 이유입니다. 현재 DNS 정책이나 인증서 유효기간을 이 기록에서 추정하지 마세요.

## 환경변수 보간 문제

초기 배포에서는 `.env`의 argon2 해시가 Compose 보간 과정에서 손상됐습니다. 운영용 파일을 `app.env`로 분리하고 `$` 표기를 조정해 해결했습니다. 현재 표기·생성 절차는 [운영 문서 7절](04-development-and-operations.md#7-로컬-dotenv와-compose-해시-표기)을 따릅니다.

`APP_PASSWORD_HASH`는 최초 사용자 생성에 사용하며 이미 생성된 사용자의 비밀번호는 바꾸지 않습니다. 계정 변경은 `scripts/users.mjs`로 합니다. 세션키를 바꾸면 기존 쿠키도 영향을 받습니다.

## 폴더 이름 변경으로 발생한 장애 — 2026-10-26

프로젝트 폴더를 `Binder`에서 `0000. Binder`로 바꾼 뒤, 기존 컨테이너의 bind mount는 예전 경로에 남아 있었습니다. 앱은 실행 중이고 `/login` healthcheck도 통과했지만 DB 접근에서 `SQLITE_CANTOPEN`이 발생했습니다. Caddyfile 연결 경로도 같은 영향을 받았습니다.

앱을 정지하고 DB·WAL·SHM을 함께 백업한 뒤, 기존 이미지와 Compose 프로젝트명 `binder`로 두 컨테이너를 현재 경로에 재생성했습니다. 인증서 볼륨을 재사용했고 DB quick_check 및 데이터 건수, HTTPS 로그인 페이지 응답을 확인했습니다. 폴더 이동 시 현재 작업 경로와 `docker inspect`의 Mounts.Source를 함께 확인하세요.

## 재부팅·인증·백업 확인 원칙

- 당시에는 Windows 사용자 로그인 후 Docker Desktop이 시작되고 `restart: unless-stopped`로 컨테이너가 기동되는 구성이었습니다. 실제 자동 시작 설정은 서버별로 확인합니다.
- production 세션은 secure 쿠키를 사용하므로 HTTPS에서 인증 흐름을 확인합니다. 로그인 페이지의 HTTP 200만으로 로그인·DB 성공을 판단하지 않습니다.
- 실행 중 DB/WAL을 파일별로 복사하던 예시는 폐기했습니다. SQLite backup API로 일관된 백업을 생성하고 복구 전 무결성을 검사합니다.
- 복구 시 기존 DB·WAL·SHM을 함께 분리 보관합니다. 오래된 WAL을 복원한 DB에 붙이지 않습니다.
- 사용자 삭제와 import의 사용자 격리는 애플리케이션 로직입니다. 외래키 CASCADE 또는 임의의 백업을 계정 사이에 자동 변환하는 기능으로 해석하지 않습니다.

## 과거 기능·배포 이력

- 2026-04-28 — **최초 배포** (Docker + Caddy + iptime DDNS + self-signed). LE 발급 차단(CAA `0 issue ";"`) 발견 후 self-signed 로 전환. `.env` → `app.env` 분리 (compose 변수 보간 충돌 해결). `docs/RUNBOOK.md` 작성.
- 2026-04-30 — 모바일 브라우저의 self-signed 차단을 피하기 위해 `young538.synology.me` 를 primary 도메인으로 추가. Caddy/Let's Encrypt 인증서 발급 성공, `young538.iptime.org` 는 self-signed fallback 으로 유지.
- 2026-04-28 — **멀티 유저 지원** (당시 구현 플랜은 현재 저장소에서 제거됨).
  - DB: `users` 테이블, 10개 도메인 테이블에 `user_id`, `settings` PK = `user_id`.
  - 인증: `verifyCredentials(username, password)` 가 DB users 에서 lookup, session 에 `userId` + `username` 저장.
  - server repos / API routes 모두 session.userId 로 격리.
  - 기존 single-user 데이터: sentinel `'pending-admin'` default + runtime backfill 로 admin 에 자동 매핑 (보존).
  - CLI: `scripts/users.mjs add | list | passwd | delete`. delete는 CLI가 여러 테이블을 명시적으로 삭제하는 트랜잭션이며 DB 외래키 CASCADE는 아님.
  - 신규 사용자 추가 시 `ensureCategoriesForUser` 가 기본 카테고리 8개 자동 시딩.
  - Dockerfile 에 `node_modules/ulid` 명시 복사 (CLI 가 ulid 사용).
  - Turbopack 회로 import 회피용 `lib/server/db/constants.ts` 분리.
  - 격리 검증: `tests/unit/repo-isolation.test.ts`, `tests/e2e/multiuser.spec.ts`.
  - leemia79 사용자 추가, young538 데이터 보존 검증 완료.
- 2026-04-28 — **로그아웃 UI** + 현재 사용자 표시 (TopNav 우측 + Settings AccountPanel). 새 endpoint `GET /api/auth/me`, 새 client repo `lib/repo/auth.ts` (`getMe`, `logout`), store 에 `me: Me | null` 추가.
- 2026-04-28 — **주간 그리드 UX/디자인 개선** (당시 구현 플랜은 현재 저장소에서 제거됨).
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
