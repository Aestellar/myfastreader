import type { RefObject } from 'react';
import type { ParsedBook } from '../types/book';

interface ReaderPaneProps {
  book: ParsedBook | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  gradientActive: boolean;
  onMouseUp?: (e: React.MouseEvent) => void;
}

export function ReaderPane({
  book,
  scrollRef,
  gradientActive,
  onMouseUp,
}: ReaderPaneProps) {
  return (
    <main
      className={'reader' + (gradientActive ? ' gradient-active' : '')}
      ref={scrollRef}
      onMouseUp={onMouseUp}
    >
      {gradientActive && <div className="reader-gradient-mask" />}
      {book ? (
        <div className="reader-text">
          {book.chapters.map((ch, i) => (
            <section
              key={ch.id}
              data-chapter-index={i}
              dangerouslySetInnerHTML={{ __html: ch.html }}
            />
          ))}
        </div>
      ) : (
        <div className="placeholder">Откройте файл FB2 или EPUB</div>
      )}
    </main>
  );
}