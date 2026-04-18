#!/usr/bin/env node
// HTML 파서: 2026 바인더 Google Sheets export → seed-2026.json
// 사용: node scripts/parse-binder.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { ulid } from 'ulid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = 'C:/Users/young/Desktop/young/5. 3P바인더/바인더(young)_2026년';
const OUTPUT = resolve(__dirname, 'data/seed-2026.json');

const YEAR = 2026;
const NOW = new Date().toISOString();

// ───── 유틸 ─────
// '|' 토큰은 <br> → 줄바꿈으로 복원
const cleanText = (s) =>
  (s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\|\s*/g, '\n')
    .trim();
const pad2 = (n) => String(n).padStart(2, '0');
const isoDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

// ISO 주차의 월요일 → YYYY-MM-DD
function mondayOfIsoWeek(year, week) {
  // ISO: Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7; // Sun=0 → 7
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1));
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  return target;
}

function datesForIsoWeek(year, week) {
  const mon = mondayOfIsoWeek(year, week);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    return isoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  });
}

function loadHtml(filename) {
  const path = join(SOURCE_DIR, filename);
  if (!existsSync(path)) {
    console.warn(`[skip] file not found: ${path}`);
    return null;
  }
  return cheerio.load(readFileSync(path, 'utf-8'));
}

// 행에서 { col, cs, rs, cls, text } 셀 배열 추출
function extractRowCells($, $tr) {
  const cells = [];
  let col = 1;
  $tr.find('td').each((_, td) => {
    const $td = $(td);
    const cs = parseInt($td.attr('colspan') || '1', 10);
    const rs = parseInt($td.attr('rowspan') || '1', 10);
    const cls = $td.attr('class') || '';
    // <br>은 줄바꿈(|)으로 변환 후 텍스트 추출
    const html = $td.html() || '';
    const text = cleanText(
      html.replace(/<br\s*\/?\s*>/gi, '|').replace(/<[^>]+>/g, ''),
    );
    cells.push({ col, cs, rs, cls, text });
    col += cs;
  });
  return cells;
}

// 텍스트가 날짜/숫자 헤더인지
const isDateHeader = (s) => /^\d{1,2}\/\d{1,2}\([월화수목금토일]\)$/.test(s);
const isNumberOnly = (s) => /^\d{1,3}$/.test(s);

// ───── 만다라트 ─────
function parseMandalart() {
  const $ = loadHtml('만다라트.html');
  if (!$) return [];

  // 만다라트 본체는 시각적 row 4-12 (1-based, 헤더행 + 빈행 제외).
  // cheerio <tr> 인덱스: 0=th 헤더 / 1=시각1행 / ... / 4=시각4행(데이터 시작) / ... / 12=시각12행(데이터 끝)
  const grid = []; // grid[r][c] (r=0..8, c=0..8)
  for (let r = 0; r < 9; r++) grid.push(new Array(9).fill(''));

  const $rows = $('tr');
  // 데이터 row: cheerio index 4..12 (총 9개)
  for (let dataRowIdx = 0; dataRowIdx < 9; dataRowIdx++) {
    const tr = $rows.get(4 + dataRowIdx);
    if (!tr) continue;
    const cells = extractRowCells($, $(tr));
    // col 2..10 위치의 셀 9개 (s5,s10,s7 등 우측끝 셀 등 모두 포함)
    for (let c = 0; c < 9; c++) {
      const targetCol = 2 + c;
      const cell = cells.find((x) => x.col === targetCol);
      grid[dataRowIdx][c] = cell ? cell.text : '';
    }
  }

  // 9×9 → 3×3 블록 9개로 나누기, 각 블록은 3×3 셀
  // 중앙 블록(블록 좌표 1,1)의 중앙(1,1) = oneThing
  // 중앙 블록의 다른 8개 = 8 cores (블록 위치 0,0 0,1 0,2 1,0 1,2 2,0 2,1 2,2)
  // 외곽 블록 8개 각각: 중앙(1,1)은 해당 코어의 복사본, 나머지 8개가 sub
  const blockOf = (r, c) => [Math.floor(r / 3), Math.floor(c / 3)];
  const goals = [];
  const coreIds = []; // 블록 인덱스 0..7 → core id (블록 순서: TL,TM,TR,ML,MR,BL,BM,BR)

  // oneThing
  const oneThingTitle = grid[4][4] || '2026 원씽';
  const oneThingId = ulid();
  goals.push({
    id: oneThingId,
    title: oneThingTitle,
    level: 'oneThing',
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  });

  // 8 cores: 중앙 블록(블록좌표 1,1, 즉 row 3-5 col 3-5)의 중앙(4,4)을 제외한 8셀
  // 블록 내 위치 (br, bc) for br,bc in 0..2 except (1,1)
  // 외곽 블록 매핑: 중앙 블록의 (br,bc) ↔ 외곽 블록 좌표 (br,bc)
  const coreCellsInCenter = [];
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      if (br === 1 && bc === 1) continue;
      coreCellsInCenter.push([br, bc]);
    }
  }

  let coreOrder = 0;
  for (const [br, bc] of coreCellsInCenter) {
    const r = 3 + br;
    const c = 3 + bc;
    const title = grid[r][c] || `핵심${coreOrder + 1}`;
    const id = ulid();
    coreIds.push(id);
    goals.push({
      id,
      title,
      parentId: oneThingId,
      level: 'mandalartCore',
      order: coreOrder,
      createdAt: NOW,
      updatedAt: NOW,
    });
    coreOrder++;
  }

  // 외곽 블록 8개의 sub (각 8개)
  // 블록 좌표 매핑: 코어가 중앙 블록 (br,bc) 위치였다면, 외곽 블록은 (br,bc) 위치 (전체 9×9에서 row=3*br ~ 3*br+2, col=3*bc ~ 3*bc+2)
  for (let i = 0; i < coreCellsInCenter.length; i++) {
    const [br, bc] = coreCellsInCenter[i];
    const coreId = coreIds[i];
    let subOrder = 0;
    for (let sr = 0; sr < 3; sr++) {
      for (let sc = 0; sc < 3; sc++) {
        if (sr === 1 && sc === 1) continue; // 외곽 블록의 중앙은 코어 복사본
        const r = br * 3 + sr;
        const c = bc * 3 + sc;
        const title = grid[r][c];
        if (!title) {
          subOrder++;
          continue;
        }
        goals.push({
          id: ulid(),
          title,
          parentId: coreId,
          level: 'mandalartSub',
          order: subOrder,
          createdAt: NOW,
          updatedAt: NOW,
        });
        subOrder++;
      }
    }
  }

  return goals;
}

// ───── 원씽 ─────
function parseOneThing() {
  const $ = loadHtml('원씽.html');
  if (!$) return [];
  const notes = [];

  // Year onething: row 2 (1-based), col F-J 한 셀 (colspan=4)
  // → 모든 td에서 "⭐2026년 원씽" 라벨이 있는 행 찾고, 그 다음 텍스트 셀
  let yearText = '';
  $('tr').each((_, tr) => {
    const cells = extractRowCells($, $(tr));
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].text === '⭐2026년 원씽' && cells[i + 1]) {
        yearText = cells[i + 1].text;
      }
    }
  });
  if (yearText) {
    notes.push({
      id: ulid(),
      scope: 'year',
      scopeKey: `year:${YEAR}`,
      text: yearText,
      updatedAt: NOW,
    });
  }

  // 월간/주간 onething: 분기 행 구조 추적
  // row 6~17 (1-based) 데이터 영역. 각 row는 [(분기), (분기원씽), 월라벨, 월원씽, 5×주차원씽] 구성.
  // rowspan으로 분기 셀이 3행 스팬 → 분기 셀이 있는 행만 9 cell, 없는 행은 7 cell.
  // 각 행에서 '월라벨' 셀 위치: col=4 (rowspan으로 분기/분기원씽 col 2,3 차지) 또는 분기 셀 없을때 col=2부터 시작.

  // 간단한 전략: row 순회, 텍스트가 "1월","2월"..."12월" 인 셀을 찾고 그 행에서 그 다음 셀 = 월간 onething,
  // 그 후 5개 셀 = 5 weeks of that month.
  // 각 월의 5주차는 ISO 주차 매핑이 모호하니, "1월 1주차" 같은 키 대신 단순히 month 단위 + W주차를 따로 분기

  // 보수적: 월간 노트는 month scope, 주간은 본 파일에서는 무시 (W files에서 주차 키워드를 focusNote로 추출하면 됨)
  // 하지만 사용자가 원씽파일에 주간을 적었으니 일단 월간만 추출

  $('tr').each((_, tr) => {
    const cells = extractRowCells($, $(tr));
    for (let i = 0; i < cells.length; i++) {
      const m = cells[i].text.match(/^(\d{1,2})월$/);
      if (m && cells[i + 1]) {
        const month = parseInt(m[1], 10);
        const monthText = cells[i + 1].text;
        if (monthText) {
          notes.push({
            id: ulid(),
            scope: 'month',
            scopeKey: `month:${YEAR}-${pad2(month)}`,
            text: monthText,
            updatedAt: NOW,
          });
        }
      }
    }
  });

  return notes;
}

// ───── 연간 (annual goals → todos) ─────
function parseAnnualGoals() {
  const $ = loadHtml('연간.html');
  if (!$) return [];
  const todos = [];

  // 첫 번째 "2026년 목표" 섹션의 row 6-12 (우선순위 1-7)
  // 각 row는 col 2 (s15)='우선순위 숫자', col 3 (colspan=6, s16)='이루고 싶은 일', col 9 (s16)='달성기한', ...
  let inFirstSection = false;
  let foundHeader = false;
  $('tr').each((_, tr) => {
    const cells = extractRowCells($, $(tr));
    // "2026년 목표" 헤더 감지
    if (cells.some((c) => c.text === '2026년 목표')) {
      inFirstSection = true;
      foundHeader = false;
      return;
    }
    // "2026년 상반기 실적" 등장 시 첫 섹션 끝
    if (cells.some((c) => /상반기 실적|최종 실적/.test(c.text))) {
      inFirstSection = false;
      return;
    }
    if (!inFirstSection) return;
    // 우선순위 라벨이 있는 헤더 행 (우선순위/이루고 싶은 일 등) 스킵
    if (cells.some((c) => c.text.startsWith('우선'))) {
      foundHeader = true;
      return;
    }
    if (!foundHeader) return;

    // 데이터 행: col 2가 숫자 (우선순위), col 3에 colspan=6 = '이루고 싶은 일'
    const priorityCell = cells.find((c) => c.col === 2);
    const goalCell = cells.find((c) => c.col === 3 && c.cs === 6);
    if (!priorityCell || !goalCell) return;
    if (!isNumberOnly(priorityCell.text)) return;
    const title = goalCell.text;
    if (!title) return;

    todos.push({
      id: ulid(),
      title: `[연간] ${title}`,
      date: `${YEAR}-12-31`,
      done: false,
      order: parseInt(priorityCell.text, 10) - 1,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  return todos;
}

// ───── 주간 TODO 파일 (W2.html ~ W16.html) ─────
function parseWeeklyFile(weekNum) {
  const $ = loadHtml(`W${weekNum}.html`);
  if (!$) return { todos: [], focusNote: null };

  const dates = datesForIsoWeek(YEAR, weekNum);
  const todos = [];
  let keyword = '';

  // 한 주에서 day → col 매핑: 첫 row의 day 헤더 col을 읽어 dynamic 하게 결정
  let dayCols = []; // [col0..col6]
  let keywordCol = null;
  let inTodoSection = true;

  const $rows = $('tr');
  $rows.each((rowIdx, tr) => {
    const cells = extractRowCells($, $(tr));

    // 첫 번째 day header 행 감지
    if (dayCols.length === 0) {
      const dayHeaderCells = cells.filter((c) => isDateHeader(c.text));
      if (dayHeaderCells.length === 7) {
        dayCols = dayHeaderCells.map((c) => c.col);
        const kwCell = cells.find((c) => c.text.includes('이번주 키워드'));
        if (kwCell) keywordCol = kwCell.col;
      }
      return;
    }

    // 하단 시간블록/회고 섹션 시작 감지: header 셀(cs=7 또는 cs=1 + s0)에서만 매칭하여 todo 본문 텍스트와 충돌 회피
    const stopMarkers = ['메모', '🔗습관추적 피드백', '❓ 왜 이런 결과가 나왔을까?', '습관추적'];
    const dayShortHeaderRow = cells.filter((c) => c.cs === 1 && /^[월화수목금토일]$/.test(c.text)).length >= 5;
    const stopHit = cells.some((c) => c.cls.includes('s0') && stopMarkers.some((m) => c.text === m || c.text.startsWith(m)));
    if (stopHit || dayShortHeaderRow) {
      inTodoSection = false;
    }

    if (!inTodoSection) return;

    // TODO 셀: colspan=6, day col + 1 위치 (또는 day col 자체)
    // 날 col에서 +1 (W파일은 ratio col 1=숫자, col 2=텍스트)이지만 dayCols는 이미 col 8 형태이므로 +1
    for (const cell of cells) {
      if (cell.cs !== 6) continue;
      if (!cell.text) continue;
      if (cell.cls.includes('s0')) continue;
      // dayCols 매핑: cell.col이 dayCol 또는 dayCol+1
      let dayIdx = -1;
      for (let i = 0; i < dayCols.length; i++) {
        if (cell.col === dayCols[i] + 1 || cell.col === dayCols[i]) {
          dayIdx = i;
          break;
        }
      }
      if (dayIdx === -1) continue;
      // 키워드/주차 셀 등 제외 (날짜/주차 패턴)
      if (isDateHeader(cell.text)) continue;
      if (/^\d+주차$/.test(cell.text)) continue;
      todos.push({
        id: ulid(),
        title: cell.text,
        date: dates[dayIdx],
        done: false,
        order: 0, // 후처리에서 리세트
        createdAt: NOW,
        updatedAt: NOW,
      });
    }

    // 키워드 셀 (colspan=7, keywordCol 위치)
    if (keywordCol != null && !keyword) {
      const kw = cells.find((c) => c.col === keywordCol && c.text && !c.text.includes('이번주') && c.cs === 7);
      if (kw && !isNumberOnly(kw.text) && !isDateHeader(kw.text)) {
        keyword = kw.text;
      }
    }
  });

  let focusNote = null;
  if (keyword) {
    focusNote = {
      id: ulid(),
      scope: 'week',
      scopeKey: `week:${YEAR}-W${pad2(weekNum)}`,
      text: keyword,
      updatedAt: NOW,
    };
  }

  return { todos, focusNote };
}

// ───── 월간 TODO 파일 (M1~M4) — 같은 패턴 (여러 주차 포함) ─────
function parseMonthlyFile(monthNum) {
  const $ = loadHtml(`M${monthNum}.html`);
  if (!$) return [];

  const todos = [];
  const $rows = $('tr');

  // 여러 주차 섹션이 있음. 각 섹션은 day header row + TODO rows.
  // 매번 day header 행을 만나면 dayCols 갱신, 그 후 다음 day header까지 TODO 추출.
  let dayCols = [];
  let dates = [];

  $rows.each((_, tr) => {
    const cells = extractRowCells($, $(tr));

    // day header row 감지 (7개의 isDateHeader 셀)
    const dayHeaderCells = cells.filter((c) => isDateHeader(c.text));
    if (dayHeaderCells.length === 7) {
      dayCols = dayHeaderCells.map((c) => c.col);
      // 날짜 파싱 ("1/5(월)" → 2026-01-05)
      dates = dayHeaderCells.map((c) => {
        const m = c.text.match(/^(\d{1,2})\/(\d{1,2})/);
        return m ? isoDate(YEAR, parseInt(m[1], 10), parseInt(m[2], 10)) : null;
      });
      return;
    }

    if (dayCols.length === 0) return;

    for (const cell of cells) {
      if (cell.cs !== 6) continue;
      if (!cell.text) continue;
      if (cell.cls.includes('s0')) continue;
      let dayIdx = -1;
      for (let i = 0; i < dayCols.length; i++) {
        if (cell.col === dayCols[i] + 1 || cell.col === dayCols[i]) {
          dayIdx = i;
          break;
        }
      }
      if (dayIdx === -1) continue;
      if (!dates[dayIdx]) continue;
      if (isDateHeader(cell.text)) continue;
      if (/^\d+주차$/.test(cell.text)) continue;
      todos.push({
        id: ulid(),
        title: cell.text,
        date: dates[dayIdx],
        done: false,
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      });
    }
  });

  return todos;
}

// ───── 메인 ─────
function main() {
  console.log('▶ 만다라트 파싱...');
  const goals = parseMandalart();
  console.log(`  goals: ${goals.length}`);

  console.log('▶ 원씽 파싱...');
  const onethingNotes = parseOneThing();
  console.log(`  notes(year+month): ${onethingNotes.length}`);

  console.log('▶ 연간 목표 파싱...');
  const annualTodos = parseAnnualGoals();
  console.log(`  annual todos: ${annualTodos.length}`);

  const allTodos = [...annualTodos];
  const weekNotes = [];
  for (let w = 2; w <= 16; w++) {
    const { todos, focusNote } = parseWeeklyFile(w);
    console.log(`  W${w}: ${todos.length} todos, keyword=${focusNote ? '✓' : '✗'}`);
    allTodos.push(...todos);
    if (focusNote) weekNotes.push(focusNote);
  }

  for (let m = 1; m <= 4; m++) {
    const todos = parseMonthlyFile(m);
    console.log(`  M${m}: ${todos.length} todos (will dedupe)`);
    allTodos.push(...todos);
  }

  // 중복 제거: (date + title) 키
  const seen = new Set();
  const dedupTodos = [];
  for (const t of allTodos) {
    const key = `${t.date}|${t.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupTodos.push(t);
  }

  // order 재할당: 같은 날짜 내 인덱스
  const byDate = new Map();
  for (const t of dedupTodos) {
    if (!byDate.has(t.date)) byDate.set(t.date, 0);
    t.order = byDate.get(t.date);
    byDate.set(t.date, t.order + 1);
  }

  const focusNotes = [...onethingNotes, ...weekNotes];

  const output = {
    version: 1,
    generatedAt: NOW,
    goals,
    focusNotes,
    todos: dedupTodos,
  };

  writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✅ 작성 완료: ${OUTPUT}`);
  console.log(`   goals=${goals.length}, focusNotes=${focusNotes.length}, todos=${dedupTodos.length}`);

  // 샘플
  console.log('\n=== 샘플 goals (mandalartSub 5개) ===');
  goals.filter((g) => g.level === 'mandalartSub').slice(0, 5).forEach((g) => {
    console.log(`  [${g.order}] ${g.title}  parent=${g.parentId.slice(0, 6)}…`);
  });

  console.log('\n=== 샘플 todos (5개) ===');
  dedupTodos.slice(0, 5).forEach((t) => {
    console.log(`  ${t.date}  ${t.title}`);
  });

  console.log('\n=== 샘플 focusNotes (3개) ===');
  focusNotes.slice(0, 3).forEach((n) => {
    console.log(`  ${n.scopeKey}: ${n.text.slice(0, 40)}`);
  });
}

main();
