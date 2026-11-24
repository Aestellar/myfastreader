import type { BookResource } from '../types/book'; // для единообразия в будущем

/**
 * Возвращает элементы по локальному имени без учёта namespace.
 * Сначала пробует namespace-aware поиск с wildcard ('*'), затем —
 * обычный getElementsByTagName для HTML-fallback случаев.
 */
export function findAll(root: Document | Element, localName: string): Element[] {
  const byNS = root.getElementsByTagNameNS('*', localName);
  if (byNS.length > 0) return Array.from(byNS);
  return Array.from(root.getElementsByTagName(localName));
}

/** Текст после нормализации пробелов: 'a  b\n\nc' → 'a b c'. */
export function normalizeText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function countChars(html: string): number {
  return normalizeText(html).length;
}

/** Минимальный санитайзер контента из недоверенных источников. */
export function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove());
  div.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
      const v = attr.value.trim().toLowerCase();
      if ((attr.name === 'href' || attr.name === 'src') && v.startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return div.innerHTML;
}

/**
 * Заголовок-заглушка для главы без явного названия:
 * первые ~40 символов текста. Возвращает '(без названия)' для пустых.
 */
export function fallbackTitle(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '(без названия)';
  return text.length > 40 ? text.slice(0, 40) + '…' : text;
}
/** Текст главы без картинок и медиа, с сохранением абзацев. */
export function chapterToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  div
    .querySelectorAll('script, style, img, svg, picture, object, embed, iframe')
    .forEach(el => el.remove());
  div
    .querySelectorAll(
      'p, div, h1, h2, h3, h4, h5, h6, li, blockquote, section, article, pre, tr',
    )
    .forEach(el => el.appendChild(document.createTextNode('\n')));
  const text = div.textContent ?? '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
/** Для будущего использования в EPUB-парсере. */
export type ResourceMap = Map<string, BookResource>;