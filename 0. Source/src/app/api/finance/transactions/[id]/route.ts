import { NextResponse } from 'next/server';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';

export const PATCH = authenticated(
  async (session, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const patch = await readMutation(req, 'financeTransactions', session.userId, true, id);
    if (patch instanceof Response) return patch;
    const repositories = getUserRepositories(session.userId);
    const updated = repositories.finance.updateTransaction(id, patch);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  },
);

export const DELETE = authenticated(
  async (session, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const repositories = getUserRepositories(session.userId);
    return NextResponse.json(repositories.finance.deleteTransaction(id));
  },
);
