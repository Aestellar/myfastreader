import type { WordRef } from './words';

export interface Chunk {
  words: WordRef[];
  text: string;
  charCount: number;
  startIndex: number;
  endIndex: number;
  endsSentence: boolean;
  endsClause: boolean;
}

const SENTENCE_END = /[.!?…]["»'”’)\]]*$/;
const CLAUSE_END = /[,;:—–-]["»'”’)\]]*$/;

/**
 * Собирает слова в блоки так, чтобы суммарная длина каждого блока
 * была максимально близка к targetChars, но не меньше одного слова.
 * Последнее слово может сделать блок чуть длиннее — это нормально.
 */
export function buildChunks(words: WordRef[], targetChars: number): Chunk[] {
  const chunks: Chunk[] = [];
  let i = 0;

  while (i < words.length) {
    const start = i;
    let charCount = 0;
    let text = '';

    while (i < words.length) {
      const w = words[i];
      const add = w.length + (text ? 1 : 0);
      // Хотя бы одно слово в блоке — добавляем без проверки
      if (charCount > 0 && charCount + add > targetChars) break;
      text += (text ? ' ' : '') + w.text;
      charCount += add;
      i++;
    }

    const last = words[i - 1];
    chunks.push({
      words: words.slice(start, i),
      text,
      charCount,
      startIndex: start,
      endIndex: i,
      endsSentence: SENTENCE_END.test(last.text),
      endsClause: CLAUSE_END.test(last.text),
    });
  }

  return chunks;
}