import { useEffect, useState } from 'react';
import type { ParsedBook } from '../types/book';
import { chapterToPlainText } from '../lib/text';

interface TocProps {
  book: ParsedBook;
  onJumpToChapter: (index: number) => void;
}

interface MenuState {
  x: number;
  y: number;
  chapterIndex: number;
}

export function Toc({ book, onJumpToChapter }: TocProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  async function copyChapter(index: number) {
    const ch = book.chapters[index];
    if (!ch) return;
    const text = chapterToPlainText(ch.html);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied(null), 1200);
    } catch (e) {
      console.error('[toc] clipboard error:', e);
    }
  }

  return (
    <>
      <ul className="toc">
        {book.chapters.map((ch, i) => {
          const startPct = book.totalChars > 0 ? (ch.charStart / book.totalChars) * 100 : 0;
          const sizePct = book.totalChars > 0 ? (ch.charCount / book.totalChars) * 100 : 0;
          const tip =
            (ch.title ? `${ch.title}\n\n` : '') +
            `К началу главы: ${startPct.toFixed(1)}% книги ` +
            `(${ch.charStart.toLocaleString('ru-RU')} симв.)\n` +
            `Размер главы: ${sizePct.toFixed(1)}% ` +
            `(${ch.charCount.toLocaleString('ru-RU')} симв.)`;
          const isCopied = copied === i;
          return (
            <li
              key={ch.id}
              className="toc-item"
              style={{ '--progress': `${startPct}%` } as React.CSSProperties}
            >
              <button
                className={'toc-button' + (ch.titleIsFallback ? ' toc-button-fallback' : '')}
                onClick={() => onJumpToChapter(i)}
                onContextMenu={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu({ x: e.clientX, y: e.clientY, chapterIndex: i });
                }}
                title={tip}
              >
                {isCopied ? '✓ Скопировано' : (ch.title ?? `Глава ${i + 1}`)}
              </button>
            </li>
          );
        })}
      </ul>

      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              copyChapter(menu.chapterIndex);
              setMenu(null);
            }}
          >
            Копировать текст главы
          </button>
        </div>
      )}
    </>
  );
}