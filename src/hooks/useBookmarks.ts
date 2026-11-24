import { useCallback, useEffect, useState } from 'react';
import { findChapterIndex } from '../lib/charOffset';
import type { Bookmark, ParsedBook } from '../types/book';

export function useBookmarks(book: ParsedBook | null, currentChar: number) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    setBookmarks([]);
  }, [book]);

  const add = useCallback(() => {
    if (!book) return;
    const ci = findChapterIndex(book.chapters, currentChar);
    const ch = book.chapters[ci];
    const within = ch.charCount > 0 ? (currentChar - ch.charStart) / ch.charCount : 0;
    const bm: Bookmark = {
      id: crypto.randomUUID(),
      charOffset: Math.round(currentChar),
      chapterIndex: ci,
      label: `${ch.title ?? `Глава ${ci + 1}`} · ${(within * 100).toFixed(0)}%`,
      createdAt: Date.now(),
    };
    setBookmarks(prev => [...prev, bm]);
  }, [book, currentChar]);

  const remove = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  }, []);

  return { bookmarks, add, remove };
}