import React, { useMemo } from 'react';
import type { ParsedBook } from '../types/book';

export function BookView({ book }: { book: ParsedBook }) {
  const combined = useMemo(
    () => book.chapters.map(c => c.html).join('\n<hr class="chapter-sep" />\n'),
    [book],
  );

  return (
    <div
      className="book-view"
      // ВНИМАНИЕ: контент книг не является доверенным.
      // О безопасности — см. раздел ниже.
      dangerouslySetInnerHTML={{ __html: combined }}
    />
  );
}