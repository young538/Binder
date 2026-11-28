---
name: life-os-wiki
description: >-
  Karpathy LLM Wiki workflow (Ingest, Query, Lint) integrated with Super 플래너 (Binder Life OS) under `2. Wiki/`.
  Use when the user asks to ingest notes/PDFs/links or Life OS snapshots into the wiki, query/synthesize across their personal wiki, run weekly/monthly wiki maintenance (lint), or organize `2. Wiki/`.
---

# Life OS LLM Wiki (Karpathy Pattern)

`2. Wiki/` is the user's persistent, compounding Markdown knowledge base following Andrej Karpathy's three-layer LLM Wiki pattern.

Before any Ingest, Query, or Lint operation, **always read `2. Wiki/SCHEMA.md` and `2. Wiki/index.md`**.

## 3-Layer Structure

1. **Layer 1 (`2. Wiki/raw/`) — Immutable Raw Sources**:
   - `raw/inbox/`: User-dropped articles, notes, PDFs, spreadsheets, images (uploaded via `/wiki` or local copy). **Never modify or delete files here.**
   - `raw/life-os/`: Automated snapshots exported from Binder's SQLite DB via `0. Source/scripts/export-life-os-raw.mjs`.
2. **Layer 2 (`2. Wiki/wiki/`) — Agent-Maintained Interlinked Markdown**:
   - `wiki/life/`: Goals, principles, decision reviews, finance/health/execution patterns.
   - `wiki/topics/`: Living concept syntheses across multiple sources.
   - `wiki/sources/`: Structured summaries of books, lectures, papers, and clipped articles.
   - `wiki/synthesis/`: Durable answers and strategic memos promoted from Query sessions.
3. **Layer 3 (`2. Wiki/SCHEMA.md`, `index.md`, `log.md`) — Schema & Control Plane**:
   - Follow exact YAML frontmatter (`title`, `category`, `tags`, `updated`, `summary`, `sources`) and `[[wikilink]]` rules in `2. Wiki/SCHEMA.md`.

## Operations

### 1. Ingest
1. If syncing Life OS activity (weekly or on request), run from workspace root:
   ```pwsh
   node "0. Source/scripts/export-life-os-raw.mjs" --mode weekly --username young538
   ```
2. Read `2. Wiki/index.md` and `2. Wiki/log.md` (tail) to identify files in `raw/inbox/` and `raw/life-os/` not yet ingested.
3. Read each un-ingested source carefully:
   - Create or update a structured page in `wiki/sources/` (or update relevant `wiki/life/` for Life OS snapshots).
   - Update 3–10 related pages across `wiki/topics/` and `wiki/life/` with synthesized insights and bidirectional `[[wikilink]]` references.
   - If new facts contradict existing wiki claims or principles, flag the tension explicitly (`> [!warning] 점검 필요: ...`).
4. Update `2. Wiki/index.md` with 1-line summaries for every added/updated page.
5. Append an entry to `2. Wiki/log.md` in format:
   `## [YYYY-MM-DD] ingest | <summary of sources ingested and pages touched>`

### 2. Query (With Persistent Memory)
1. **Recall prior Q&A first**: Read `2. Wiki/index.md` and scan existing `2. Wiki/wiki/synthesis/*.md` pages (checking `question:` frontmatter/summaries) to check what you and the user already analyzed or concluded earlier on this topic.
2. **Synthesize from compiled wiki**: Read the relevant `wiki/**/*.md` pages (falling back to `raw/` only when fine detail is missing from `wiki/`) and write a grounded answer citing exact `[[wikilinks]]`.
3. **Auto file-back valuable Q&A (Query Memory)**: Unless the user asks for an ephemeral quick lookup (or asks not to save), automatically write meaningful/reusable Q&A conclusions into `2. Wiki/wiki/synthesis/YYYY-MM-DD-<slug>.md` with `question: "<original question>"`, `category: synthesis`, `tags`, `updated`, `summary`, `sources`, and `[[wikilinks]]`. Update `2. Wiki/index.md` and append `## [YYYY-MM-DD] query | <question summary> -> <synthesis path>` to `2. Wiki/log.md`.

### 3. Lint
1. Audit `2. Wiki/`:
   - Broken `[[wikilinks]]` pointing to missing pages.
   - Orphan pages under `wiki/` with zero incoming links (and not listed properly in `index.md`).
   - Duplicate/overlapping topic pages ready to merge.
   - **Life OS Principle vs. Behavior Audit**: compare `wiki/life/` stated principles/goals with recent `raw/life-os/` spending, sleep/energy, and retrospective data.
2. Fix straightforward link/index issues directly, summarize contradictions for the user, and append `## [YYYY-MM-DD] lint | ...` to `2. Wiki/log.md`.
