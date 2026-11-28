#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { format, getISOWeek, getISOWeekYear, parseISO, subDays } from 'date-fns';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const args = { mode: 'seed', username: 'young538', db: '', out: '', date: '' };
  for (let i = 0; i < argv.length; i++) {
    const cur = argv[i];
    if (cur === '--mode' && argv[i + 1]) args.mode = argv[++i];
    else if (cur === '--username' && argv[i + 1]) args.username = argv[++i];
    else if (cur === '--db' && argv[i + 1]) args.db = argv[++i];
    else if (cur === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (cur === '--date' && argv[i + 1]) args.date = argv[++i];
  }
  if (!['seed', 'weekly'].includes(args.mode)) {
    throw new Error(`Unsupported --mode: ${args.mode} (use seed or weekly)`);
  }
  return args;
}

function cycleKeyForDate(dateIso, startDay) {
  if (!startDay || startDay <= 1) return dateIso.slice(0, 7);
  const y = Number(dateIso.slice(0, 4));
  const m = Number(dateIso.slice(5, 7));
  const d = Number(dateIso.slice(8, 10));
  if (d >= startDay) {
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function isoWeekKey(dateObj) {
  const wy = getISOWeekYear(dateObj);
  const ww = String(getISOWeek(dateObj)).padStart(2, '0');
  return `${wy}-W${ww}`;
}

function parseJsonSafe(raw, fallback = null) {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function formatKrw(n) {
  const sign = n < 0 ? '-' : '';
  return `${sign}₩${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`;
}

function writeSnapshot(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const sourceRoot = path.resolve(scriptDir, '..');
  const dbPath = path.resolve(args.db || path.join(sourceRoot, 'data', 'binder.sqlite'));
  const wikiRoot = path.resolve(args.out || path.join(sourceRoot, '..', '2. Wiki'));
  const now = args.date ? parseISO(args.date) : new Date();
  const todayIso = format(now, 'yyyy-MM-dd');

  const db = new Database(dbPath, { readonly: true });
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(args.username);
  if (!user) {
    throw new Error(`User not found: ${args.username}`);
  }
  const userId = user.id;
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId) || {};
  const cycleStartDay = Number(settings.finance_cycle_start_day || 1);

  const goals = db.prepare('SELECT id, title, parent_id, level FROM goals WHERE user_id = ? ORDER BY level, "order"').all(userId);
  const annualGoals = db.prepare('SELECT year, title, deadline, action, metric, target, monthly_targets, monthly_actuals FROM annual_goals WHERE user_id = ? ORDER BY year DESC, "order"').all(userId);
  const projects = db.prepare('SELECT title, status, deadline, outcome, note, completed_at FROM projects WHERE user_id = ? ORDER BY status, "order"').all(userId);
  const retros = db.prepare('SELECT type, date_or_week, rating, template, free_text, updated_at FROM retrospectives WHERE user_id = ? ORDER BY date_or_week DESC').all(userId);
  const books = db.prepare('SELECT year, category, title, one_thing, keywords, started_at, finished_at FROM books WHERE user_id = ? ORDER BY year DESC, "order"').all(userId);
  const notes = db.prepare('SELECT kind, title, body, pinned, review_date, decision_outcome, created_at, updated_at FROM binder_notes WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC').all(userId);
  const habits = db.prepare('SELECT id, name, schedule, note FROM habits WHERE user_id = ? ORDER BY "order"').all(userId);
  const habitLogs = db.prepare('SELECT habit_id, date FROM habit_logs WHERE user_id = ? ORDER BY date DESC').all(userId);
  const checkins = db.prepare('SELECT date, sleep_hours, energy, stress, mood FROM daily_checkins WHERE user_id = ? ORDER BY date DESC').all(userId);
  const metrics = db.prepare('SELECT id, name, unit, direction, target_value FROM metrics WHERE user_id = ? ORDER BY "order"').all(userId);
  const metricEntries = db.prepare('SELECT metric_id, date, value, note FROM metric_entries WHERE user_id = ? ORDER BY date DESC').all(userId);
  const pens = db.prepare('SELECT id, drug, name, capacity_mcg, starting_clicks, closed, is_example FROM injection_pens WHERE user_id = ? AND is_example = 0 ORDER BY created_at DESC').all(userId);
  const injEntries = db.prepare('SELECT pen_id, taken_at, amount_mcg, used_clicks, weight_kg, appetite_suppression, condition_note, lifestyle_note FROM injection_entries WHERE user_id = ? ORDER BY taken_at DESC').all(userId);
  const finTxs = db.prepare('SELECT date, kind, amount, currency, category, sub_category, merchant, payment_method, excluded FROM finance_transactions WHERE user_id = ? ORDER BY date DESC').all(userId);
  const subs = db.prepare('SELECT name, amount, currency, billing_cycle, billing_day, status, category FROM subscriptions WHERE user_id = ? ORDER BY "order"').all(userId);
  const todos = db.prepare('SELECT title, scope, scope_key, status, completed_at FROM todos WHERE user_id = ? ORDER BY updated_at DESC').all(userId);

  const isCardBillDebit = t => (t.payment_method || '').includes('통장') && t.merchant === '스마일카드';
  const writtenFiles = [];

  const oneThing = goals.filter(g => g.level === 'oneThing');
  const cores = goals.filter(g => g.level === 'mandalartCore');
  const subsGoals = goals.filter(g => g.level === 'mandalartSub');

  if (args.mode === 'seed') {
    const seedDir = path.join(wikiRoot, 'raw', 'life-os', `seed-${todayIso}`);

    // 1) goals-and-projects.md
    const goalsLines = [
      `# Life OS Raw Snapshot — 목표 & 프로젝트 (${todayIso})`,
      '',
      '## 1. 만다라트 핵심 목표',
      ...oneThing.map(g => `- **원씽(One-Thing)**: ${g.title}`),
      '',
      '### 핵심 영역 (Core)',
      ...cores.map(c => {
        const children = subsGoals.filter(sg => sg.parent_id === c.id).map(sg => sg.title);
        return `- **${c.title}**${children.length ? `: ${children.join(' · ')}` : ''}`;
      }),
      '',
      `## 2. 연간 목표 (${annualGoals.length}건)`,
      ...annualGoals.map(ag => `- [${ag.year}] **${ag.title}**${ag.metric ? ` (${ag.metric} 목표: ${ag.target ?? '-'})` : ''}${ag.action ? ` — 행동: ${ag.action}` : ''}`),
      '',
      `## 3. 프로젝트 (${projects.length}건)`,
      ...projects.map(p => `- [${p.status}] **${p.title}**${p.deadline ? ` (마감 ${p.deadline})` : ''}${p.outcome ? ` — 목표 결과: ${p.outcome}` : ''}${p.note ? `\n  - 메모: ${p.note}` : ''}`),
    ];
    const f1 = path.join(seedDir, 'goals-and-projects.md');
    writeSnapshot(f1, goalsLines.join('\n'));
    writtenFiles.push(path.relative(wikiRoot, f1).replace(/\\/g, '/'));

    // 2) retrospectives.md
    const retroLines = [
      `# Life OS Raw Snapshot — 회고 기록 (${todayIso}, 총 ${retros.length}건)`,
      '',
    ];
    for (const r of retros) {
      const tpl = parseJsonSafe(r.template, {}) || {};
      retroLines.push(`## [${r.type}] ${r.date_or_week}${r.rating ? ` (평점: ${r.rating}/5)` : ''}`);
      if (tpl.good) retroLines.push(`- **좋았던 점**: ${tpl.good}`);
      if (tpl.bad) retroLines.push(`- **아쉬웠던 점**: ${tpl.bad}`);
      if (tpl.nextStep) retroLines.push(`- **다음 행동**: ${tpl.nextStep}`);
      if (tpl.reading) retroLines.push(`- **오늘의 독서**: ${tpl.reading}`);
      if (r.free_text) retroLines.push(`- **자유 기록**: ${r.free_text}`);
      retroLines.push('');
    }
    const f2 = path.join(seedDir, 'retrospectives.md');
    writeSnapshot(f2, retroLines.join('\n'));
    writtenFiles.push(path.relative(wikiRoot, f2).replace(/\\/g, '/'));

    // 3) books-and-notes.md
    const bnLines = [
      `# Life OS Raw Snapshot — 독서 & 영구 노트 (${todayIso})`,
      '',
      `## 1. 독서 목록 (${books.length}권)`,
      ...books.map(b => [
        `### ${b.title} (${b.year}${b.category ? `, ${b.category}` : ''})`,
        `- 기간: ${b.started_at || '-'} ~ ${b.finished_at || '읽는 중'}`,
        b.one_thing ? `- 핵심 원씽: ${b.one_thing}` : null,
        b.keywords ? `- 키워드: ${b.keywords}` : null,
      ].filter(Boolean).join('\n')),
      '',
      `## 2. 원칙 · 의사결정 · 인사이트 · 레퍼런스 노트 (${notes.length}건)`,
      ...notes.map(n => [
        `### [${n.kind}] ${n.title}${n.pinned ? ' (고정)' : ''}`,
        n.review_date ? `- 복기 예정일: ${n.review_date}` : null,
        n.decision_outcome ? `- 복기 결과: ${n.decision_outcome}` : null,
        n.body ? `\n${n.body}` : null,
      ].filter(Boolean).join('\n')),
    ];
    const f3 = path.join(seedDir, 'books-and-notes.md');
    writeSnapshot(f3, bnLines.join('\n'));
    writtenFiles.push(path.relative(wikiRoot, f3).replace(/\\/g, '/'));

    // 4) finance-and-subscriptions.md (clean cycles, no bank account identifiers)
    const byCycle = new Map();
    const cat12 = new Map();
    const cutoff12m = format(subDays(now, 365), 'yyyy-MM-dd');
    for (const t of finTxs) {
      if (t.excluded || t.currency !== 'KRW' || isCardBillDebit(t)) continue;
      const ck = cycleKeyForDate(t.date, cycleStartDay);
      const cur = byCycle.get(ck) || { expense: 0, income: 0, count: 0 };
      cur.count++;
      if (t.kind === 'expense') {
        cur.expense += t.amount;
        if (t.date >= cutoff12m) cat12.set(t.category, (cat12.get(t.category) || 0) + t.amount);
      } else if (t.kind === 'income') {
        cur.income += t.amount;
      }
      byCycle.set(ck, cur);
    }
    const finLines = [
      `# Life OS Raw Snapshot — 가계부 & 구독 고정비 (${todayIso})`,
      '',
      `- 가계부 기준일: 매월 ${cycleStartDay}일`,
      `- 카드대금 이중집계(\`스마일카드\` 통장 출금) 제외 순수 지출 기준`,
      '',
      '## 1. 주기별 현금흐름 (최근 12주기)',
      ...[...byCycle.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([ck, s]) =>
        `- **${ck}**: 지출 ${formatKrw(s.expense)} · 수입 ${formatKrw(s.income)} · 순액 ${formatKrw(s.income - s.expense)} (${s.count}건)`
      ),
      '',
      '## 2. 최근 12개월 카테고리별 지출 상위',
      ...[...cat12.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([cat, amt]) =>
        `- **${cat}**: 연간 ${formatKrw(amt)} (월평균 ${formatKrw(amt / 12)})`
      ),
      '',
      `## 3. 활성 구독 목록 (${subs.filter(s => s.status === 'active').length}건)`,
      ...subs.filter(s => s.status === 'active').map(s => `- **${s.name}** (${s.category || '기타'}): ${formatKrw(s.amount)} / ${s.billing_cycle} (${s.billing_day ?? '-'}일)`),
    ];
    const f4 = path.join(seedDir, 'finance-and-subscriptions.md');
    writeSnapshot(f4, finLines.join('\n'));
    writtenFiles.push(path.relative(wikiRoot, f4).replace(/\\/g, '/'));

    // 5) health-habits-and-injections.md
    const habitLogCount = new Map();
    for (const l of habitLogs) habitLogCount.set(l.habit_id, (habitLogCount.get(l.habit_id) || 0) + 1);
    const healthLines = [
      `# Life OS Raw Snapshot — 습관 · 컨디션 · 주사/체중 기록 (${todayIso})`,
      '',
      `## 1. 루틴 / 습관 (${habits.length}개)`,
      ...habits.map(h => `- **${h.name}**: 누적 ${habitLogCount.get(h.id) || 0}회 완료${h.note ? ` (${h.note})` : ''}`),
      '',
      `## 2. 일일 컨디션 체크인 (최근 14건 / 총 ${checkins.length}건)`,
      ...checkins.slice(0, 14).map(c => `- ${c.date}: 수면 ${c.sleep_hours ?? '-'}h · 에너지 ${c.energy ?? '-'}/5 · 스트레스 ${c.stress ?? '-'}/5${c.mood ? ` · ${c.mood}` : ''}`),
      '',
      `## 3. 상태 지표 (${metrics.length}개)`,
      ...metrics.map(m => {
        const recent = metricEntries.filter(e => e.metric_id === m.id).slice(0, 5);
        return `- **${m.name}** (${m.direction}, 목표 ${m.target_value ?? '-'}${m.unit}): ${recent.map(e => `${e.date}=${e.value}${m.unit}`).join(', ') || '기록 없음'}`;
      }),
      '',
      `## 4. 주사 기록 (${pens.length}개 펜 · ${injEntries.length}회 투여)`,
      ...injEntries.slice(0, 15).map(e => `- ${e.taken_at}: ${e.amount_mcg ? `${(e.amount_mcg / 1000).toFixed(2)}mg` : '-'} (${e.used_clicks ?? '-'}클릭)${e.weight_kg ? ` · 체중 ${e.weight_kg}kg` : ''}${e.appetite_suppression ? ` · 식욕억제 ${e.appetite_suppression}/5` : ''}${e.condition_note ? ` · ${e.condition_note}` : ''}`),
    ];
    const f5 = path.join(seedDir, 'health-habits-and-injections.md');
    writeSnapshot(f5, healthLines.join('\n'));
    writtenFiles.push(path.relative(wikiRoot, f5).replace(/\\/g, '/'));
  } else {
    // Weekly mode: past 7 days + current finance cycle
    const weekAgoIso = format(subDays(now, 7), 'yyyy-MM-dd');
    const wkKey = isoWeekKey(now);
    const curCycle = cycleKeyForDate(todayIso, cycleStartDay);
    const weeklyRetros = retros.filter(r => r.date_or_week >= weekAgoIso || r.date_or_week === wkKey);
    const doneTodos = todos.filter(t => t.status === 'done' && (t.completed_at || '').slice(0, 10) >= weekAgoIso);
    const weeklyCheckins = checkins.filter(c => c.date >= weekAgoIso);
    const weeklyInj = injEntries.filter(e => e.taken_at.slice(0, 10) >= weekAgoIso);
    const curCycleTxs = finTxs.filter(t => !t.excluded && t.currency === 'KRW' && !isCardBillDebit(t) && cycleKeyForDate(t.date, cycleStartDay) === curCycle);
    const cycleExp = curCycleTxs.filter(t => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
    const cycleInc = curCycleTxs.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0);

    const wLines = [
      `# Life OS Weekly Raw Snapshot — ${wkKey} (${weekAgoIso} ~ ${todayIso})`,
      '',
      `## 1. 이번 주 회고 & 독서 (${weeklyRetros.length}건)`,
      ...weeklyRetros.map(r => {
        const tpl = parseJsonSafe(r.template, {}) || {};
        return [
          `### [${r.type}] ${r.date_or_week}${r.rating ? ` (${r.rating}/5)` : ''}`,
          tpl.good ? `- 좋았던 점: ${tpl.good}` : null,
          tpl.bad ? `- 아쉬웠던 점: ${tpl.bad}` : null,
          tpl.nextStep ? `- 다음 행동: ${tpl.nextStep}` : null,
          tpl.reading ? `- 독서: ${tpl.reading}` : null,
          r.free_text ? `- 자유 메모: ${r.free_text}` : null,
        ].filter(Boolean).join('\n');
      }),
      '',
      `## 2. 완료된 할 일 (${doneTodos.length}건)`,
      ...doneTodos.slice(0, 40).map(t => `- [${t.scope_key}] ${t.title}`),
      '',
      `## 3. 컨디션 & 투여 (${weeklyCheckins.length}건 체크인 · ${weeklyInj.length}건 투여)`,
      ...weeklyCheckins.map(c => `- ${c.date}: 수면 ${c.sleep_hours ?? '-'}h, 에너지 ${c.energy ?? '-'}/5, 스트레스 ${c.stress ?? '-'}/5`),
      ...weeklyInj.map(e => `- 투여 ${e.taken_at}: ${(e.amount_mcg / 1000).toFixed(2)}mg${e.weight_kg ? `, 체중 ${e.weight_kg}kg` : ''}`),
      '',
      `## 4. 현재 가계부 주기 (${curCycle}, 기준일 ${cycleStartDay}일)`,
      `- 순 지출: ${formatKrw(cycleExp)} · 수입: ${formatKrw(cycleInc)} (${curCycleTxs.length}건)`,
    ];
    const wf = path.join(wikiRoot, 'raw', 'life-os', 'weekly', `${wkKey}.md`);
    writeSnapshot(wf, wLines.join('\n'));
    writtenFiles.push(path.relative(wikiRoot, wf).replace(/\\/g, '/'));
  }

  const inboxDir = path.join(wikiRoot, 'raw', 'inbox');
  const inboxFiles = fs.existsSync(inboxDir) ? fs.readdirSync(inboxDir).sort() : [];
  db.close();

  console.log(JSON.stringify({
    mode: args.mode,
    username: args.username,
    wikiRoot,
    files: writtenFiles,
    inboxFiles,
  }, null, 2));
}

main();
