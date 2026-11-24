import type { Bookmark, ParsedBook } from '../types/book';

interface BookmarksListProps {
  book: ParsedBook | null;
  bookmarks: Bookmark[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onJump: (charOffset: number) => void;
}

export function BookmarksList({
  book,
  bookmarks,
  onAdd,
  onRemove,
  onJump,
}: BookmarksListProps) {
  return (
    <div className="bookmarks-list">
      <div className="settings-title">Закладки</div>
      <button className="bookmark-add" onClick={onAdd} disabled={!book}>
        + Закладка
      </button>
      {bookmarks.length === 0 ? (
        <div className="bookmark-empty">Закладок пока нет</div>
      ) : (
        <ul className="bookmark-list">
          {bookmarks.map(bm => {
            const pct =
              book && book.totalChars > 0
                ? (bm.charOffset / book.totalChars) * 100
                : 0;
            return (
              <li key={bm.id} className="bookmark-item">
                <button
                  className="bookmark-button"
                  onClick={() => onJump(bm.charOffset)}
                  title={`${bm.label} · ${pct.toFixed(1)}% книги`}
                >
                  <span className="bookmark-label">{bm.label}</span>
                  <span className="bookmark-pct">{pct.toFixed(1)}%</span>
                </button>
                <button
                  className="bookmark-remove"
                  onClick={() => onRemove(bm.id)}
                  title="Удалить"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}