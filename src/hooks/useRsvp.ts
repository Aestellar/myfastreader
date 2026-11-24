import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { findChapterIndex } from '../lib/charOffset';
import { collectWordsFromElement, scrollWordToView, type WordRef } from '../lib/words';
import { buildChunks, type Chunk } from '../lib/chunker';
import {
  RSVP_FOCUS_RATIO,
  RSVP_SENTENCE_PAUSE,
  RSVP_CLAUSE_PAUSE,
  RSVP_MIN_CHUNK_MS,
  RSVP_TRAIL_LINES,
  DEFAULT_RSVP_CONFIG,
  type RsvpConfig,
} from '../config';
import type { ParsedBook } from '../types/book';

export interface UseRsvpOptions {
  book: ParsedBook | null;
  charsPerMin: number;
  currentChar: number;
  scrollRef: RefObject<HTMLDivElement | null>;
}

export interface UseRsvpResult {
  isActive: boolean;
  isPlaying: boolean;
  currentChunk: Chunk | null;
  currentChunkDurationMs: number;
  recentChunks: Chunk[];
  actualCharsPerMin: number | null;
  config: RsvpConfig;
  setConfig: (patch: Partial<RsvpConfig>) => void;
  start: () => void;
  stop: () => void;
  togglePlay: () => void;
  seekToCaret: (node: Node, offset: number) => void;
}

/** Пауза пунктуации значима только на коротких блоках.
 *  При размере ≤ 15 символов — полный множитель, при 70+ — почти 1×. */
function pauseFactorFor(chunk: Chunk, base: number): number {
  const scale = Math.min(1, 15 / Math.max(1, chunk.charCount));
  return 1 + (base - 1) * scale;
}

const ACTUAL_WINDOW_MS = 60000;
const ACTUAL_MIN_MS = 10000;

export function useRsvp({
  book,
  charsPerMin,
  currentChar,
  scrollRef,
}: UseRsvpOptions): UseRsvpResult {
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [config, setConfigState] = useState<RsvpConfig>(DEFAULT_RSVP_CONFIG);
  const [actualCharsPerMin, setActualCharsPerMin] = useState<number | null>(null);

  const wordsCache = useRef<Map<number, WordRef[]>>(new Map());
  const chunksCache = useRef<Map<number, Chunk[]>>(new Map());
  const sessionRef = useRef<{ chars: number } | null>(null);
  const samplesRef = useRef<Array<{ t: number; chars: number }>>([]);

  useEffect(() => {
    wordsCache.current.clear();
    chunksCache.current.clear();
    setIsActive(false);
    setIsPlaying(false);
    setChapterIndex(0);
    setChunkIndex(0);
    setActualCharsPerMin(null);
    sessionRef.current = null;
    samplesRef.current = [];
  }, [book]);



  const getWordsForChapter = useCallback(
    (ci: number): WordRef[] => {
      const cached = wordsCache.current.get(ci);
      if (cached) return cached;
      const el = scrollRef.current?.querySelector<HTMLElement>(
        `[data-chapter-index="${ci}"]`,
      );
      if (!el) return [];
      const words = collectWordsFromElement(el);
      wordsCache.current.set(ci, words);
      return words;
    },
    [scrollRef],
  );

  const getChunksForChapter = useCallback(
    (ci: number): Chunk[] => {
      const cached = chunksCache.current.get(ci);
      if (cached) return cached;
      const words = getWordsForChapter(ci);
      const chunks = buildChunks(words, config.chunkSize);
      chunksCache.current.set(ci, chunks);
      return chunks;
    },
    [getWordsForChapter, config.chunkSize],
  );

  const setConfig = useCallback((patch: Partial<RsvpConfig>) => {
    setConfigState(prev => ({ ...prev, ...patch }));
  }, []);

  const lastChunkSizeRef = useRef(config.chunkSize);
  useEffect(() => {
    if (lastChunkSizeRef.current === config.chunkSize) return;
    lastChunkSizeRef.current = config.chunkSize;

    const oldChunks = chunksCache.current.get(chapterIndex);
    const anchorWord =
      oldChunks && oldChunks[chunkIndex] ? oldChunks[chunkIndex].startIndex : null;

    chunksCache.current.clear();
    if (anchorWord === null) return;

    const words = getWordsForChapter(chapterIndex);
    const newChunks = buildChunks(words, config.chunkSize);
    chunksCache.current.set(chapterIndex, newChunks);

    let newIdx = 0;
    for (let i = 0; i < newChunks.length; i++) {
      if (anchorWord >= newChunks[i].startIndex && anchorWord < newChunks[i].endIndex) {
        newIdx = i;
        break;
      }
    }
    setChunkIndex(newIdx);
  }, [config.chunkSize, chapterIndex, chunkIndex, getWordsForChapter]);

  // --- Сброс сэмплов при старте/возобновлении воспроизведения ---
  useEffect(() => {
    if (isActive && isPlaying) {
      samplesRef.current = [
        { t: performance.now(), chars: sessionRef.current?.chars ?? 0 },
      ];
    }
  }, [isActive, isPlaying]);

  // --- Таймер ---
  useEffect(() => {
    if (!isActive || !isPlaying || !book) return;
    const chunks = getChunksForChapter(chapterIndex);
    if (chunks.length === 0) {
      setIsPlaying(false);
      return;
    }
    if (chunkIndex >= chunks.length) {
      if (chapterIndex + 1 < book.chapters.length) {
        setChapterIndex(chapterIndex + 1);
        setChunkIndex(0);
      } else {
        setIsPlaying(false);
      }
      return;
    }
    const chunk = chunks[chunkIndex];
    let factor = 1;
    if (config.pauseOnPunctuation) {
      if (chunk.endsSentence) factor = pauseFactorFor(chunk, RSVP_SENTENCE_PAUSE);
      else if (chunk.endsClause) factor = pauseFactorFor(chunk, RSVP_CLAUSE_PAUSE);
    }
    const intervalMs = Math.max(
      RSVP_MIN_CHUNK_MS,
      ((60000 * chunk.charCount) / charsPerMin) * factor,
    );

    const t = window.setTimeout(() => {
      // Начисляем прочитанные символы в сессию
      if (sessionRef.current) {
        sessionRef.current.chars += chunk.charCount;
        const now = performance.now();
        samplesRef.current.push({ t: now, chars: sessionRef.current.chars });
        while (
          samplesRef.current.length > 1 &&
          now - samplesRef.current[0].t > ACTUAL_WINDOW_MS
        ) {
          samplesRef.current.shift();
        }
      }
      setChunkIndex(i => i + 1);
    }, intervalMs);
    return () => window.clearTimeout(t);
  }, [
    isActive,
    isPlaying,
    book,
    chapterIndex,
    chunkIndex,
    charsPerMin,
    config.pauseOnPunctuation,
    getChunksForChapter,
  ]);

  // --- Пересчёт actualCharsPerMin ---
  useEffect(() => {
    if (!isActive || !isPlaying) return;
    const id = window.setInterval(() => {
      const s = samplesRef.current;
      if (s.length < 2) return;
      const first = s[0];
      const last = s[s.length - 1];
      const dt = last.t - first.t;
      if (dt < ACTUAL_MIN_MS) return;
      const dChars = last.chars - first.chars;
      setActualCharsPerMin(Math.round((dChars / dt) * 60000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isActive, isPlaying]);

  // --- Автоскролл к текущему чанку ---
  useEffect(() => {
    if (!isActive || !book) return;
    const el = scrollRef.current;
    if (!el) return;
    const chunks = getChunksForChapter(chapterIndex);
    if (chunkIndex >= chunks.length) return;
    const firstWord = chunks[chunkIndex].words[0];
    if (firstWord) scrollWordToView(firstWord, el, RSVP_FOCUS_RATIO);
  }, [isActive, book, chapterIndex, chunkIndex, getChunksForChapter, scrollRef]);



  const start = useCallback(() => {
    if (!book) return;
    const ci = findChapterIndex(book.chapters, currentChar);
    const ch = book.chapters[ci];
    const progress =
      ch.charCount > 0
        ? Math.max(0, Math.min(1, (currentChar - ch.charStart) / ch.charCount))
        : 0;
    const chunks = getChunksForChapter(ci);
    const startIdx =
      chunks.length > 0
        ? Math.min(Math.floor(chunks.length * progress), chunks.length - 1)
        : 0;
    sessionRef.current = { chars: 0 };
    samplesRef.current = [];
    setActualCharsPerMin(null);
    setChapterIndex(ci);
    setChunkIndex(startIdx);
    setIsActive(true);
    setIsPlaying(true);
  }, [book, currentChar, getChunksForChapter]);

  const stop = useCallback(() => {
    sessionRef.current = null;
    samplesRef.current = [];
    setActualCharsPerMin(null);
    setIsActive(false);
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);

  // --- Seek по клику на слово в тексте ---
  const seekToCaret = useCallback(
    (node: Node, offset: number) => {
      if (!book) return;
      let el: HTMLElement | null =
        node.nodeType === Node.TEXT_NODE
          ? (node as Text).parentElement
          : (node as HTMLElement);
      while (el && !el.hasAttribute('data-chapter-index')) el = el.parentElement;
      if (!el) return;
      const ci = parseInt(el.getAttribute('data-chapter-index')!, 10);
      if (isNaN(ci) || ci < 0 || ci >= book.chapters.length) return;
      const words = getWordsForChapter(ci);
      const wordIdx = words.findIndex(
        w => w.node === node && offset >= w.nodeOffset && offset < w.nodeOffset + w.length,
      );
      if (wordIdx === -1) return;
      const chunks = getChunksForChapter(ci);
      const chunkIdx = chunks.findIndex(
        c => wordIdx >= c.startIndex && wordIdx < c.endIndex,
      );
      if (chunkIdx === -1) return;
      setChapterIndex(ci);
      setChunkIndex(chunkIdx);
    },
    [book, getWordsForChapter, getChunksForChapter],
  );

  // --- Текущий чанк и его длительность ---
  let currentChunk: Chunk | null = null;
  let currentChunkDurationMs = 0;
  if (isActive && book) {
    const chunks = getChunksForChapter(chapterIndex);
    if (chunkIndex < chunks.length) {
      currentChunk = chunks[chunkIndex];
      let factor = 1;
      if (config.pauseOnPunctuation) {
        if (currentChunk.endsSentence)
          factor = pauseFactorFor(currentChunk, RSVP_SENTENCE_PAUSE);
        else if (currentChunk.endsClause)
          factor = pauseFactorFor(currentChunk, RSVP_CLAUSE_PAUSE);
      }
      currentChunkDurationMs = Math.max(
        RSVP_MIN_CHUNK_MS,
        ((60000 * currentChunk.charCount) / charsPerMin) * factor,
      );
    }
  }

  // --- Трейл ---
  let recentChunks: Chunk[] = [];
  if (isActive && book && chunkIndex > 0) {
    const chunks = getChunksForChapter(chapterIndex);
    const start = Math.max(0, chunkIndex - RSVP_TRAIL_LINES);
    recentChunks = chunks.slice(start, chunkIndex);
  }

  // --- CSS Custom Highlight: текущий чанк ---
  // На паузе — всегда. В режиме 'creep' — и во время воспроизведения.
  useEffect(() => {
    const ch = (CSS as unknown as { highlights?: any })?.highlights;
    if (!ch) return;
    const shouldHighlight =
      isActive && currentChunk && (!isPlaying || config.highlight === 'creep');
    if (!shouldHighlight) {
      try {
        ch.delete('rsvp-current');
      } catch {
        /* noop */
      }
      return;
    }
    const H = (window as unknown as { Highlight?: any }).Highlight;
    if (!H) return;
    const hl = new H();
    for (const word of currentChunk!.words) {
      try {
        const range = document.createRange();
        range.setStart(word.node, word.nodeOffset);
        range.setEnd(word.node, word.nodeOffset + word.length);
        hl.add(range);
      } catch {
        /* узел мог исчезнуть — пропускаем */
      }
    }
    ch.set('rsvp-current', hl);
    return () => {
      try {
        ch.delete('rsvp-current');
      } catch {
        /* noop */
      }
    };
  }, [isActive, isPlaying, currentChunk, config.highlight]);

  return {
    isActive,
    isPlaying,
    currentChunk,
    currentChunkDurationMs,
    recentChunks,
    actualCharsPerMin,
    config,
    setConfig,
    start,
    stop,
    togglePlay,
    seekToCaret,
  };
}