# LLM Wiki 운영 규칙 (SCHEMA)

이 지식베이스는 Andrej Karpathy의 **LLM Wiki** 패턴을 따르며, Binder(Super 플래너) 라이프 OS 데이터와 개인 학습·관심 자료를 복리로 축적합니다.

## 1. 계층 구조

| 폴더/파일 | 역할 | 편집 규칙 |
|---|---|---|
| `raw/inbox/` | 사용자가 넣은 원문 메모, 링크, PDF, CSV, 이미지 | **읽기 전용(불변)**. 에이전트가 수정/삭제하지 않음 |
| `raw/life-os/` | `export-life-os-raw.mjs`로 추출한 Binder 스냅샷 | **읽기 전용(불변)** |
| `wiki/life/` | 목표, 원칙, 의사결정 복기, 재무/건강/실행 패턴 | 에이전트가 지속 업데이트 |
| `wiki/topics/` | 책·강의·경험에서 도출한 주제별 개념 노트 | 여러 출처가 모일수록 내용을 통합·심화 |
| `wiki/sources/` | 책, 아티클, 강의, PDF 개별 요약 | 출처당 1페이지 원칙 |
| `wiki/synthesis/` | 질의(Query) 중 나온 가치 있는 전략·통찰 승격본 | 향후 질의의 1차 재료로 재사용 |
| `index.md` | 전체 위키 마스터 목차 및 한 줄 요약 | 페이지 추가/수정 시 항상 함께 갱신 |
| `log.md` | 시간순 작업 로그 (`ingest`, `query`, `lint`) | 맨 아래 또는 상단에 **추가만(Append-only)** |

## 2. 문서 작성 및 Frontmatter 규약

모든 `wiki/**/*.md` 파일은 상단에 YAML Frontmatter를 포함합니다.

```yaml
---
title: 문서 제목
category: topics # life | topics | sources | synthesis
question: 질의 기억 문서(synthesis)일 때 원래 질문 (선택)
tags: [태그1, 태그2]
updated: YYYY-MM-DD
summary: 한 줄 요약
sources: [raw/life-os/..., wiki/sources/...]
---
```

## 3. 링크(`[[위키링크]]`) 규약

- 문서 간 연결은 `[[문서-슬러그]]` 또는 `[[wiki/topics/문서-슬러그|표시 제목]]` 형식을 사용합니다.
- 모든 위키 문서는 최소 1개 이상의 다른 문서에서 링크되거나 `index.md`에 등재되어 고아 문서가 되지 않도록 유지합니다.
- 기존 원칙·판단과 충돌하는 사실이 들어오면 기존 내용을 조용히 덮어쓰지 말고 `> [!warning]` 또는 본문 섹션에 **모순/변화 이력**을 명시합니다.

## 4. 3대 작업 루프

1. **Ingest**: `raw/inbox/` 또는 `raw/life-os/`의 신규 자료를 읽어 `sources/`에 요약하고, 관련 `topics/`·`life/` 문서 3~10개에 지식을 반영한 뒤 `index.md`·`log.md` 갱신.
2. **Query (질문 자동 기억)**: 질문 시 먼저 `index.md`와 기존 `wiki/synthesis/`를 확인해 과거 질문·결론을 회상한 뒤, 관련 `wiki/` 문서 근거 `[[링크]]`와 함께 답변. 재사용 가치가 있는 Q&A·결론은 `wiki/synthesis/YYYY-MM-DD-주제.md`에 `question:` 메타데이터와 함께 자동 저장하고 `index.md`·`log.md`에 기록.
3. **Lint**: 주기적으로 깨진 `[[링크]]`, 고아 문서, 중복 주제, "적어둔 원칙 vs 실제 최근 행동" 괴리를 점검하고 `log.md`에 기록.
