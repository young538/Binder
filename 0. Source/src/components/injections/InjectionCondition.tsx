import type { InjectionEntry } from '@/lib/injections';
import styles from './journal.module.css';

export function readCondition(form: HTMLFormElement) {
  const values = new FormData(form);
  const text = (name: string) => String(values.get(name) ?? '').trim() || null;
  const weight = text('weightKg');
  const appetite = text('appetiteSuppression');
  return {
    injectionSite: text('injectionSite'), weightKg: weight === null ? null : Number(weight),
    appetiteSuppression: appetite === null ? null : Number(appetite),
    conditionNote: text('conditionNote'), lifestyleNote: text('lifestyleNote'),
  };
}

export function ConditionFields({ entry, fieldClass }: { entry?: InjectionEntry; fieldClass: string }) {
  return <details className="rounded-xl border border-zinc-200 px-3 dark:border-zinc-700">
    <summary className="cursor-pointer py-3 text-sm font-semibold">회차별 상태 기록 (선택)</summary>
    <div className="grid min-w-0 gap-3 pb-3 text-sm sm:grid-cols-2">
      <label>주사 부위<input name="injectionSite" className={fieldClass} maxLength={80} defaultValue={entry?.injectionSite ?? ''} /></label>
      <label>당일 체중 (kg)<input name="weightKg" type="number" inputMode="decimal" min="0.01" step="any" className={fieldClass} defaultValue={entry?.weightKg ?? ''} /></label>
      <label>식욕 억제도<select name="appetiteSuppression" className={fieldClass} defaultValue={entry?.appetiteSuppression ?? ''}>
        <option value="">미입력</option>
        {[1, 2, 3, 4, 5].map(score => <option key={score} value={score}>{score}점{score === 1 ? ' · 약함' : score === 5 ? ' · 강함' : ''}</option>)}
      </select></label>
      <label className="sm:col-span-2">부작용·컨디션<textarea name="conditionNote" className={fieldClass} maxLength={4000} rows={2} defaultValue={entry?.conditionNote ?? ''} /></label>
      <label className="sm:col-span-2">식단·운동 등 상세 메모<textarea name="lifestyleNote" className={fieldClass} maxLength={4000} rows={2} defaultValue={entry?.lifestyleNote ?? ''} /></label>
    </div>
  </details>;
}

export function ConditionHistory({ entry, weightChange }: { entry: InjectionEntry; weightChange?: number }) {
  const { injectionSite, weightKg, appetiteSuppression, conditionNote, lifestyleNote } = entry;
  if (!injectionSite && weightKg == null && appetiteSuppression == null && !conditionNote && !lifestyleNote) return null;
  return <div className={styles.condition}>
    <div className={styles.observations}>
      {injectionSite && <span>주사 부위 {injectionSite}</span>}
      {weightKg != null && <span>체중 {weightKg} kg{weightChange !== undefined && ' (이전 기록 대비 ' + (weightChange > 0 ? '+' : '') + weightChange + ' kg)'}</span>}
      {appetiteSuppression != null && <span>식욕 억제도 {appetiteSuppression}/5점</span>}
    </div>
    {conditionNote && <p><b>부작용·컨디션</b> {conditionNote}</p>}
    {lifestyleNote && <p><b>식단·운동 등 메모</b> {lifestyleNote}</p>}
  </div>;
}
