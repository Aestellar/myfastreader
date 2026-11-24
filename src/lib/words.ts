export interface WordRef {
  text: string;
  node: Text;
  nodeOffset: number;
  length: number;
}

export function collectWordsFromElement(root: HTMLElement): WordRef[] {
  const words: WordRef[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const tn = node as Text;
    if (!tn.data.trim()) continue;
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(tn.data)) !== null) {
      words.push({ text: m[0], node: tn, nodeOffset: m.index, length: m[0].length });
    }
  }
  return words;
}

export function scrollWordToView(
  word: WordRef,
  container: HTMLElement,
  ratio: number,
): void {
  const range = document.createRange();
  try {
    range.setStart(word.node, word.nodeOffset);
    range.setEnd(word.node, word.nodeOffset + word.length);
  } catch {
    return;
  }
  const rect = range.getBoundingClientRect();
  const cRect = container.getBoundingClientRect();
  const targetY = cRect.top + cRect.height * ratio;
  container.scrollTop += rect.top - targetY;
}