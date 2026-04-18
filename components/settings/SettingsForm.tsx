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

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">환경 설정</h2>
      <label className="flex items-center gap-2">
        <span className="w-32">주 시작일:</span>
        <select
          value={settings.firstDayOfWeek}
          onChange={(e) =>
            patch({ firstDayOfWeek: e.target.value as 'mon' | 'sun' })
          }
          className="border rounded px-2 py-1"
        >
          <option value="mon">월요일</option>
          <option value="sun">일요일</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-32">그리드 단위:</span>
        <select
          value={settings.gridMinutes}
          onChange={(e) =>
            patch({ gridMinutes: Number(e.target.value) as 30 | 60 })
          }
          className="border rounded px-2 py-1"
        >
          <option value={30}>30분</option>
          <option value={60}>60분</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="w-32">시작 시각:</span>
        <input
          type="number"
          min={0}
          max={23}
          value={settings.dayStartHour}
          onChange={(e) => patch({ dayStartHour: Number(e.target.value) })}
          className="border rounded px-2 py-1 w-20"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="w-32">종료 시각:</span>
        <input
          type="number"
          min={1}
          max={24}
          value={settings.dayEndHour}
          onChange={(e) => patch({ dayEndHour: Number(e.target.value) })}
          className="border rounded px-2 py-1 w-20"
        />
      </label>
    </section>
  );
};
