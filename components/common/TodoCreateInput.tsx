'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onCreate: (title: string, requestKey: string) => Promise<unknown>;
  onDone: () => void;
  className?: string;
}

/** One draft has one successful submission, even when Enter and blur overlap. */
export function TodoCreateInput({ onCreate, onDone, className }: Props) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const phase = useRef<'idle' | 'saving' | 'done'>('idle');
  const composing = useRef(false);
  const mounted = useRef(true);
  const attempt = useRef<{ title: string; run: () => Promise<unknown> } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const cancel = () => {
    if (phase.current !== 'idle') return;
    phase.current = 'done';
    onDone();
  };

  const submit = async (value: string) => {
    if (phase.current !== 'idle') return;
    const title = value.trim();
    if (!title) { cancel(); return; }
    // React state updates alone cannot lock consecutive events in the same tick.
    phase.current = 'saving';
    setSaving(true);
    setError('');
    try {
      if (attempt.current?.title !== title) {
        const requestKey = crypto.randomUUID();
        // Keep both the key and first payload/callback across an uncertain response.
        attempt.current = { title, run: () => onCreate(title, requestKey) };
      }
      await attempt.current.run();
    } catch {
      phase.current = 'idle';
      if (mounted.current) {
        setSaving(false);
        setError('저장하지 못했어요. Enter를 눌러 다시 시도해 주세요.');
      }
      return;
    }
    phase.current = 'done';
    if (mounted.current) onDone();
  };

  return (
    <>
      <input
        type="text"
        value={draft}
        autoFocus
        readOnly={saving}
        aria-busy={saving}
        aria-label="새 할 일"
        onChange={event => setDraft(event.target.value)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; }}
        onBlur={event => { void submit(event.currentTarget.value); }}
        onKeyDown={event => {
          if (event.key !== 'Enter' && event.key !== 'Escape') return;
          // keyCode 229 also covers browsers ending IME composition before keydown.
          if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          event.preventDefault();
          event.stopPropagation();
          if (event.repeat) return;
          if (event.key === 'Escape') cancel();
          else void submit(event.currentTarget.value);
        }}
        placeholder="할 일"
        className={className}
      />
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </>
  );
}
