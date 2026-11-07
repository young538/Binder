export interface ReadingEntry {
  bookId?: string;
  bookTitle: string;
  pages: number;
  memo: string;
}

export function parseReadingEntry(raw?: string, defaultPages = 10): ReadingEntry {
  const empty = { bookTitle: '', pages: defaultPages, memo: '' };
  if (!raw) return empty;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...empty, memo: raw };
    const p = value as Record<string, unknown>;
    return {
      bookId: typeof p.bookId === 'string' ? p.bookId : undefined,
      bookTitle: typeof p.bookTitle === 'string' ? p.bookTitle : '',
      pages: typeof p.pages === 'number' && Number.isFinite(p.pages) && p.pages >= 0 ? p.pages : defaultPages,
      memo: typeof p.memo === 'string' ? p.memo : '',
    };
  } catch { return { ...empty, memo: raw }; }
}

export interface BookHistory {
  bookId: string;
  title: string;
  totalPages: number;
  readingDays: number;
  entries: (ReadingEntry & { date: string })[];
}
