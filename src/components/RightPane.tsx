import { BookmarksList } from './BookmarksList';
import { RsvpSettings } from './RsvpSettings';
import type { RsvpConfig } from '../config';
import type { Bookmark, ParsedBook } from '../types/book';

interface RightPaneProps {
  book: ParsedBook | null;
  rsvpConfig: RsvpConfig;
  onRsvpConfigChange: (patch: Partial<RsvpConfig>) => void;
  bookmarks: Bookmark[];
  onAddBookmark: () => void;
  onRemoveBookmark: (id: string) => void;
  onJumpToBookmark: (charOffset: number) => void;
  onHide?: () => void;
}

export function RightPane({
  book,
  rsvpConfig,
  onRsvpConfigChange,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark,
  onJumpToBookmark,
  onHide,
}: RightPaneProps) {
  return (
    <aside className="right-pane">
      {onHide && (
        <button className="panel-hide-btn" onClick={onHide} title="Скрыть панель">
          ›
        </button>
      )}
      <RsvpSettings config={rsvpConfig} onChange={onRsvpConfigChange} />
      <div className="settings-divider" />
      <BookmarksList
        book={book}
        bookmarks={bookmarks}
        onAdd={onAddBookmark}
        onRemove={onRemoveBookmark}
        onJump={onJumpToBookmark}
      />
    </aside>
  );
}