# 일일·주간 회고

[전체 목차](../README.md) · [주간 시간표](05-weekly.md) · [집계 규칙](../02-data-model.md)

## 진입점

주간 회고는 `/retrospective/week/[isoweek]`에서 엽니다. 일일 회고는 일일 화면 하단에 인라인으로 표시하고, 주간 화면의 날짜별 버튼에서는 시트로 엽니다. 독립된 일일 회고 URL은 없습니다.

## 공통 작성 필드

`RetroTemplate`를 공유합니다. 1~5점 이모지 평가, 좋았던 것(`good`), 아쉬운 것(`bad`), 내일/다음주 1가지(`nextStep`), 자유 메모(`freeText`)입니다.

주간은 `type=weekly`, `dateOrWeek=2026-W37`, 일일은 `type=daily`, `dateOrWeek=2026-09-07`로 조회·저장합니다. 데이터가 없으면 빈 양식으로 시작합니다. 입력에서 약 1초 후 PUT하며 별도 저장 버튼은 없습니다.

클라이언트는 수정한 필드만 사용자·기간별 공통 저장 큐에 넣습니다. 날짜·주차 변경 시 이전 조회 응답을 무시하고, 닫기·이동 때 보류 저장을 즉시 요청합니다. 실패한 입력은 큐와 sessionStorage 초안에 남고 재시도할 수 있습니다. 서버는 트랜잭션 안에서 template의 개별 필드를 합쳐 독서와 회고가 서로 덮어쓰지 않도록 합니다.

## 주간 통계

선택 주 월~일의 시간블록·일일 TODO·습관 로그와 전체 습관을 조회합니다.

| 통계 | 실제 계산 |
|---|---|
| TODO 완료율 | 해당 주 `scope=day` TODO 중 done 수 / 전체 수 |
| 상태별 수 | done·postponed·delegated·cancelled 수 |
| 습관 달성률 | 해당 주 유효한 중복 제거 체크 수 / 일정별 기대치 합 |
| 총 기록 시간 | actual 블록의 `(endMin-startMin)` 합 / 60 |
| 카테고리별 | actual 블록을 categoryId별 합산 |
| 목표별 | actual 블록을 goalId별 합산; 미지정 별도 |
| TODO별 | actual 블록을 todoId별 합산; 미연결 별도 |
| 요일별 | actual 블록을 날짜별 합산하고 최대값 대비 막대 표시 |

취소·연기·위임 TODO도 완료율 분모에 들어갑니다. 주 TODO(`scope=week`) 자체는 이 완료율에 포함하지 않습니다. 습관 기대치는 매일/요일형의 해당 날짜 수, 주 N회의 N, 월 N회의 날짜 비율 환산값으로 계산하며 습관별 반올림합니다.

시간은 겹친 블록도 각각 더합니다. TODO가 삭제되었거나 조회 범위에 없으면 연결 ID가 있어도 삭제된 TODO라는 대체 문구가 나올 수 있습니다. 시간 연결과 실제 TODO 상태는 별개입니다.

## 일일 시트

모바일에서는 아래쪽, 큰 화면에서는 중앙 모달 형태입니다. 닫기·배경 클릭·Escape로 닫을 수 있습니다. 주간 요약 통계를 재사용하지 않고 해당 날짜 회고 양식을 보여줍니다.

같은 날짜의 일일 독서도 동일 회고 레코드의 `template.reading`을 사용합니다. 서버는 전달된 template 필드만 합칩니다. 독서와 회고는 같은 행을 공유하지만 각 편집기의 변경 필드만 저장합니다. 병합·동시 편집의 한계는 [일일 문서](06-daily.md)에 설명합니다.

## 구현 파일

| 파일 | 역할 |
|---|---|
| [WeeklyRetroPage](../../components/retro/WeeklyRetroPage.tsx) | AsyncResource로 주간 데이터 조회, 회고 자동 저장 |
| [WeeklySummary](../../components/retro/WeeklySummary.tsx) | 통계 카드·막대 |
| [RetroTemplate](../../components/retro/RetroTemplate.tsx) | 공통 양식 |
| [DailyRetroSheet](../../components/week/DailyRetroSheet.tsx) | 일일 회고 시트 |
| [aggregate.ts](../../lib/aggregate.ts) | 그룹별 분 합산 |
| [회고 repository](../../lib/server/repos/retrospectives.ts) | 사용자·기간별 조회 및 upsert |

`aggregate.ts` 함수 자체는 plan/actual을 필터링하지 않습니다. 호출하는 `WeeklySummary`와 `GoalCoverageBar`에서 actual을 먼저 선택합니다. 다른 호출부까지 실제만 합산한다고 일반화하면 안 됩니다.
