import { useEffect, useState, type RefObject } from 'react';
import { computeCharOffset } from '../lib/charOffset';
import type { ParsedBook } from '../types/book';

export function useScrollTracker(
  scrollRef: RefObject<HTMLDivElement | null>,
  book: ParsedBook | null,
): number {
  const [currentChar, setCurrentChar] = useState(0);

  useEffect(() => {
    setCurrentChar(0);
    const el = scrollRef.current;
    if (!el || !book) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setCurrentChar(computeCharOffset(el, book.chapters));
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    setCurrentChar(computeCharOffset(el, book.chapters));

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [book, scrollRef]);

  return currentChar;
}