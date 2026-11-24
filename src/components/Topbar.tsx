import { formatDuration } from '../lib/format';
import { SpeedControl } from './SpeedControl';
import type { ParsedBook } from '../types/book';

interface TopbarProps {
  book: ParsedBook | null;
  loading: boolean;
  totalTimeSec: number;
  remainingTimeSec: number;
  charsPerMin: number;
  progress: number;
  isRsvpActive: boolean;
  isRsvpPlaying: boolean;
  isGradientActive: boolean;
  isGradientPlaying: boolean;
  actualCharsPerMin: number | null;
  onOpen: () => void;
  onToggleRsvp: () => void;
  onToggleGradient: () => void;
  onAdjustSpeed: (delta: number) => void;
  chapters: { charStart: number }[] | null;
}

export function Topbar({
  book,
  loading,
  totalTimeSec,
  remainingTimeSec,
  charsPerMin,
  progress,
  isRsvpActive,
  isRsvpPlaying,
  isGradientActive,
  isGradientPlaying,
  actualCharsPerMin,
  chapters,
  onOpen,
  onToggleRsvp,
  onToggleGradient,
  onAdjustSpeed,
}: TopbarProps) {
  const rsvpLabel = !isRsvpActive
    ? '▶ RSVP'
    : isRsvpPlaying
      ? '⏸ Пауза'
      : '▶ Продолжить';
  const gradientLabel = !isGradientActive
    ? '▶ Градиент'
    : isGradientPlaying
      ? '⏸ Пауза'
      : '▶ Продолжить';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button onClick={onOpen} disabled={loading}>
          {loading ? 'Открываю…' : 'Открыть'}
        </button>
        {book && (
          <>
            <button
              onClick={onToggleRsvp}
              className={`rsvp-button${isRsvpActive ? ' active' : ''}`}
            >
              {rsvpLabel}
            </button>
            <button
              onClick={onToggleGradient}
              className={`rsvp-button${isGradientActive ? ' active' : ''}`}
            >
              {gradientLabel}
            </button>
          </>
        )}
      </div>

      <div className="topbar-center">
        {book && (
          <>
            <span>{book.totalChars.toLocaleString('ru-RU')} симв.</span>
            <span className="sep">·</span>
            <span>{(progress * 100).toFixed(2)}%</span>
            <span className="sep">·</span>
            <span>всего {formatDuration(totalTimeSec)}</span>
            <span className="sep">·</span>
            <span>осталось {formatDuration(remainingTimeSec)}</span>
          </>
        )}
      </div>

      <div className="topbar-right">
        {book && (
          <>
            <SpeedControl charsPerMin={charsPerMin} onAdjust={onAdjustSpeed} />
            {actualCharsPerMin !== null && (
              <span className="actual-speed" title="Фактическая скорость">
                факт: {actualCharsPerMin} зн/мин
              </span>
            )}
          </>
        )}
      </div>

      <div className="topbar-progress">
        <div className="topbar-progress-fill" style={{ width: `${progress * 100}%` }} />
        {book && chapters &&
          chapters.slice(1).map(ch => {
            const left = (ch.charStart / book.totalChars) * 100;
            return (
              <div
                key={ch.charStart}
                className="topbar-progress-tick"
                style={{ left: `${left}%` }}
              />
            );
          })}
      </div>
    </header>
  );
}