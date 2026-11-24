import { ZipPicker } from './components/ZipPicker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBook } from './hooks/useBook';
import { useScrollTracker } from './hooks/useScrollTracker';
import { useBookmarks } from './hooks/useBookmarks';
import { useRsvp } from './hooks/useRsvp';
import { Topbar } from './components/Topbar';
import { Toc } from './components/Toc';
import { ReaderPane } from './components/ReaderPane';
import { RightPane } from './components/RightPane';
import { RsvpOverlay } from './components/RsvpOverlay';
import {
  computeCharOffset,
  findChapterIndex,
  scrollToChapter,
  scrollToCharOffset,
} from './lib/charOffset';
import {
  DEFAULT_CHARS_PER_MIN,
  MIN_CHARS_PER_MIN,
  MAX_CHARS_PER_MIN,
  RSVP_FOCUS_RATIO,
} from './config';
import './App.css';

export default function App() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    book,
    error,
    loading,
    openBook,
    pendingZipEntries,
    pickFromZip,
    cancelZip,
  } = useBook();
  const currentChar = useScrollTracker(scrollRef, book);
  const [charsPerMin, setCharsPerMin] = useState(DEFAULT_CHARS_PER_MIN);
  const { bookmarks, add: addBookmark, remove: removeBookmark } = useBookmarks(
    book,
    currentChar,
  );
  const rsvp = useRsvp({ book, charsPerMin, currentChar, scrollRef });

  const [gradientActive, setGradientActive] = useState(false);
  const [gradientPlaying, setGradientPlaying] = useState(false);
  const [leftHidden, setLeftHidden] = useState(false);
  const [rightHidden, setRightHidden] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [book]);

  useEffect(() => {
    setGradientActive(false);
    setGradientPlaying(false);
  }, [book]);

  // --- Градиентный автоскролл ---
  useEffect(() => {
    if (!gradientActive || !gradientPlaying || !book) return;
    const container = scrollRef.current;
    if (!container) return;

    let lastT = performance.now();
    let rafId = 0;

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(now - lastT, 100);
      lastT = now;

      const co = computeCharOffset(container, book.chapters);
      const ci = findChapterIndex(book.chapters, co);
      const sectionEl = container.querySelector<HTMLElement>(
        `[data-chapter-index="${ci}"]`,
      );

      if (sectionEl) {
        const ch = book.chapters[ci];
        if (ch.charCount > 0) {
          const h = sectionEl.getBoundingClientRect().height;
          const pixelsPerChar = h / ch.charCount;
          const delta = pixelsPerChar * (charsPerMin / 60000) * dt;
          container.scrollTop += delta;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gradientActive, gradientPlaying, book, charsPerMin, scrollRef]);

  const adjustSpeed = useCallback((delta: number) => {
    setCharsPerMin(prev =>
      Math.max(MIN_CHARS_PER_MIN, Math.min(MAX_CHARS_PER_MIN, prev + delta)),
    );
  }, []);

  const handleJumpToChapter = useCallback((index: number) => {
    scrollToChapter(scrollRef.current, index);
  }, []);

  const handleJumpToOffset = useCallback(
    (offset: number) => {
      if (!book) return;
      scrollToCharOffset(scrollRef.current, book.chapters, offset);
    },
    [book],
  );

  const handleToggleRsvp = () => {
    if (rsvp.isActive) {
      rsvp.stop();
    } else {
      setGradientActive(false);
      setGradientPlaying(false);
      rsvp.start();
    }
  };

  const handleToggleGradient = () => {
    if (gradientActive) {
      setGradientActive(false);
      setGradientPlaying(false);
    } else {
      rsvp.stop();
      setGradientActive(true);
      setGradientPlaying(true);
    }
  };

  // --- Единая клавиатура для обоих режимов ---
  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (rsvp.isActive) rsvp.togglePlay();
        else if (gradientActive) setGradientPlaying(p => !p);
        else rsvp.start();
      } else if (e.code === 'Escape') {
        if (rsvp.isActive) rsvp.stop();
        if (gradientActive) {
          setGradientActive(false);
          setGradientPlaying(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book, rsvp, gradientActive]);

  const handleReaderMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!book) return;
      if (!rsvp.isActive || rsvp.isPlaying) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;

      const cp = (document as unknown as {
        caretPositionFromPoint?: (
          x: number,
          y: number,
        ) => { offsetNode: Node; offset: number } | null;
      }).caretPositionFromPoint?.(e.clientX, e.clientY);
      if (!cp) return;

      rsvp.seekToCaret(cp.offsetNode, cp.offset);
    },
    [book, rsvp],
  );

  const progress = book && book.totalChars > 0 ? currentChar / book.totalChars : 0;
  const totalTimeSec = book ? (book.totalChars / charsPerMin) * 60 : 0;
  const remainingTimeSec = book
    ? ((book.totalChars - currentChar) / charsPerMin) * 60
    : 0;

  return (
    <div className="app">
      <Topbar
        chapters={book?.chapters ?? null}
        book={book}
        loading={loading}
        totalTimeSec={totalTimeSec}
        remainingTimeSec={remainingTimeSec}
        charsPerMin={charsPerMin}
        progress={progress}
        isRsvpActive={rsvp.isActive}
        isRsvpPlaying={rsvp.isPlaying}
        isGradientActive={gradientActive}
        isGradientPlaying={gradientPlaying}
        actualCharsPerMin={rsvp.actualCharsPerMin}
        onOpen={openBook}
        onToggleRsvp={handleToggleRsvp}
        onToggleGradient={handleToggleGradient}
        onAdjustSpeed={adjustSpeed}
      />

      {error && <div className="error">{error}</div>}

      <div className="layout">
        {!leftHidden && (
          <aside className="sidebar">
            <button
              className="panel-hide-btn"
              onClick={() => setLeftHidden(true)}
              title="Скрыть панель"
            >
              ‹
            </button>
            {book && <Toc book={book} onJumpToChapter={handleJumpToChapter} />}
          </aside>
        )}
        {leftHidden && (
          <button
            className="panel-reveal panel-reveal-left"
            onClick={() => setLeftHidden(false)}
            title="Показать оглавление"
          >
            ›
          </button>
        )}

        <ReaderPane
          book={book}
          scrollRef={scrollRef}
          gradientActive={gradientActive}
          onMouseUp={handleReaderMouseUp}
        />

        {!rightHidden && (
          <RightPane
            book={book}
            rsvpConfig={rsvp.config}
            onRsvpConfigChange={rsvp.setConfig}
            bookmarks={bookmarks}
            onAddBookmark={addBookmark}
            onRemoveBookmark={removeBookmark}
            onJumpToBookmark={handleJumpToOffset}
            onHide={() => setRightHidden(true)}
          />
        )}
        {rightHidden && (
          <button
            className="panel-reveal panel-reveal-right"
            onClick={() => setRightHidden(false)}
            title="Показать панель"
          >
            ‹
          </button>
        )}
      </div>

      {rsvp.isActive &&
        rsvp.isPlaying &&
        rsvp.currentChunk &&
        rsvp.config.highlight !== 'creep' && (
          <RsvpOverlay
            chunk={rsvp.currentChunk}
            trail={rsvp.recentChunks}
            highlight={rsvp.config.highlight}
            isPlaying={rsvp.isPlaying}
            focusRatio={RSVP_FOCUS_RATIO}
            durationMs={rsvp.currentChunkDurationMs}
            fontScale={rsvp.config.fontScale}
          />
        )}

      {rsvp.isActive && !rsvp.isPlaying && (
        <div className="rsvp-paused-pill">
          ⏸ Пауза · Space — продолжить · клик по слову — читать с него
        </div>
      )}

      {gradientActive && !gradientPlaying && (
        <div className="rsvp-paused-pill">⏸ Градиент на паузе · Space — продолжить</div>
      )}
            {pendingZipEntries && (
        <ZipPicker
          entries={pendingZipEntries}
          onPick={pickFromZip}
          onCancel={cancelZip}
        />
      )}
    </div>
  );
}