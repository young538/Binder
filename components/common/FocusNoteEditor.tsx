'use client';
import { FocusScope } from '@/lib/types';
import { useFocusEditor } from '@/lib/autosave/editors';
import { AutosaveStatus } from './AutosaveStatus';

interface Props {
  scope: FocusScope;
  scopeKey: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

export const FocusNoteEditor = ({ scope, scopeKey, label, placeholder, multiline, rows }: Props) => {
  const editor = useFocusEditor(scope, scopeKey);
  const text = editor.value;
  const onChange = editor.patch;
  if (!editor.loaded) return <AutosaveStatus {...editor} />;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{label}</div>
      {multiline ? (
        <textarea
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '자유롭게 적어보세요'}
          rows={rows ?? 8}
          className="w-full text-sm leading-relaxed bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-50 placeholder:text-zinc-400 resize-y min-h-[8rem]"
        />
      ) : (
        <input
          type="text"
          value={text}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '한 문장으로 적어보세요'}
          className="w-full text-lg font-medium bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-50 placeholder:text-zinc-400"
        />
      )}
      <AutosaveStatus {...editor} />
    </div>
  );
};
