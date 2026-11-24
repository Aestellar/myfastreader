/** Индекс фокусной буквы в слове (классическая ORP-таблица). */
export function orpIndex(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

export interface OrpSplit {
  before: string;
  focus: string;
  after: string;
}

/**
 * Разбивает текст блока на три части относительно фокусной буквы
 * первого слова. Всё, что до фокуса — «before», сам фокус — «focus»,
 * остальное (включая хвост первого слова) — «after».
 */
export function splitForOrp(chunkText: string, firstWordLen: number): OrpSplit {
  const firstWord = chunkText.slice(0, firstWordLen);
  const idx = Math.min(orpIndex(firstWord), Math.max(0, chunkText.length - 1));
  return {
    before: chunkText.slice(0, idx),
    focus: chunkText.slice(idx, idx + 1),
    after: chunkText.slice(idx + 1),
  };
}

/** Bionic-разбиение: первая половина слова (с округлением вверх) — жирная. */
export function bionicSplit(word: string): { bold: string; rest: string } {
  const len = word.length;
  const boldLen = Math.max(1, Math.ceil(len / 2));
  return { bold: word.slice(0, boldLen), rest: word.slice(boldLen) };
}