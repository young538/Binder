import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import type { BinderDatabase } from '../db/connection';
import * as s from '../db/schema';
import { SEARCH_KINDS, SEARCH_PAGE_SIZE, type SearchKind, type SearchResults } from '@/lib/search/types';

type Row = { kind: SearchKind; id: string; title: string; body: string; period: string; scope: string };
const empty = sql`''`;
const joinText = (...fields: SQL[]) => sql.join(fields.map(field => sql`coalesce(${field}, '')`), sql` || ' ' || `);

/** A single paginated query; every branch enforces the authenticated owner. */
export class SearchRepository {
  constructor(private readonly db: BinderDatabase, private readonly userId: string) {}

  search(query: string, kind?: SearchKind, offset = 0): SearchResults {
    const branches: SQL[] = [];
    const add = (name: SearchKind, table: SQL, id: SQL, user: SQL, title: SQL, body: SQL, period: SQL, scope: SQL, updated: SQL) => {
      if (kind && kind !== name) return;
      branches.push(sql`select ${name} as kind, ${id} as id, coalesce(${title}, '') as title,
        coalesce(${body}, '') as body, ${period} as period, ${scope} as scope, ${updated} as updated
        from ${table} where ${user} = ${this.userId}
        and instr(lower(${joinText(title, body)}), ${query.toLowerCase()}) > 0`);
    };
    add('todos', sql`${s.todos}`, sql`${s.todos.id}`, sql`${s.todos.userId}`, sql`${s.todos.title}`, sql`${s.todos.note}`, sql`${s.todos.scopeKey}`, sql`${s.todos.scope}`, sql`${s.todos.updatedAt}`);
    add('projects', sql`${s.projects}`, sql`${s.projects.id}`, sql`${s.projects.userId}`, sql`${s.projects.title}`, joinText(sql`${s.projects.outcome}`, sql`${s.projects.note}`), sql`coalesce(${s.projects.deadline}, '')`, sql`${s.projects.status}`, sql`${s.projects.updatedAt}`);
    add('goals', sql`${s.goals}`, sql`${s.goals.id}`, sql`${s.goals.userId}`, sql`${s.goals.title}`, empty, empty, empty, sql`${s.goals.updatedAt}`);
    add('annualGoals', sql`${s.annualGoals}`, sql`${s.annualGoals.id}`, sql`${s.annualGoals.userId}`, sql`${s.annualGoals.title}`, joinText(sql`${s.annualGoals.action}`, sql`${s.annualGoals.metric}`), sql`${s.annualGoals.year}`, empty, sql`${s.annualGoals.updatedAt}`);
    add('habits', sql`${s.habits}`, sql`${s.habits.id}`, sql`${s.habits.userId}`, sql`${s.habits.name}`, sql`${s.habits.note}`, empty, empty, sql`${s.habits.updatedAt}`);
    add('books', sql`${s.books}`, sql`${s.books.id}`, sql`${s.books.userId}`, sql`${s.books.title}`, joinText(sql`${s.books.oneThing}`, sql`${s.books.keywords}`, sql`${s.books.category}`), sql`${s.books.year}`, empty, sql`${s.books.updatedAt}`);
    add('focusNotes', sql`${s.focusNotes}`, sql`${s.focusNotes.id}`, sql`${s.focusNotes.userId}`, sql`${s.focusNotes.text}`, empty, sql`${s.focusNotes.scopeKey}`, sql`${s.focusNotes.scope}`, sql`${s.focusNotes.updatedAt}`);
    const reflection = joinText(sql`${s.retrospectives.freeText}`, ...['good', 'bad', 'nextStep', 'reading'].map(key => sql`json_extract(${s.retrospectives.template}, ${`$.${key}`})`));
    add('retrospectives', sql`${s.retrospectives}`, sql`${s.retrospectives.id}`, sql`${s.retrospectives.userId}`, empty, reflection, sql`${s.retrospectives.dateOrWeek}`, sql`${s.retrospectives.type}`, sql`${s.retrospectives.updatedAt}`);
    add('timeBlocks', sql`${s.timeBlocks}`, sql`${s.timeBlocks.id}`, sql`${s.timeBlocks.userId}`, sql`${s.timeBlocks.text}`, empty, sql`${s.timeBlocks.date}`, empty, sql`${s.timeBlocks.updatedAt}`);
    add('categories', sql`${s.categories}`, sql`${s.categories.id}`, sql`${s.categories.userId}`, sql`${s.categories.name}`, empty, empty, empty, empty);
    add('notes', sql`${s.binderNotes}`, sql`${s.binderNotes.id}`, sql`${s.binderNotes.userId}`, sql`${s.binderNotes.title}`, joinText(sql`${s.binderNotes.body}`, sql`${s.binderNotes.decisionOutcome}`), sql`coalesce(${s.binderNotes.reviewDate}, '')`, sql`${s.binderNotes.kind}`, sql`${s.binderNotes.updatedAt}`);
    add('people', sql`${s.people}`, sql`${s.people.id}`, sql`${s.people.userId}`, sql`${s.people.name}`, joinText(sql`${s.people.relationship}`, sql`${s.people.giftIdeas}`, sql`${s.people.note}`), sql`coalesce(${s.people.birthday}, '')`, empty, sql`${s.people.updatedAt}`);
    add('lifeEvents', sql`${s.lifeEvents}`, sql`${s.lifeEvents.id}`, sql`${s.lifeEvents.userId}`, sql`${s.lifeEvents.title}`, sql`${s.lifeEvents.note}`, sql`${s.lifeEvents.date}`, sql`${s.lifeEvents.kind}`, sql`${s.lifeEvents.updatedAt}`);
    add('metrics', sql`${s.metrics}`, sql`${s.metrics.id}`, sql`${s.metrics.userId}`, sql`${s.metrics.name}`, sql`${s.metrics.unit}`, empty, sql`${s.metrics.direction}`, sql`${s.metrics.updatedAt}`);
    add('subscriptions', sql`${s.subscriptions}`, sql`${s.subscriptions.id}`, sql`${s.subscriptions.userId}`, sql`${s.subscriptions.name}`, joinText(sql`${s.subscriptions.category}`, sql`${s.subscriptions.paymentMethod}`, sql`${s.subscriptions.note}`), sql`coalesce(${s.subscriptions.nextBillingDate}, '')`, sql`${s.subscriptions.status}`, sql`${s.subscriptions.updatedAt}`);
    add('financeTransactions', sql`${s.financeTransactions}`, sql`${s.financeTransactions.id}`, sql`${s.financeTransactions.userId}`, sql`${s.financeTransactions.merchant}`, joinText(sql`${s.financeTransactions.category}`, sql`${s.financeTransactions.subCategory}`, sql`${s.financeTransactions.paymentMethod}`, sql`${s.financeTransactions.note}`), sql`substr(${s.financeTransactions.date}, 1, 7)`, sql`${s.financeTransactions.kind}`, sql`${s.financeTransactions.updatedAt}`);
    const rows = this.db.all<Row>(sql`${sql.join(branches, sql` union all `)} order by updated desc, kind, id limit ${SEARCH_PAGE_SIZE + 1} offset ${offset}`);
    return { offset, hasMore: rows.length > SEARCH_PAGE_SIZE, items: rows.slice(0, SEARCH_PAGE_SIZE).map(row => ({
      id: row.id, kind: row.kind, title: row.title.slice(0, 150) || SEARCH_KINDS[row.kind],
      excerpt: excerpt(row.body || row.title, query), period: row.period, href: destination(row),
    })) };
  }
}

function excerpt(text: string, query: string) {
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  const start = Math.max(0, index - 40);
  return `${start ? '…' : ''}${text.slice(start, start + 180)}${text.length > start + 180 ? '…' : ''}`;
}
function destination(row: Row) {
  const period = encodeURIComponent(row.period.replace(/^(day|week|month|year):/, ''));
  if (row.kind === 'todos' || row.kind === 'focusNotes') {
    const paths: Record<string, string> = { day: 'daily', highlight: 'daily', week: 'week', month: 'monthly', year: 'annual' };
    return row.scope === 'inbox' ? '/inbox' : paths[row.scope] ? `/${paths[row.scope]}/${period}` : '/mandalart';
  }
  if (row.kind === 'projects') return `/projects?project=${encodeURIComponent(row.id)}`;
  if (row.kind === 'notes') return `/notes?note=${encodeURIComponent(row.id)}`;
  if (row.kind === 'people') return `/life?tab=people&person=${encodeURIComponent(row.id)}`;
  if (row.kind === 'lifeEvents') return '/life?tab=events';
  if (row.kind === 'metrics') return '/metrics';
  if (row.kind === 'subscriptions') return `/subscriptions?subscription=${encodeURIComponent(row.id)}`;
  if (row.kind === 'financeTransactions') return `/finance?month=${encodeURIComponent(row.period)}&q=${encodeURIComponent(row.title)}`;
  if (row.kind === 'annualGoals') return `/annual/${period}`;
  if (row.kind === 'books') return `/reading?year=${period}`;
  if (row.kind === 'timeBlocks') return `/daily/${period}`;
  if (row.kind === 'retrospectives') {
    if (row.scope === 'daily') return `/daily/${period}`;
    if (row.scope === 'monthly') return `/retrospective/month/${period}`;
    if (row.scope === 'yearly') return `/retrospective/year/${period}`;
    return `/retrospective/week/${period}`;
  }
  return ({ goals: '/mandalart', habits: '/daily', books: '/reading', categories: '/settings' } as Record<string, string>)[row.kind];
}
