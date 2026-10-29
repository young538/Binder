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
    add('goals', sql`${s.goals}`, sql`${s.goals.id}`, sql`${s.goals.userId}`, sql`${s.goals.title}`, empty, empty, empty, sql`${s.goals.updatedAt}`);
    add('annualGoals', sql`${s.annualGoals}`, sql`${s.annualGoals.id}`, sql`${s.annualGoals.userId}`, sql`${s.annualGoals.title}`, joinText(sql`${s.annualGoals.action}`, sql`${s.annualGoals.metric}`), sql`${s.annualGoals.year}`, empty, sql`${s.annualGoals.updatedAt}`);
    add('habits', sql`${s.habits}`, sql`${s.habits.id}`, sql`${s.habits.userId}`, sql`${s.habits.name}`, sql`${s.habits.note}`, empty, empty, sql`${s.habits.updatedAt}`);
    add('books', sql`${s.books}`, sql`${s.books.id}`, sql`${s.books.userId}`, sql`${s.books.title}`, joinText(sql`${s.books.oneThing}`, sql`${s.books.keywords}`, sql`${s.books.category}`), sql`${s.books.year}`, empty, sql`${s.books.updatedAt}`);
    add('focusNotes', sql`${s.focusNotes}`, sql`${s.focusNotes.id}`, sql`${s.focusNotes.userId}`, sql`${s.focusNotes.text}`, empty, sql`${s.focusNotes.scopeKey}`, sql`${s.focusNotes.scope}`, sql`${s.focusNotes.updatedAt}`);
    const reflection = joinText(sql`${s.retrospectives.freeText}`, ...['good', 'bad', 'nextStep', 'reading'].map(key => sql`json_extract(${s.retrospectives.template}, ${`$.${key}`})`));
    add('retrospectives', sql`${s.retrospectives}`, sql`${s.retrospectives.id}`, sql`${s.retrospectives.userId}`, empty, reflection, sql`${s.retrospectives.dateOrWeek}`, sql`${s.retrospectives.type}`, sql`${s.retrospectives.updatedAt}`);
    add('timeBlocks', sql`${s.timeBlocks}`, sql`${s.timeBlocks.id}`, sql`${s.timeBlocks.userId}`, sql`${s.timeBlocks.text}`, empty, sql`${s.timeBlocks.date}`, empty, sql`${s.timeBlocks.updatedAt}`);
    add('categories', sql`${s.categories}`, sql`${s.categories.id}`, sql`${s.categories.userId}`, sql`${s.categories.name}`, empty, empty, empty, empty);
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
    const paths: Record<string, string> = { day: 'daily', week: 'week', month: 'monthly', year: 'annual' };
    return paths[row.scope] ? `/${paths[row.scope]}/${period}` : '/mandalart';
  }
  if (row.kind === 'annualGoals') return `/annual/${period}`;
  if (row.kind === 'books') return `/reading?year=${period}`;
  if (row.kind === 'timeBlocks') return `/daily/${period}`;
  if (row.kind === 'retrospectives') return row.scope === 'daily' ? `/daily/${period}` : `/retrospective/week/${period}`;
  return ({ goals: '/mandalart', habits: '/daily', books: '/reading', categories: '/settings' } as Record<string, string>)[row.kind];
}
