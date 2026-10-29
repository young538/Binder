# Super 플래너 (Binder)

목표를 세우고, 연간 수치와 월·주·일 할 일을 관리하며, 습관·시간·독서·회고를 기록하는 개인 플래너입니다. 하나의 서버에서 여러 계정이 각자 데이터를 관리합니다.

**[프로젝트 문서 목차](docs/README.md)에서 시작하세요.** 2026-10-29 작업 트리의 코드와 문서를 대조해 페이지별 기능·조작법·저장 방식·관련 파일·구현 한계를 정리했습니다.

## 프로젝트 설명

| 내용 | 문서 |
|---|---|
| 전체 화면과 읽는 순서 | [문서 목차](docs/README.md) |
| 폴더 구조, 공통 UI, 데이터 흐름 | [구조와 공통 구현](docs/01-architecture.md) |
| 데이터 관계, 저장 키, 자동 집계 | [데이터 모델](docs/02-data-model.md) |
| 전체 API 요청과 응답 | [API 명세](docs/03-api.md) |
| 설치, 계정 관리, Docker, 백업·복구 | [개발과 운영](docs/04-development-and-operations.md) |
| 테스트, 현재 제약, 유지보수 | [검증과 구현 한계](docs/05-verification-and-limitations.md) |
| 책임 분리, 기능 확장 방법 | [유지보수 가이드](docs/06-maintenance.md) |
| 1차 문서 대조 결과 | [소스·문서 점검 기록](docs/07-source-doc-audit.md) |
| 보안·자동 백업·CI·TODO 편의 기능·검색 | [후속 개선 기록](docs/09-follow-up-improvements.md) |
| 전체 계층 리팩토링과 최종 검증 | [전체 리팩토링 기록](docs/08-full-refactor.md) |

## 페이지별 설명

[로그인·공통 이동](docs/pages/01-login-and-navigation.md) · [One-Thing](docs/pages/02-mandalart.md) · [연간](docs/pages/03-annual.md) · [월간](docs/pages/04-monthly.md) · [주간](docs/pages/05-weekly.md) · [일일](docs/pages/06-daily.md) · [회고](docs/pages/07-retrospective.md) · [독서](docs/pages/08-reading.md) · [설정](docs/pages/09-settings.md)

## 기술 구성

Next.js 16.4.3 / React 19.2.4 / TypeScript / Tailwind CSS 4 / Zustand / SQLite + Drizzle ORM / iron-session + argon2 / Vitest + Playwright.

라우팅은 `app/`, 화면은 `components/`, 브라우저 API 호출은 `lib/repo/`, DB 처리는 `lib/server/`에 있습니다. 실행 전 [환경변수와 초기화 순서](docs/04-development-and-operations.md)를 확인하세요.
