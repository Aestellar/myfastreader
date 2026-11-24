export interface Fb2Meta {
  title: string;
  authors: string[];
  annotation?: string;
  coverId?: string;
}

export interface Fb2Book {
  meta: Fb2Meta;
  xml: XMLDocument;
  images: Map<string, string>; // id -> data URL
}

const XLINK_NS = 'http://www.w3.org/1999/xlink';

export function xlinkHref(el: Element): string | null {
  return (
    el.getAttributeNS(XLINK_NS, 'href') ??
    el.getAttribute('l:href') ??
    el.getAttribute('xlink:href')
  );
}

/** Декодирует байты FB2 в строку, учитывая BOM и XML-декларацию. */
export function decodeFb2(bytes: Uint8Array): string {
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  // UTF-16 BOM
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  // Смотрим XML-декларацию
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(200, bytes.length)));
  const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const enc = (m?.[1] ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function parseFb2(text: string): Fb2Book {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  const err = xml.querySelector('parsererror');
  if (err) throw new Error('FB2: ошибка разбора XML — ' + (err.textContent ?? '').slice(0, 300));

  return {
    xml,
    images: extractImages(xml),
    meta: extractMeta(xml),
  };
}

function extractImages(xml: XMLDocument): Map<string, string> {
  const map = new Map<string, string>();
  const binaries = xml.getElementsByTagName('binary');
  for (let i = 0; i < binaries.length; i++) {
    const bin = binaries[i];
    const id = bin.getAttribute('id');
    const ct = bin.getAttribute('content-type') ?? 'image/jpeg';
    if (!id) continue;
    const b64 = (bin.textContent ?? '').replace(/\s+/g, '');
    if (!b64) continue;
    map.set(id, `data:${ct};base64,${b64}`);
  }
  return map;
}

function extractMeta(xml: XMLDocument): Fb2Meta {
  const ti = xml.getElementsByTagName('title-info')[0];
  const title = ti?.getElementsByTagName('book-title')[0]?.textContent?.trim() || 'Без названия';

  const authors: string[] = [];
  const authorEls = ti?.getElementsByTagName('author') ?? [];
  for (let i = 0; i < authorEls.length; i++) {
    const a = authorEls[i];
    const fn = a.getElementsByTagName('first-name')[0]?.textContent ?? '';
    const mn = a.getElementsByTagName('middle-name')[0]?.textContent ?? '';
    const ln = a.getElementsByTagName('last-name')[0]?.textContent ?? '';
    const name = [fn, mn, ln].filter(Boolean).join(' ').trim();
    if (name) authors.push(name);
  }

  const annotation = ti?.getElementsByTagName('annotation')[0]?.textContent?.trim() || undefined;

  let coverId: string | undefined;
  const coverImg = ti
    ?.getElementsByTagName('coverpage')[0]
    ?.getElementsByTagName('image')[0];
  if (coverImg) {
    const href = xlinkHref(coverImg);
    if (href) coverId = href.replace(/^#/, '');
  }

  return { title, authors, annotation, coverId };
}