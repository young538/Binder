'use client';

import { FocusScope, Retrospective, RetroType } from '@/lib/types';
import { getFocus, upsertFocus } from '@/lib/repo/focusNotes';
import { getRetrospective, upsertRetrospective } from '@/lib/repo/retrospectives';
import { useAutosaveRecord } from './useAutosaveRecord';

export type RetroPatch = Partial<Pick<Retrospective, 'rating' | 'template' | 'freeText'>>;
export const mergeRetroPatch = (previous: RetroPatch, patch: RetroPatch): RetroPatch => ({
  ...previous,
  ...patch,
  ...(patch.template ? { template: { ...previous.template, ...patch.template } } : {}),
});

export const useRetrospectiveEditor = (type: RetroType, dateOrWeek: string) =>
  useAutosaveRecord<RetroPatch>({
    recordKey: `retrospective:${type}:${dateOrWeek}`,
    initial: { template: {} },
    load: async () => (await getRetrospective(type, dateOrWeek)) ?? { template: {} },
    save: patch => upsertRetrospective(type, dateOrWeek, patch),
    merge: mergeRetroPatch,
    dirty: ['retrospectives'],
  });

export const useFocusEditor = (scope: FocusScope, scopeKey: string) =>
  useAutosaveRecord<string>({
    recordKey: `focus:${scope}:${scopeKey}`,
    initial: '',
    load: async () => (await getFocus(scope, scopeKey))?.text ?? '',
    save: text => upsertFocus(scope, scopeKey, text),
    merge: (_previous, next) => next,
    dirty: ['focusNotes'],
  });
