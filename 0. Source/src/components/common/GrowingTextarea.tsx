'use client';

import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react';

type Props = ComponentPropsWithoutRef<'textarea'> & { minHeight?: number };

/** Keep long notes readable without a second vertical scrollbar. */
export function GrowingTextarea({ value, minHeight = 176, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input) return;
    const fit = () => {
      input.style.height = 'auto';
      input.style.height = `${Math.max(minHeight, input.scrollHeight + 2)}px`;
    };
    fit();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth === width) return;
      width = input.clientWidth;
      fit();
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [value, minHeight]);

  return <textarea {...props} ref={ref} value={value} />;
}
