import type { BookChapter } from '../types/book';

export function computeCharOffset(container: HTMLElement, chapters: BookChapter[]): number {
  const sections = container.querySelectorAll<HTMLElement>('[data-chapter-index]');
  if (sections.length === 0) return 0;

  const cRect = container.getBoundingClientRect();
  const scrollLine = cRect.top + 20;

  let lastEnd = 0;
  for (let i = 0; i < sections.length; i++) {
    const rect = sections[i].getBoundingClientRect();
    if (rect.top <= scrollLine && rect.bottom > scrollLine) {
      const fraction = Math.max(0, (scrollLine - rect.top) / Math.max(rect.height, 1));
      const ch = chapters[i];
      return ch.charStart + fraction * ch.charCount;
    }
    if (rect.top > scrollLine) break;
    lastEnd = chapters[i].charStart + chapters[i].charCount;
  }
  return lastEnd;
}

export function findChapterIndex(chapters: BookChapter[], offset: number): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (offset >= chapters[i].charStart) return i;
  }
  return 0;
}

/** Прокрутка к началу главы. Без smooth — сразу. */
export function scrollToChapter(container: HTMLElement | null, index: number): void {
  if (!container) return;
  const el = container.querySelector<HTMLElement>(`[data-chapter-index="${index}"]`);
  if (el) el.scrollIntoView({ block: 'start' });
}

/** Прокрутка к произвольному смещению в символах. */
export function scrollToCharOffset(
  container: HTMLElement | null,
  chapters: BookChapter[],
  offset: number,
): void {
  if (!container) return;
  const ci = findChapterIndex(chapters, offset);
  const el = container.querySelector<HTMLElement>(`[data-chapter-index="${ci}"]`);
  if (!el) return;

  const ch = chapters[ci];
  const fraction = ch.charCount > 0 ? (offset - ch.charStart) / ch.charCount : 0;

  const containerTop = container.getBoundingClientRect().top;
  const elRect = el.getBoundingClientRect();
  const targetScrollTop =
    container.scrollTop + (elRect.top - containerTop) + elRect.height * fraction;

  container.scrollTop = Math.max(0, targetScrollTop);
}