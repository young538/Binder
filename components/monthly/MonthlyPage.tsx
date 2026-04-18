'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Todo } from '@/lib/types';
import { listByPeriod } from '@/lib/repo/todos';
import { FocusNoteEditor } from '@/components/common/FocusNoteEditor';
import { MonthlyTodoList } from './MonthlyTodoList';
import { SubCandidateList } from './SubCandidateList';
import { monthKeyFromString } from '@/lib/utils/period';

interface Props { yyyymm: string; }

const parseYm = (yyyymm: string): [number, number] => {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [new Date().getFullYear(), new Date().getMonth() + 1];
  return [Number(m[1]), Number(m[2])];
};

const shiftMonth = (yyyymm: string, delta: number): string => {
  const [y, mo] = parseYm(yyyymm);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const MonthlyPage = ({ yyyymm }: Props) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const periodKey = monthKeyFromString(yyyymm);

  const reload = useCallback(async () => {
    const ts = await listByPeriod('monthly', periodKey);
    setTodos(ts);
  }, [periodKey]);

  useEffect(() => { reload(); }, [reload]);

  const prev = shiftMonth(yyyymm, -1);
  const next = shiftMonth(yyyymm, 1);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <Link href={`/monthly/${prev}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold flex-1 text-center text-zinc-900 dark:text-zinc-50">{yyyymm}</h1>
        <Link href={`/monthly/${next}`}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600">
          <ChevronRight size={18} />
        </Link>
      </header>

      <FocusNoteEditor
        scope="month"
        scopeKey={periodKey}
        label="이번 달 한 문장"
        placeholder="예: 릴스 업로드 주 2회 시작" />

      <div className="grid md:grid-cols-2 gap-4">
        <MonthlyTodoList
          periodKey={periodKey}
          todos={todos}
          onChange={reload} />
        <SubCandidateList
          periodKey={periodKey}
          todos={todos}
          onChange={reload} />
      </div>
    </div>
  );
};
