export const DEFAULT_CHARS_PER_MIN = 1500;
export const MIN_CHARS_PER_MIN = 100;
export const MAX_CHARS_PER_MIN = 20000;

/** На какой высоте читалки держать текущий блок (0..1). */
export const RSVP_FOCUS_RATIO = 0.35;

/** Размер блока в символах. */
export const MIN_CHUNK_SIZE = 4;
export const MAX_CHUNK_SIZE = 70;
export const CHUNK_SIZE_STEP = 2;

export const MIN_FONT_SCALE = 0.1;
export const MAX_FONT_SCALE = 3;
export const FONT_SCALE_STEP = 0.05;

/** Множители пауз на пунктуации. */
export const RSVP_SENTENCE_PAUSE = 2.5;
export const RSVP_CLAUSE_PAUSE = 1.5;

/** Минимальная длительность показа блока (мс). */
export const RSVP_MIN_CHUNK_MS = 20;

export type RsvpHighlight = 'none' | 'orp' | 'orp-plus' | 'bionic' | 'creep';
const DEFAULT_CHUNK_SIZE = 12
export interface RsvpConfig {
  chunkSize: number;
  highlight: RsvpHighlight;
  pauseOnPunctuation: boolean;
  fontScale: number;
}

export const DEFAULT_RSVP_CONFIG: RsvpConfig = {
  chunkSize: DEFAULT_CHUNK_SIZE,
  highlight: 'orp',
  pauseOnPunctuation: true,
  fontScale: 1,
};

/** Сколько строк-трейлов показывать под ORP (недавняя — сверху). */
export const RSVP_TRAIL_LINES = 7;
