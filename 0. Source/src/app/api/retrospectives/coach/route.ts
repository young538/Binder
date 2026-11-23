import { NextResponse } from 'next/server';
import { endOfMonth, parseISO } from 'date-fns';
import { buildRetroCoachSummary } from '@/lib/retroCoach';
import { enrichRetroCoach, getPublicAiCoachStatus } from '@/lib/server/aiCoach';
import { authenticated } from '@/lib/server/http';
import { getUserRepositories } from '@/lib/server/repos';
import { readMutation } from '@/lib/server/validation';
import { toIsoDate, weekDates } from '@/lib/utils/date';
import { computeHabitStatsForRange } from '@/lib/utils/habitSchedule';

export const GET = authenticated(async () => {
  return NextResponse.json(getPublicAiCoachStatus());
});

export const POST = authenticated(async (session, req: Request) => {
  const body = await readMutation(req, 'retroCoach', session.userId);
  if (body instanceof Response) return body;

  const startObj =
    body.mode === 'weekly' ? weekDates(body.period)[0] : parseISO(`${body.period}-01`);
  const endObj =
    body.mode === 'weekly' ? weekDates(body.period)[6] : endOfMonth(startObj);

  const startDate = toIsoDate(startObj);
  const endDate = toIsoDate(endObj);
  const year = startDate.slice(0, 4);

  const repositories = getUserRepositories(session.userId);

  const [
    blocks,
    dayTodos,
    periodTodos,
    categories,
    projects,
    habits,
    habitLogs,
    checkins,
    books,
    existingRetro,
  ] = await Promise.all([
    repositories.timeBlocks.listInRange(startDate, endDate),
    repositories.todos.listDaysInRange(startDate, endDate),
    repositories.todos.list({
      scope: body.mode === 'weekly' ? 'week' : 'month',
      scopeKey: body.period,
    }),
    repositories.categories.list(),
    repositories.projects.list(),
    repositories.habits.list(),
    repositories.habitLogs.listInRange(startDate, endDate),
    Promise.resolve(repositories.dailyCheckins.listInRange(startDate, endDate)),
    repositories.books.listByYear(year),
    repositories.retrospectives.get(body.mode, body.period),
  ]);

  const subscriptions = repositories.subscriptions.list();
  const habitStats = computeHabitStatsForRange(habits, habitLogs, startObj, endObj);

  const completedProjects = projects.filter(p => {
    if (p.status !== 'done' || !p.completedAt) return false;
    const completedDate = p.completedAt.slice(0, 10);
    return completedDate >= startDate && completedDate <= endDate;
  });

  const finishedBooks = books.filter(
    b => b.finishedAt && b.finishedAt >= startDate && b.finishedAt <= endDate,
  );

  const summary = buildRetroCoachSummary({
    mode: body.mode,
    period: body.period,
    startDate,
    endDate,
    blocks,
    todos: [...periodTodos, ...dayTodos],
    categories,
    completedProjects,
    finishedBooks,
    checkins,
    habitPercent: habitStats.percent,
    subscriptions,
    existingRetro,
  });

  const enriched = await enrichRetroCoach(summary, body.provider ?? 'auto');
  return NextResponse.json(enriched);
});
