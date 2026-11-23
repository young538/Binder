import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { isDate, isMonth, readMutation } from '@/lib/server/validation';
import type { FinanceTransactionKind } from '@/lib/types';

export const GET = authenticated(async (session, req: Request) => {
  const sp = new URL(req.url).searchParams;
  const month = sp.get('month');
  const startDate = sp.get('startDate');
  const endDate = sp.get('endDate');
  const kind = sp.get('kind');

  if (month && !isMonth(month)) {
    return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
  }
  if ((startDate && !isDate(startDate)) || (endDate && !isDate(endDate))) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }
  if (kind && !['expense', 'income', 'transfer'].includes(kind)) {
    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 });
  }

  const repositories = getUserRepositories(session.userId);
  const rows = repositories.finance.listTransactions({
    month: month ?? undefined,
    startDate: startDate && endDate ? startDate : undefined,
    endDate: startDate && endDate ? endDate : undefined,
    kind: (kind as FinanceTransactionKind | null) ?? undefined,
  });
  return NextResponse.json(rows);
});

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'financeTransactions', session.userId);
  if (body instanceof Response) return body;
  const repositories = getUserRepositories(session.userId);
  const created = repositories.finance.createTransaction(body);
  return NextResponse.json(created, { status: 201 });
});
