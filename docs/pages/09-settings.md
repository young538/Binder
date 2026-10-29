# 설정과 데이터 가져오기·내보내기

[전체 목차](../README.md) · [운영](../04-development-and-operations.md) · [API](../03-api.md)

## 화면 구성

`/settings`는 계정, 카테고리, 환경 설정, 데이터 내보내기, 데이터 가져오기 순서입니다. 최대 폭을 제한한 세로 카드 화면이며 모바일에서도 같은 구성을 사용합니다. 습관 편집은 현재 일일 페이지의 루틴 관리에 있습니다.

## 계정과 카테고리

계정 카드에서 현재 사용자 이름을 보고 로그아웃합니다. 사용자 추가·비밀번호 변경·계정 삭제는 CLI 기능입니다.

카테고리 편집은 이름·색 변경, 추가·삭제를 제공합니다. 이름과 색은 포커스 이탈 시 변경값을 저장하고 공통 저장소를 reload합니다. 카테고리는 시간블록·TODO·습관의 색과 분류에 사용하며 독서의 자유 텍스트 category와 다릅니다.

카테고리 삭제는 해당 행만 지웁니다. 기존 시간블록·TODO·습관의 연결 ID를 자동 교체하지 않으므로 대체 색이나 삭제됨 표시가 나타날 수 있습니다.

## 환경 설정

| 설정 | 기본값 | 현재 적용 |
|---|---|---|
| 주 시작일 | 월요일 | 저장 가능; 달력·ISO 주차는 현재 월요일 고정 |
| 그리드 단위 | 30분 | 30/60분, 시간표 행과 편집 시간 스냅 |
| 시작 시각 | 6 | 일일·주간 시간표 표시 시작, 새 블록 기본 시작 |
| 종료 시각 | 23 | 일일·주간 시간표 표시 종료 |
| 테마 | light | html data-theme, dark 스타일 |

선택·입력 변경 즉시 PATCH하고 공통 데이터를 다시 읽습니다. 설정 행이 없으면 GET은 기본값만 반환하며 첫 PATCH에서 행을 생성합니다. 서버는 허용 필드·enum·시간 범위를 검증하고, SettingsRepository가 기존 설정과 합친 시작·종료 순서를 저장 트랜잭션 안에서 다시 검사합니다.

## JSON 내보내기

`GET /api/export`가 **현재 계정**의 10개 도메인 배열과 설정을 반환하고 브라우저가 `super-planner-YYYY-MM-DD.json`을 다운로드합니다. UI의 “전체”는 전체 계정 DB가 아니라 로그인 계정의 데이터 전체입니다.

목표, 카테고리, 시간블록, 회고, TODO, 한 문장, 연간 목표, 습관, 습관 로그, 책이 포함됩니다. 사용자 인증 테이블과 비밀번호 해시는 포함되지 않습니다. 형식은 version 10, generatedAt이며 설정에 저장 행이 없으면 settings는 null일 수 있습니다.

## JSON 가져오기

파일 선택 → JSON 파싱 → 종류별 입력 개수 미리보기 → 병합/덮어쓰기 선택 → 가져오기 순서입니다. 덮어쓰기는 추가 확인창이 있습니다.

| 모드 | 현재 서버 동작 |
|---|---|
| merge | 기존 행 유지, ID 충돌은 건너뛰기; 기존 행을 수정하는 병합은 아님 |
| replace | 현재 계정의 10개 도메인 테이블 행을 삭제한 후 입력 삽입 |
| settings | 모드와 관계없이 제공된 설정 객체가 있으면 upsert |

모든 입력 행의 userId는 세션 사용자로 덮어씁니다. 행의 ID는 새로 발급하지 않습니다. 다른 계정의 기존 ID와 충돌하면 전체 요청을 400으로 거절하며, 같은 계정의 기존 ID만 merge에서 건너뜁니다. replace에서도 settings를 무조건 지우지는 않으므로 파일에 settings가 없으면 기존 설정이 남습니다.

가져오기 검증과 저장은 BackupService의 단일 즉시 DB 트랜잭션으로 실행합니다. 삽입 중 오류가 발생하면 삭제를 포함해 롤백하고 500 오류를 반환합니다. 응답 counts는 입력 배열 길이이며 실제 삽입 수와 다를 수 있습니다.

성공 후 목표·카테고리·설정을 공통 저장소에 다시 읽고 구독 중인 도메인 목록에도 변경을 알립니다. 별도 새로고침 없이 반영됩니다. 저장은 성공했지만 재조회가 실패한 경우 그 상태를 구분해 새로고침 안내를 표시합니다. 서버는 컬렉션·필드·날짜·참조 소유권·중복 ID를 쓰기 전에 검증합니다. 파일 version을 이용한 자동 형식 변환은 제공하지 않습니다. 가져온 습관과 로그에 맞춰 연간 목표 집계도 정리합니다.

## 구현 파일

| 파일 | 역할 |
|---|---|
| [AccountPanel](../../components/settings/AccountPanel.tsx) | 계정·로그아웃 |
| [CategoryEditor](../../components/settings/CategoryEditor.tsx) | 카테고리 CRUD |
| [SettingsForm](../../components/settings/SettingsForm.tsx) | 표시 설정 즉시 저장 |
| [DataExportPanel](../../components/settings/DataExportPanel.tsx) | JSON 다운로드 |
| [DataImportPanel](../../components/settings/DataImportPanel.tsx) | 파일 파싱·미리보기·실행 결과·공통 데이터 갱신 |
| [백업 클라이언트](../../lib/repo/backup.ts) | 가져오기 전송과 리소스 변경 알림 |
| [내보내기 API](../../app/api/export/route.ts) / [가져오기 API](../../app/api/import/route.ts) | 인증과 HTTP 응답 |
| [BackupService](../../lib/server/backup/service.ts) / [UserBackupRepository](../../lib/server/backup/repository.ts) | 검증·트랜잭션·사용자 필터·집계 |
| [SettingsRepository](../../lib/server/repos/settings.ts) | 기본 설정과 원자적 갱신 |

DB 전체 백업은 이 JSON과 범위가 다릅니다. 사용자 인증과 모든 계정까지 보존하려면 [운영 문서의 SQLite 백업](../04-development-and-operations.md)을 사용합니다.
