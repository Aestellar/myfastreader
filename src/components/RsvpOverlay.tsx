import { bionicSplit, orpIndex, splitForOrp } from '../lib/orp';
import type { Chunk } from '../lib/chunker';
import type { RsvpHighlight } from '../config';

interface RsvpOverlayProps {
  chunk: Chunk;
  trail: Chunk[];
  highlight: RsvpHighlight;
  isPlaying: boolean;
  focusRatio: number;
  durationMs: number;
  fontScale: number;
}

function BionicRender({ text }: { text: string }) {
  const words = text.split(/\s+/);
  return (
    <>
      {words.map((w, i) => {
        const { bold, rest } = bionicSplit(w);
        return (
          <span key={i}>
            {i > 0 && ' '}
            <span className="rsvp-bionic-bold">{bold}</span>
            <span className="rsvp-bionic-rest">{rest}</span>
          </span>
        );
      })}
    </>
  );
}

function OrpPlusRender({ text }: { text: string }) {
  const words = text.split(/\s+/);
  return (
    <>
      {words.map((w, i) => {
        const idx = orpIndex(w);
        return (
          <span key={i}>
            {i > 0 && ' '}
            {w.slice(0, idx)}
            <span className="rsvp-orp-plus-letter">{w.charAt(idx)}</span>
            {w.slice(idx + 1)}
          </span>
        );
      })}
    </>
  );
}

export function RsvpOverlay({
  chunk,
  trail,
  highlight,
  isPlaying,
  focusRatio,
  durationMs,
  fontScale,
}: RsvpOverlayProps) {
  const firstWordLen = chunk.words[0]?.text.length ?? chunk.text.length;

  let content;
  if (highlight === 'orp') {
    const { before, focus, after } = splitForOrp(chunk.text, firstWordLen);
    content = (
      <div className="rsvp-line">
        <span className="rsvp-left">{before}</span>
        <span className="rsvp-orp">{focus}</span>
        <span className="rsvp-right">{after}</span>
      </div>
    );
  } else if (highlight === 'orp-plus') {
    content = (
      <div className="rsvp-line-left">
        <OrpPlusRender text={chunk.text} />
      </div>
    );
  } else if (highlight === 'bionic') {
    content = (
      <div className="rsvp-line-centered">
        <BionicRender text={chunk.text} />
      </div>
    );
  } else {
    content = <div className="rsvp-line-centered">{chunk.text}</div>;
  }

  return (
    <div
      className="rsvp-overlay"
      style={
        {
          top: `${focusRatio * 100}vh`,
          '--rsvp-scale': fontScale,
        } as React.CSSProperties
      }
    >
      <div className="rsvp-display">
        {content}
        <div
          key={chunk.startIndex}
          className="rsvp-progress"
          style={{ animationDuration: `${durationMs}ms` }}
          data-playing={isPlaying || undefined}
        />
      </div>

      {trail.length > 0 && (
        <div className="rsvp-trail-stack" aria-hidden="true">
          {[...trail].reverse().map(c => (
            <div key={c.startIndex} className="rsvp-trail">
              {c.text}
            </div>
          ))}
        </div>
      )}

      <div className="rsvp-hint">
        {isPlaying ? 'Space — пауза · Esc — выход' : 'Space — продолжить · Esc — выход'}
      </div>
    </div>
  );
}