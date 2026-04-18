'use client';
import { useBinder } from '@/store';
import { updateSettings } from '@/lib/repo/settings';
import { Settings } from '@/lib/types';

export const SettingsForm = () => {
  const { settings, reload } = useBinder();
  if (!settings) return null;

  const patch = async (partial: Partial<Settings>) => {
    await updateSettings(partial);
    await reload();
  };

  const inputCls =
    'border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 space-y-4">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">환경 설정</h2>
      <label className="flex items-center gap-3">
        <span className="w-32 text-sm text-zinc-700 dark:text-zinc-300">주 시작일</span>
        <select
          value={settings.firstDayOfWeek}
          onChange={(e) => patch({ firstDayOfWeek: e.target.value as 'mon' | 'sun' })}
          className={inputCls}
        >
          <option value="mon">월요일</option>
          <option value="sun">일요일</option>
        </select>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-32 text-sm text-zinc-700 dark:text-zinc-300">그리드 단위</span>
        <select
          value={settings.gridMinutes}
          onChange={(e) => patch({ gridMinutes: Number(e.target.value) as 30 | 60 })}
          className={inputCls}
        >
          <option value={30}>30분</option>
          <option value={60}>60분</option>
        </select>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-32 text-sm text-zinc-700 dark:text-zinc-300">시작 시각</span>
        <input
          type="number"
          min={0}
          max={23}
          value={settings.dayStartHour}
          onChange={(e) => patch({ dayStartHour: Number(e.target.value) })}
          className={`${inputCls} w-24`}
        />
        <span className="text-sm text-zinc-500">시</span>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-32 text-sm text-zinc-700 dark:text-zinc-300">종료 시각</span>
        <input
          type="number"
          min={1}
          max={24}
          value={settings.dayEndHour}
          onChange={(e) => patch({ dayEndHour: Number(e.target.value) })}
          className={`${inputCls} w-24`}
        />
        <span className="text-sm text-zinc-500">시</span>
      </label>
      <label className="flex items-center gap-3">
        <span className="w-32 text-sm text-zinc-700 dark:text-zinc-300">테마</span>
        <select
          value={settings.theme}
          onChange={(e) => patch({ theme: e.target.value as 'light' | 'dark' })}
          className={inputCls}
        >
          <option value="light">라이트 (기본)</option>
          <option value="dark">다크</option>
        </select>
      </label>
    </section>
  );
};
