import type { BookChapter, BookMeta, BookResource, ParsedBook } from '../../types/book';
import { findAll, countChars, sanitizeHtml, fallbackTitle } from '../text';


const XLINK_NS = 'http://www.w3.org/1999/xlink';

// ---------- Декодирование байтов ----------

export function decodeFb2(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(200, bytes.length)));
  const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const enc = (m?.[1] ?? 'utf-8').toLowerCase();
  try {
    return new TextDecoder(enc).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

// ---------- Публичный парсер ----------

export function parseFb2(bytes: Uint8Array): ParsedBook {
  const xml = new DOMParser().parseFromString(decodeFb2(bytes), 'application/xml');
  const err = xml.querySelector('parsererror');
  if (err) throw new Error('FB2: ' + (err.textContent ?? '').slice(0, 300));

  const resources = extractBinaries(xml);
  const meta = extractFb2Meta(xml, resources);

  const chapters: BookChapter[] = [];
  let charStart = 0;
  const bodies = findAll(xml, 'body');

  for (const body of bodies) {
    // Пропускаем служебные тела: notes, comments и любые именованные.
    // Главное тело книги в FB2 всегда без атрибута name.
    if (body.getAttribute('name')) continue;

    const directSections = Array.from(body.children).filter(c => c.localName === 'section');
    const units: Element[] = directSections.length > 0 ? directSections : [body];

    for (const unit of units) {
      const container = document.createElement('div');
      appendFb2Node(unit, container, resources);

      const html = sanitizeHtml(container.innerHTML);
      const charCount = countChars(html);

      // Пустые секции (только title, только картинка, якорь) — не главы.
      if (charCount === 0) continue;

    const explicitTitle = extractFb2Title(unit);
        chapters.push({
        id: `fb2-${chapters.length}`,
        title: explicitTitle ?? fallbackTitle(html),
        titleIsFallback: !explicitTitle,
        html,
        charStart,
        charCount,
        });
      charStart += charCount;
    }
  }

  if (import.meta.env.DEV) {
    console.table(
      chapters.map((c, i) => ({
        '#': i + 1,
        title: c.title?.slice(0, 40),
        chars: c.charCount,
        start: c.charStart,
      })),
    );
  }

  return { meta, chapters, resources, totalChars: charStart };
}

// ---------- Извлечение ресурсов ----------

function extractBinaries(xml: XMLDocument): Map<string, BookResource> {
  const map = new Map<string, BookResource>();
  const binaries = findAll(xml, 'binary');
  for (const bin of binaries) {
    const id = bin.getAttribute('id');
    if (!id) continue;
    const mediaType = bin.getAttribute('content-type') ?? 'image/jpeg';
    const b64 = (bin.textContent ?? '').replace(/\s+/g, '');
    if (!b64) continue;
    map.set(id, {
      key: id,
      mediaType,
      url: `data:${mediaType};base64,${b64}`,
    });
  }
  return map;
}

// ---------- Мета ----------

function extractFb2Meta(xml: XMLDocument, res: Map<string, BookResource>): BookMeta {
  const ti = findAll(xml, 'title-info')[0];

  const title =
    ti?.getElementsByTagName('book-title')[0]?.textContent?.trim() || 'Без названия';

  const authors: string[] = [];
  const authorEls = ti ? findAll(ti, 'author') : [];
  for (const a of authorEls) {
    const fn = a.getElementsByTagName('first-name')[0]?.textContent ?? '';
    const mn = a.getElementsByTagName('middle-name')[0]?.textContent ?? '';
    const ln = a.getElementsByTagName('last-name')[0]?.textContent ?? '';
    const name = [fn, mn, ln].filter(Boolean).join(' ').trim();
    if (name) authors.push(name);
  }

  const lang = ti?.getElementsByTagName('lang')[0]?.textContent?.trim();
  const annotation = ti?.getElementsByTagName('annotation')[0]?.textContent?.trim() || undefined;

  let cover: string | undefined;
  const coverImg = ti?.getElementsByTagName('coverpage')[0]?.getElementsByTagName('image')[0];
  if (coverImg) {
    const href =
      coverImg.getAttributeNS(XLINK_NS, 'href') ??
      coverImg.getAttribute('l:href') ??
      coverImg.getAttribute('xlink:href');
    const id = href?.replace(/^#/, '');
    if (id) cover = res.get(id)?.url;
  }

  return { title, authors, language: lang, annotation, cover };
}

// ---------- Преобразование XML → HTML ----------

function appendFb2Node(
  node: Node,
  parent: HTMLElement,
  res: Map<string, BookResource>,
): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(child.textContent ?? ''));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as Element;
    const tag = el.localName.toLowerCase();

    // <binary> обрабатываются отдельно в extractBinaries
    if (tag === 'binary') continue;

    // <image> — подставляем data URL из resources
    if (tag === 'image') {
      const href =
        el.getAttributeNS(XLINK_NS, 'href') ??
        el.getAttribute('l:href') ??
        el.getAttribute('xlink:href');
      const id = href?.replace(/^#/, '');
      const r = id ? res.get(id) : undefined;
      if (r) {
        const img = document.createElement('img');
        img.src = r.url;
        img.alt = '';
        parent.appendChild(img);
      } else {
        const span = document.createElement('span');
        span.className = 'fb2-image-missing';
        span.textContent = '[изображение]';
        parent.appendChild(span);
      }
      continue;
    }

    const mapped = mapFb2Tag(tag);
    const out = document.createElement(mapped.tag);
    if (mapped.className) out.className = mapped.className;
    appendFb2Node(el, out, res);
    parent.appendChild(out);
  }
}

function mapFb2Tag(tag: string): { tag: string; className?: string } {
  switch (tag) {
    case 'title': return { tag: 'h2', className: 'fb2-title' };
    case 'subtitle': return { tag: 'h3', className: 'fb2-subtitle' };
    case 'empty-line': return { tag: 'div', className: 'fb2-empty-line' };
    case 'epigraph': return { tag: 'blockquote', className: 'fb2-epigraph' };
    case 'cite': return { tag: 'blockquote', className: 'fb2-cite' };
    case 'text-author': return { tag: 'div', className: 'fb2-text-author' };
    case 'poem': return { tag: 'div', className: 'fb2-poem' };
    case 'stanza': return { tag: 'div', className: 'fb2-stanza' };
    case 'v': return { tag: 'div', className: 'fb2-verse-line' };
    case 'section': return { tag: 'section', className: 'fb2-section' };
    case 'emphasis': return { tag: 'em' };
    case 'strong': return { tag: 'strong' };
    case 'strikethrough': return { tag: 's' };
    case 'sub': return { tag: 'sub' };
    case 'sup': return { tag: 'sup' };
    case 'code': return { tag: 'code' };
    case 'a': return { tag: 'span', className: 'fb2-link' };
    case 'date': return { tag: 'span', className: 'fb2-date' };
    default: return { tag };
  }
}

// ---------- Заголовок главы ----------

function extractFb2Title(section: Element): string | undefined {
  const titleEl = Array.from(section.children).find(c => c.localName === 'title');
  if (!titleEl) return undefined;
  const t = (titleEl.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t || undefined;
}