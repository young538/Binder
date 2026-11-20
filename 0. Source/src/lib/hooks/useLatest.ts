'use client';
import { useLayoutEffect, useRef } from 'react';

/** Callbacks see the latest committed render, never an abandoned concurrent render. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => { ref.current = value; }, [value]);
  return ref;
}
