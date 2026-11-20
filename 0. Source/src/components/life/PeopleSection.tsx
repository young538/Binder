'use client';
import { useMemo, useState } from 'react';
import { Cake, Check, Pencil, Phone, Plus, Trash2, UserPlus } from 'lucide-react';
import { isContactDue, nextAnnualOccurrence } from '@/lib/lifeEvents';
import { createPerson, deletePerson, updatePerson } from '@/lib/repo/people';
import { createTodo } from '@/lib/repo/todos';
import type { Person } from '@/lib/types';
import { Dialog, actionClass, fieldClass } from '@/components/common/Dialog';

interface Props {
  people: Person[];
  today: string;
  initialPersonId?: string;
}

export function PeopleSection({ people, today, initialPersonId }: Props) {
  const [editor, setEditor] = useState<{ open: boolean; editing?: Person }>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const sorted = useMemo(() => {
    return [...people]
      .map(person => ({ person, status: isContactDue(person, today) }))
      .sort((a, b) => {
        if (a.status.due !== b.status.due) return a.status.due ? -1 : 1;
        return b.status.overdueDays - a.status.overdueDays || a.person.order - b.person.order;
      });
  }, [people, today]);

  const markContacted = async (person: Person) => {
    if (busyId) return;
    setBusyId(person.id);
    try {
      await updatePerson(person.id, { lastContactAt: today });
      setNotice(`${person.name}님 안부 연락을 오늘(${today})로 기록했어요.`);
    } finally {
      setBusyId(null);
    }
  };

  const addTodoForToday = async (person: Person) => {
    if (busyId) return;
    setBusyId(person.id);
    try {
      await createTodo({
        title: `📞 ${person.name} 안부 연락`,
        scope: 'day',
        scopeKey: today,
        status: 'pending',
        order: 0,
      });
      setNotice(`오늘(${today}) 할 일에 '${person.name} 안부 연락'을 추가했어요.`);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (person: Person) => {
    if (!confirm(`'${person.name}' 연락처 기록을 삭제할까요?`)) return;
    await deletePerson(person.id);
  };

  return (
    <section className="space-y-4" aria-label="소중한 사람 목록">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          소중한 사람들의 연락 주기, 생일, 선물 아이디어를 챙기고 안부 시기를 놓치지 마세요.
        </p>
        <button
          type="button"
          onClick={() => setEditor({ open: true })}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <UserPlus size={14} /> 사람 추가
        </button>
      </div>

      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          아직 등록한 소중한 사람이 없습니다.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sorted.map(({ person, status }) => {
            const bday = person.birthday
              ? nextAnnualOccurrence(person.birthday.slice(5, 10), today)
              : null;
            const highlighted = initialPersonId === person.id;
            return (
              <article
                key={person.id}
                className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
                  highlighted
                    ? 'border-blue-400 ring-2 ring-blue-500/20 dark:border-blue-600'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">{person.name}</h3>
                      {person.relationship && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {person.relationship}
                        </span>
                      )}
                      {status.due && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                          안부 필요
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {person.cadenceDays && <span>주기 {person.cadenceDays}일</span>}
                      <span>
                        {person.lastContactAt
                          ? `최근 연락 ${person.lastContactAt}${status.daysSince != null ? ` (${status.daysSince}일 전)` : ''}`
                          : '최근 연락 기록 없음'}
                      </span>
                      {bday && (
                        <span className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400">
                          <Cake size={12} /> 생일 {person.birthday?.slice(5)} ({bday.daysLeft === 0 ? '오늘' : `D-${bday.daysLeft}`})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`${person.name} 편집`}
                      onClick={() => setEditor({ open: true, editing: person })}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-blue-600 dark:hover:bg-zinc-800"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`${person.name} 삭제`}
                      onClick={() => void remove(person)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {(person.giftIdeas || person.note) && (
                  <div className="mt-2.5 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {person.giftIdeas && (
                      <p>
                        <span className="font-semibold">선물·관심사: </span>
                        {person.giftIdeas}
                      </p>
                    )}
                    {person.note && <p className="whitespace-pre-wrap text-zinc-500">{person.note}</p>}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={busyId === person.id}
                    onClick={() => void markContacted(person)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/50 dark:text-emerald-300"
                  >
                    <Check size={13} /> 오늘 안부 완료
                  </button>
                  <button
                    type="button"
                    disabled={busyId === person.id}
                    onClick={() => void addTodoForToday(person)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Phone size={12} /> <Plus size={12} /> 오늘 할 일로 추가
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editor.open && (
        <PersonEditorDialog
          key={editor.editing?.id ?? 'new'}
          existing={editor.editing}
          nextOrder={people.length}
          onClose={() => setEditor({ open: false })}
        />
      )}
    </section>
  );
}

function PersonEditorDialog({
  existing,
  nextOrder,
  onClose,
}: {
  existing?: Person;
  nextOrder: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [cadenceStr, setCadenceStr] = useState(
    existing?.cadenceDays != null ? String(existing.cadenceDays) : '',
  );
  const [lastContactAt, setLastContactAt] = useState(existing?.lastContactAt ?? '');
  const [birthday, setBirthday] = useState(existing?.birthday ?? '');
  const [giftIdeas, setGiftIdeas] = useState(existing?.giftIdeas ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    let cadenceDays: number | null = null;
    if (cadenceStr.trim()) {
      const n = Number(cadenceStr.trim());
      if (!Number.isSafeInteger(n) || n < 1 || n > 365) {
        setError('안부 주기는 1~365 사이의 정수로 입력해 주세요.');
        return;
      }
      cadenceDays = n;
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        relationship: relationship.trim() || null,
        cadenceDays,
        lastContactAt: lastContactAt || null,
        birthday: birthday || null,
        giftIdeas: giftIdeas.trim() || null,
        note: note.trim() || null,
      };
      if (existing) await updatePerson(existing.id, payload);
      else await createPerson({ ...payload, order: nextOrder });
      onClose();
    } catch {
      setError('정보를 저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={existing ? '사람 정보 편집' : '소중한 사람 추가'} onClose={() => { if (!busy) onClose(); }}>
      <form onSubmit={e => void submit(e)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            이름
            <input
              type="text"
              aria-label="이름"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: 어머니, 민수"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block text-sm font-medium">
            관계
            <input
              type="text"
              aria-label="관계"
              value={relationship}
              onChange={e => setRelationship(e.target.value)}
              placeholder="예: 가족, 대학 동기, 멘토"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            안부 주기 (일)
            <input
              type="number"
              min={1}
              max={365}
              aria-label="안부 주기"
              value={cadenceStr}
              onChange={e => setCadenceStr(e.target.value)}
              placeholder="예: 14"
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block text-sm font-medium">
            최근 연락일
            <input
              type="date"
              aria-label="최근 연락일"
              value={lastContactAt}
              onChange={e => setLastContactAt(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="block text-sm font-medium">
            생일
            <input
              type="date"
              aria-label="생일"
              value={birthday}
              onChange={e => setBirthday(e.target.value)}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>

        <label className="block text-sm font-medium">
          선물 아이디어 · 관심사
          <input
            type="text"
            aria-label="선물 아이디어"
            value={giftIdeas}
            onChange={e => setGiftIdeas(e.target.value)}
            placeholder="좋아하는 음식, 취미, 선물 메모"
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <label className="block text-sm font-medium">
          대화 · 참고 메모
          <textarea
            rows={3}
            aria-label="사람 메모"
            value={note}
            onChange={e => setNote(e.target.value)}
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            취소
          </button>
          <button type="submit" disabled={busy} className={actionClass}>
            {busy ? '저장 중…' : existing ? '변경 저장' : '추가'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
