'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { addDays } from 'date-fns';
import { Plus } from 'lucide-react';
import { createFinanceTransaction } from '@/lib/repo/finance';
import { createNote } from '@/lib/repo/notes';
import { createTodo } from '@/lib/repo/todos';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  type NoteKind,
  type TodoPriority,
  type TodoScope,
} from '@/lib/types';
import { toIsoDate } from '@/lib/utils/date';
import { useBinder } from '@/store';
import { TodoCreateInput } from '@/components/common/TodoCreateInput';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

type QuickWhen = 'inbox' | 'today' | 'tomorrow' | 'date';

export function QuickCapture() {
  const path = usePathname();
  const { projects = [] } = useBinder();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'todo' | 'note' | 'expense'>('todo');
  const [captureWhen, setCaptureWhen] = useState<QuickWhen>('inbox');
  const [customDate, setCustomDate] = useState(() => toIsoDate(new Date()));
  const [captureProjectId, setCaptureProjectId] = useState('');
  const [capturePriority, setCapturePriority] = useState('');
  const [noteKind, setNoteKind] = useState<NoteKind>('insight');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseMerchant, setExpenseMerchant] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [expensePayment, setExpensePayment] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => toIsoDate(new Date()));
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  const openModal = () => {
    setMode('todo');
    setCaptureWhen('inbox');
    setCustomDate(toIsoDate(new Date()));
    setCaptureProjectId('');
    setCapturePriority('');
    setExpenseDate(toIsoDate(new Date()));
    setExpenseAmount('');
    setExpenseMerchant('');
    setExpenseError('');
    setOpen(true);
  };

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        openModal();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (noteBusy) return;
    if (!noteTitle.trim()) {
      setNoteError('제목을 입력해 주세요.');
      return;
    }
    setNoteBusy(true);
    setNoteError('');
    try {
      await createNote({
        kind: noteKind,
        title: noteTitle.trim(),
        body: noteBody.trim(),
        pinned: noteKind === 'principle',
        reviewDate: null,
        decisionOutcome: null,
        goalId: null,
        projectId: null,
        sourceRetro: null,
      });
      setNoteTitle('');
      setNoteBody('');
      setOpen(false);
    } catch {
      setNoteError('노트를 저장하지 못했어요.');
    } finally {
      setNoteBusy(false);
    }
  };

  const activeProjects = projects.filter(p => p.status !== 'done');
  const todayIso = toIsoDate(new Date());
  const tomorrowIso = toIsoDate(addDays(new Date(), 1));
  const resolvedScope: TodoScope = captureWhen === 'inbox' ? 'inbox' : 'day';
  const resolvedScopeKey =
    captureWhen === 'inbox'
      ? 'inbox'
      : captureWhen === 'today'
        ? todayIso
        : captureWhen === 'tomorrow'
          ? tomorrowIso
          : customDate || todayIso;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="빠른 메모 (Alt+N)"
        className={`fixed ${path.startsWith('/week/') ? 'bottom-40' : 'bottom-24'} right-4 z-30 flex items-center gap-1 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:bottom-6`}
      >
        <Plus size={18} />
        빠른 메모
      </button>
      {open && (
        <Dialog title="빠른 메모" onClose={() => { if (!noteBusy && !expenseBusy) setOpen(false); }}>
          <div className="mb-4 flex gap-1.5" role="tablist" aria-label="빠른 입력 유형">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'todo'}
              onClick={() => setMode('todo')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mode === 'todo'
                  ? 'bg-blue-600 text-white'
                  : 'border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              수집함 할 일
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'note'}
              onClick={() => setMode('note')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mode === 'note'
                  ? 'bg-blue-600 text-white'
                  : 'border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              빠른 노트
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'expense'}
              onClick={() => setMode('expense')}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                mode === 'expense'
                  ? 'bg-blue-600 text-white'
                  : 'border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300'
              }`}
            >
              빠른 지출
            </button>
          </div>

          {mode === 'todo' ? (
            <>
              <p className="mb-3 text-sm text-zinc-500">
                수집함에 빠르게 담거나, 오늘·내일·프로젝트를 바로 지정할 수 있어요.
              </p>
              <div className="mb-3 space-y-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="실행 시점">
                  {(
                    [
                      { id: 'inbox', label: '수집함' },
                      { id: 'today', label: '오늘' },
                      { id: 'tomorrow', label: '내일' },
                      { id: 'date', label: '날짜 선택' },
                    ] as const
                  ).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCaptureWhen(opt.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        captureWhen === opt.id
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {captureWhen === 'date' && (
                  <input
                    type="date"
                    aria-label="실행 날짜"
                    value={customDate}
                    onChange={e => setCustomDate(e.target.value)}
                    className={fieldClass}
                  />
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    aria-label="빠른 입력 프로젝트"
                    value={captureProjectId}
                    onChange={e => setCaptureProjectId(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">프로젝트 미지정</option>
                    {activeProjects.map(project => (
                      <option key={project.id} value={project.id}>
                        📁 {project.title}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="빠른 입력 우선순위"
                    value={capturePriority}
                    onChange={e => setCapturePriority(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">우선순위 미지정</option>
                    <option value="1">P1 높음</option>
                    <option value="2">P2 보통</option>
                    <option value="3">P3 낮음</option>
                  </select>
                </div>
              </div>

              <TodoCreateInput
                submitLabel={captureWhen === 'inbox' ? '수집함에 저장' : '할 일 저장'}
                onCreate={(title, key) =>
                  createTodo(
                    {
                      title,
                      scope: resolvedScope,
                      scopeKey: resolvedScopeKey,
                      status: 'pending',
                      order: 0,
                      projectId: captureProjectId || null,
                      priority: capturePriority ? (Number(capturePriority) as TodoPriority) : null,
                    },
                    key,
                  )
                }
                onDone={() => setOpen(false)}
                className={fieldClass}
              />
              <Link href="/inbox" onClick={() => setOpen(false)} className="mt-4 block text-sm text-blue-600">
                수집함 열기
              </Link>
            </>
          ) : mode === 'note' ? (
            <form onSubmit={e => void submitNote(e)} className="space-y-3">
              <select
                aria-label="빠른 노트 분류"
                value={noteKind}
                disabled={noteBusy}
                onChange={e => setNoteKind(e.target.value as NoteKind)}
                className={fieldClass}
              >
                <option value="insight">💡 인사이트</option>
                <option value="principle">📌 내 원칙</option>
                <option value="decision">⚖️ 의사결정</option>
                <option value="reference">🗂️ 레퍼런스</option>
              </select>
              <input
                type="text"
                aria-label="빠른 노트 제목"
                placeholder="핵심 한 줄 제목"
                value={noteTitle}
                disabled={noteBusy}
                onChange={e => setNoteTitle(e.target.value)}
                className={fieldClass}
              />
              <textarea
                rows={3}
                aria-label="빠른 노트 내용"
                placeholder="내용 (선택)"
                value={noteBody}
                disabled={noteBusy}
                onChange={e => setNoteBody(e.target.value)}
                className={fieldClass}
              />
              {noteError && <p role="alert" className="text-xs text-red-600">{noteError}</p>}
              <div className="flex items-center justify-between pt-1">
                <Link href="/notes" onClick={() => setOpen(false)} className="text-sm text-blue-600">
                  노트함 열기
                </Link>
                <button type="submit" disabled={noteBusy} className={actionClass}>
                  {noteBusy ? '저장 중…' : '노트로 저장'}
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (expenseBusy) return;
                const parsedAmount = Number(expenseAmount.replace(/,/g, '').trim());
                if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                  setExpenseError('올바른 지출 금액을 입력해 주세요.');
                  return;
                }
                if (!expenseMerchant.trim()) {
                  setExpenseError('내용 또는 가맹점을 입력해 주세요.');
                  return;
                }
                setExpenseBusy(true);
                setExpenseError('');
                try {
                  await createFinanceTransaction({
                    date: expenseDate || todayIso,
                    time: null,
                    kind: 'expense',
                    amount: parsedAmount,
                    currency: 'KRW',
                    category: expenseCategory || DEFAULT_EXPENSE_CATEGORIES[0],
                    subCategory: null,
                    merchant: expenseMerchant.trim(),
                    paymentMethod: expensePayment.trim() || null,
                    note: null,
                    excluded: false,
                    source: 'manual',
                    subscriptionId: null,
                  });
                  setExpenseAmount('');
                  setExpenseMerchant('');
                  setExpensePayment('');
                  setOpen(false);
                } catch {
                  setExpenseError('지출 내역을 저장하지 못했어요.');
                } finally {
                  setExpenseBusy(false);
                }
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="1"
                  aria-label="지출 금액"
                  placeholder="금액 (원)"
                  value={expenseAmount}
                  disabled={expenseBusy}
                  onChange={e => setExpenseAmount(e.target.value)}
                  className={fieldClass}
                />
                <input
                  type="date"
                  aria-label="지출 날짜"
                  value={expenseDate}
                  disabled={expenseBusy}
                  onChange={e => setExpenseDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <input
                type="text"
                aria-label="지출 내용"
                placeholder="내용 / 가맹점 (예: 스타벅스)"
                value={expenseMerchant}
                disabled={expenseBusy}
                onChange={e => setExpenseMerchant(e.target.value)}
                className={fieldClass}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="지출 분류"
                  value={expenseCategory}
                  disabled={expenseBusy}
                  onChange={e => setExpenseCategory(e.target.value)}
                  className={fieldClass}
                >
                  {DEFAULT_EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="지출 결제수단"
                  placeholder="결제수단 (선택)"
                  value={expensePayment}
                  disabled={expenseBusy}
                  onChange={e => setExpensePayment(e.target.value)}
                  className={fieldClass}
                />
              </div>
              {expenseError && <p role="alert" className="text-xs text-red-600">{expenseError}</p>}
              <div className="flex items-center justify-between pt-1">
                <Link href="/finance" onClick={() => setOpen(false)} className="text-sm text-blue-600">
                  가계부 열기
                </Link>
                <button type="submit" disabled={expenseBusy} className={actionClass}>
                  {expenseBusy ? '저장 중…' : '지출 저장'}
                </button>
              </div>
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}
