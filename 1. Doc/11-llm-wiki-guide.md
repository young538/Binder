# Karpathy LLM Wiki 사용 가이드 · 프롬프트 예제

[전체 목차](README.md) · [인생 OS 상세](pages/11-life-os.md#10-karpathy-llm-wiki-통합-wiki) · [전용 에이전트 스킬](../.agents/skills/life-os-wiki/SKILL.md)

이 문서는 Super 플래너(Binder)에 통합된 **Andrej Karpathy식 LLM Wiki**를 일상에서 실제로 굴리는 방법과 **바로 복사해 쓸 수 있는 프롬프트 예제**를 정리한 안내서입니다.

---

## 1. 한눈에 보는 3계층 구조와 역할 분담

일반 챗봇/RAG는 질문할 때마다 원본을 처음부터 다시 읽지만, LLM Wiki는 **에이전트가 지식을 미리 주제별 문서로 컴파일·상호 링크하고 질문과 결론까지 다시 위키에 축적**합니다.

| 계층 | 실제 위치 | 누가 고치나? | 역할 |
|---|---|---|---|
| **Layer 1: Raw** | `2. Wiki/raw/inbox/`<br>`2. Wiki/raw/life-os/` | 사용자 투입 · 추출 스크립트<br>*(에이전트 수정 금지)* | 웹 기사, PDF, 강의 메모, Binder 주간 스냅샷 등 **불변 원본** |
| **Layer 2: Wiki** | `2. Wiki/wiki/life/`<br>`2. Wiki/wiki/topics/`<br>`2. Wiki/wiki/sources/`<br>`2. Wiki/wiki/synthesis/` | **Antigravity 에이전트** | 출처 요약(`sources/`), 주제 개념(`topics/`), 삶·원칙(`life/`), **질문·답변 기억본(`synthesis/`)** |
| **Layer 3: Schema** | `2. Wiki/SCHEMA.md`<br>`2. Wiki/index.md`<br>`2. Wiki/log.md` | 에이전트 + 규약 관리 | 폴더/Frontmatter/링크 규칙, 마스터 목차, 작업 이력(Ingest · Query · Lint) |

- **Binder 웹 `/wiki` 역할**: 읽기, `[[위키링크]]`·백링크 탐색, `Ctrl+K` 통합 검색, 모바일·PC에서 **`+ Raw 넣기`** 로 원문/파일 던져두기.
- **Antigravity 역할**: Raw → 다중 위키 문서 컴파일(**Ingest**), 과거 질문 기억을 포함한 교차 질의·저장(**Query**), 링크·모순 점검(**Lint**).

---

## 2. 일상 운영 4단계 루틴

1. **평소 (10초 — 수집)**: 읽은 좋은 글, 유튜브 스크립트, 투자/업무 강의 PDF, 문득 떠오른 아이디어를 `/wiki` 상단 **`+ Raw 넣기`**(또는 `2. Wiki/raw/inbox/` 복사)에 그대로 넣어둡니다.
2. **수시 또는 주 1회 (Ingest)**: Antigravity에게 *"Raw 수집함에 넣은 것 위키에 반영해줘"* 또는 *"이번 주 라이프 OS도 뽑아서 같이 반영해줘"* 라고 시킵니다. 에이전트가 원본을 읽어 `sources/` 요약을 만들고 관련된 `topics/`·`life/` 문서 여러 개를 동시에 갱신·연결합니다.
3. **궁금할 때 (Query + 자동 기억)**: Antigravity에게 질문하면 먼저 `index.md`와 기존 `wiki/synthesis/`를 확인해 **과거에 나눈 질문·결론까지 함께 기억한 상태**로 답합니다. 재사용 가치가 있는 질의·결론은 `wiki/synthesis/YYYY-MM-DD-주제.md`에 `question:` 메타데이터와 함께 자동 저장되어 다음 질문의 밑거름이 됩니다.
4. **월 1회 — 매월 24일 월급 주기 결산 시 (Lint)**: 깨진 `[[링크]]`, 고아 문서, 중복 주제를 정리하고 **"적어둔 내 원칙 vs 실제 한 달 행동(회고·가계부·컨디션)"** 사이의 괴리를 감사(Audit)합니다.

---

## 3. 바로 복사해 쓰는 프롬프트 예제

### A. 자료 투입 & 컴파일 (Ingest)

1. **웹 `/wiki`에 메모나 PDF를 던져둔 뒤 반영할 때**:
   > `2. Wiki/raw/inbox/` 에 새로 올라온 파일들 확인해서 위키에 Ingest 해줘. 관련 기존 문서랑 `[[위키링크]]`도 연결하고 `index.md`랑 `log.md`까지 갱신해 줘.

2. **특정 공부 주제(예: 주식 강의·책·PDF)를 기존 내 데이터와 엮어 넣고 싶을 때**:
   > `2. Wiki/raw/inbox/`에 올린 투자 강의 자료를 읽고 `wiki/sources/`에 요약 만든 다음, 내 `제2수입 및 자산 성장`·`재무 현황과 소비 원칙` 문서랑 교차 연결해 줘. 내 현재 저축 여력과 충돌하는 전제가 있으면 경고로 표시해 줘.

3. **이번 주 Binder 활동(회고·독서·가계부·건강)까지 묶어서 반영할 때**:
   > `export-life-os-raw.mjs`로 이번 주 Life OS 스냅샷(`weekly`) 추출하고 `raw/inbox/` 새 자료랑 합쳐서 위키에 반영해 줘.

---

### B. 질문하고 기억 쌓기 (Query & File-back)

4. **교차 도메인 의사결정 질의 (기본 — 가치 있는 답변은 `synthesis/`에 자동 기억)**:
   > 내 위키 기준으로 최근 1개월간 목표·회고·가계부·수면 기록을 같이 보고, 다음 달 순현금과 컨디션을 동시에 끌어올릴 핵심 행동 딱 2가지만 추려줘.

5. **과거 질문 히스토리를 이어서 비교 질의**:
   > 예전에 `wiki/synthesis/`에 저장해 둔 지난 점검 결론이랑 비교해서, 최근 2주 사이 실제로 바뀐 점과 아직 안 풀린 병목이 뭔지 짚어줘. 이번 비교 결과도 위키에 기억해 둬.

6. **가벼운 단발성 질문 (위키에 저장하지 않고 답만 보고 싶을 때)**:
   > *(위키 저장 없이)* 지금 내 위키에 적힌 활성 구독 목록 금액만 합쳐서 알려줘.

---

### C. 건강검진 · 모순 점검 (Lint)

7. **위키 전체 구조 + 원칙 vs 행동 괴리 점검**:
   > `life-os-wiki` 스킬 기준으로 위키 전체 Lint 돌려줘. 깨진 링크, 고아 문서, 중복 주제 찾고, `내 원칙` 문서 내용과 최근 회고·가계부·컨디션 기록 사이에 어긋나는 지점도 리포트해 줘.

---

## 4. CLI 추출 & `/schedule` 예약 자동화 예제

### 수동 스냅샷 추출 (`0. Source/` 또는 저장소 루트)

```pwsh
# 초기 전체 시드 추출
node "0. Source/scripts/export-life-os-raw.mjs" --mode seed --username young538

# 최근 7일 주간 스냅샷 + 현재 월급 주기 재무 요약 추출
node "0. Source/scripts/export-life-os-raw.mjs" --mode weekly --username young538
```

참고 구현: [스냅샷 추출기](../0.%20Source/scripts/export-life-os-raw.mjs) · [위키 규칙 템플릿](../0.%20Source/scripts/wiki-schema-template.md)

### Antigravity `/schedule` 자동화 추천 설정

Antigravity 채팅창에서 `/schedule`을 입력한 뒤 아래와 같이 두 개를 등록해 두면 수동으로 신경 쓰지 않아도 위키가 자랍니다.

| 주기 (Cron) | 추천 이름 | 예약 프롬프트 |
|---|---|---|
| **매주 일요일 22:00**<br>`0 22 * * 0` | 주간 Life OS 위키 Ingest | `life-os-wiki 스킬 절차대로 0. Source/scripts/export-life-os-raw.mjs --mode weekly --username young538 를 실행하고, 2. Wiki/raw/inbox/ 의 미처리 자료와 함께 이번 주 스냅샷을 Ingest 해줘.` |
| **매월 24일 21:00**<br>`0 21 24 * *` | 월간 위키 Lint 감사 | `life-os-wiki 스킬의 Lint 절차대로 2. Wiki/ 전체의 깨진 링크·고아 문서·중복 주제를 점검하고, 내 원칙/목표와 이번 달 회고·재무·컨디션 사이의 괴리를 정리해 wiki/synthesis/ 와 log.md 에 남겨줘.` |

---

## 5. 질문 기억용 Frontmatter 예시 (`wiki/synthesis/`)

질문과 답변이 `2. Wiki/wiki/synthesis/`에 저장될 때는 아래와 같이 원래 질문(`question`)과 근거(`sources`)를 함께 남겨, 이후 검색(`/search`, `Ctrl+K`)이나 후속 질의에서 맥락을 잃지 않게 합니다.

```yaml
---
title: 2026-12 핵심 레버리지 2가지
category: synthesis
question: 다음 달 순현금과 컨디션을 동시에 끌어올릴 핵심 행동은?
tags: [질문기억, 재무, 수면, 실행]
updated: 2026-12-01
summary: 23시 취침 방어와 주간 일요일 가계부 5분 정리로 월 15~20만 원 절감 + 에너지 회복 도출
sources: [wiki/life/내-원칙과-수면-루틴.md, wiki/life/재무-현황과-소비-원칙.md]
---
```

---

## 6. 보안 · 개인정보 격리 규칙

- **GitHub 원격 저장소 분리**: `2. Wiki/` 전체는 루트 `.gitignore`에 포함되어 코드 저장소에 커밋·푸시되지 않으며 로컬 디스크에만 보관됩니다.
- **웹 컨테이너 연결 & 소유자 격리**: Docker Compose는 `../2. Wiki:/app/wiki`를 연결하며, `WIKI_OWNER_USERNAME=young538` 계정만 `2. Wiki/`를 보고 다른 사용자는 `.users/<userId>/`로 자동 분리됩니다.
- **경로 이탈 차단**: API는 `raw/inbox/` 쓰기와 `SCHEMA.md`·`index.md`·`log.md`·`wiki/**/*.md`·`raw/**/*` 읽기만 허용하고 `..`·숨김 폴더 접근을 차단합니다.
