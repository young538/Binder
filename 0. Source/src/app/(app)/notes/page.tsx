import { NotesPage } from '@/components/notes/NotesPage';
import type { NoteKind } from '@/lib/types';

const KINDS: NoteKind[] = ['principle', 'decision', 'insight', 'reference'];

export default async function NotesRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; kind?: string }>;
}) {
  const { note, kind } = await searchParams;
  const initialKind = kind && KINDS.includes(kind as NoteKind) ? (kind as NoteKind) : undefined;
  return <NotesPage initialNoteId={note} initialKind={initialKind} />;
}
