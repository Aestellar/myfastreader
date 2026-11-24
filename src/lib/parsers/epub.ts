import JSZip from 'jszip';
import type { BookChapter, BookMeta, BookResource, ParsedBook } from '../../types/book';
import { findAll, countChars, sanitizeHtml, fallbackTitle } from '../text';

const XLINK_NS = 'http://www.w3.org/1999/xlink';
const OPS_NS = 'http://www.idpf.org/2007/ops';
const CONTAINER_PATH = 'META-INF/container.xml';

// ---------- Публичный парсер ----------

export async function parseEpub(bytes: Uint8Array): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(bytes);

  const containerFile = zip.file(CONTAINER_PATH);
  if (!containerFile) throw new Error('EPUB: отсутствует META-INF/container.xml');
  const containerXml = parseXml(await containerFile.async('string'));
  const rootfilePath = findAll(containerXml, 'rootfile')[0]?.getAttribute('full-path');
  if (!rootfilePath) throw new Error('EPUB: в container.xml не указан rootfile');

  const opfFile = zip.file(rootfilePath);
  if (!opfFile) throw new Error(`EPUB: не найден OPF по пути ${rootfilePath}`);
  const opfXml = parseXml(await opfFile.async('string'));
  const opfDir = dirname(rootfilePath);

  const resources = await extractEpubResources(zip, opfXml, opfDir);
  const meta = extractEpubMeta(opfXml, resources, opfDir);
  const { chapters, totalChars } = await buildEpubChapters(zip, opfXml, opfDir, resources);

  return { meta, chapters, resources, totalChars };
}

// ---------- Утилиты ----------

function parseXml(text: string): Document {
  let doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    // Fallback на HTML-парсер — некоторые EPUB не являются строгим XHTML.
    doc = new DOMParser().parseFromString(text, 'text/html');
  }
  return doc;
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : '';
}

/** Безопасное разрешение относительного пути внутри EPUB-контейнера. */
function resolvePath(baseDir: string, href: string): string {
  let cleanHref = href.split('#')[0];
  try {
    cleanHref = decodeURIComponent(cleanHref);
  } catch {
    /* ignore malformed URLs */
  }

  const segments = (baseDir ? baseDir + '/' : '') + cleanHref;
  const parts: string[] = [];
  for (const seg of segments.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) {
        throw new Error(`EPUB: путь выходит за пределы контейнера: ${href}`);
      }
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join('/');
}

// ---------- Ресурсы ----------

function guessMime(href: string): string {
  const e = href.split('.').pop()?.toLowerCase() ?? '';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'png') return 'image/png';
  if (e === 'gif') return 'image/gif';
  if (e === 'svg') return 'image/svg+xml';
  if (e === 'webp') return 'image/webp';
  if (e === 'bmp') return 'image/bmp';
  return 'application/octet-stream';
}

async function extractEpubResources(
  zip: JSZip,
  opf: Document,
  opfDir: string,
): Promise<Map<string, BookResource>> {
  const map = new Map<string, BookResource>();
  const items = findAll(opf, 'item');
  const seen = new Set<string>();

  if (import.meta.env.DEV) {
    console.log('[epub:resources] items in OPF:', items.length);
  }

  const zipLower = new Map<string, string>();
  for (const k of Object.keys(zip.files)) zipLower.set(k.toLowerCase(), k);

  for (const item of items) {
    const href = item.getAttribute('href');
    if (!href || seen.has(href)) continue;
    seen.add(href);

    const mt = (item.getAttribute('media-type') ?? '').trim();
    const mtLower = mt.toLowerCase();
    const isImageByType = mtLower.startsWith('image/');
    const isImageByExt = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?)$/i.test(href);
    if (!isImageByType && !isImageByExt) continue;

    let path: string;
    try {
      path = resolvePath(opfDir, href);
    } catch {
      continue;
    }

    let file = zip.file(path);
    if (!file) {
      const alt = zipLower.get(path.toLowerCase());
      if (alt) file = zip.file(alt);
    }
    if (!file) {
      console.warn('[epub] файл не найден в ZIP:', path, '(href:', href, ')');
      continue;
    }

    const mime = mt || guessMime(href);
    const b64 = await file.async('base64');
    map.set(path, {
      key: path,
      mediaType: mime,
      url: `data:${mime};base64,${b64}`,
    });
  }

  if (import.meta.env.DEV) {
    console.log('[epub:resources] image resources:', map.size);
  }
  return map;
}
// ---------- Мета ----------

function extractEpubMeta(
  opf: Document,
  resources: Map<string, BookResource>,
  opfDir: string,
): BookMeta {
  const title =
    (findAll(opf, 'title')[0]?.textContent ?? '').trim() || 'Без названия';

  const authors: string[] = [];
  for (const el of findAll(opf, 'creator')) {
    const name = (el.textContent ?? '').trim();
    if (name) authors.push(name);
  }

  const language = (findAll(opf, 'language')[0]?.textContent ?? '').trim() || undefined;
  const description = (findAll(opf, 'description')[0]?.textContent ?? '').trim() || undefined;

  // Поиск обложки: EPUB2 <meta name="cover">, EPUB3 <item properties="cover-image">
  let coverId: string | undefined;
  for (const m of findAll(opf, 'meta')) {
    if (m.getAttribute('name') === 'cover') {
      coverId = m.getAttribute('content') ?? undefined;
      break;
    }
  }

  let coverItem: Element | undefined;
  const items = findAll(opf, 'item');

  if (coverId) {
    coverItem = items.find(it => it.getAttribute('id') === coverId);
  }
  if (!coverItem) {
    coverItem = items.find(it => (it.getAttribute('properties') ?? '').includes('cover-image'));
  }
  if (!coverItem) {
    // EPUB2 <guide><reference type="cover" href="..."/>
    const ref = findAll(opf, 'reference').find(r => r.getAttribute('type') === 'cover');
    const href = ref?.getAttribute('href');
    if (href) {
      const path = resolvePath(opfDir, href);
      coverItem = items.find(it => {
        const ih = it.getAttribute('href');
        return ih ? resolvePath(opfDir, ih) === path : false;
      });
    }
  }

  let cover: string | undefined;
  if (coverItem) {
    const href = coverItem.getAttribute('href');
    if (href) {
      const path = resolvePath(opfDir, href);
      cover = resources.get(path)?.url;
    }
  }

  return { title, authors, language, annotation: description, cover };
}

// ---------- Оглавление ----------

async function parseEpubToc(
  zip: JSZip,
  opf: Document,
  opfDir: string,
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const items = findAll(opf, 'item');

  // EPUB3: <item properties="nav" href="nav.xhtml">
  const navItem = items.find(it => (it.getAttribute('properties') ?? '').includes('nav'));
  const navHref = navItem?.getAttribute('href');
  if (navHref) {
    const navPath = resolvePath(opfDir, navHref);
    const navFile = zip.file(navPath);
    if (navFile) {
      const navDoc = parseXml(await navFile.async('string'));
      const navDir = dirname(navPath);
      const navs = findAll(navDoc, 'nav');
      const tocNav =
        navs.find(n => n.getAttributeNS(OPS_NS, 'type') === 'toc') ??
        navs.find(n => n.getAttribute('type') === 'toc') ??
        navs[0];

      if (tocNav) {
        tocNav.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href');
          const text = (a.textContent ?? '').replace(/\s+/g, ' ').trim();
          if (!href || !text) return;
          const target = resolvePath(navDir, href);
          if (!titles.has(target)) titles.set(target, text);
        });
      }
    }
  }

  // EPUB2: toc.ncx
  if (titles.size === 0) {
    const ncxItem = items.find(
      it => it.getAttribute('media-type') === 'application/x-dtbncx+xml',
    );
    const ncxHref = ncxItem?.getAttribute('href');
    if (ncxHref) {
      const ncxPath = resolvePath(opfDir, ncxHref);
      const ncxFile = zip.file(ncxPath);
      if (ncxFile) {
        const ncxDoc = parseXml(await ncxFile.async('string'));
        const ncxDir = dirname(ncxPath);
        for (const np of findAll(ncxDoc, 'navPoint')) {
          const label = findAll(np, 'text')[0]?.textContent?.trim();
          const src = findAll(np, 'content')[0]?.getAttribute('src');
          if (!label || !src) continue;
          const target = resolvePath(ncxDir, src);
          if (!titles.has(target)) titles.set(target, label);
        }
      }
    }
  }

  return titles;
}

// ---------- Главы ----------

async function buildEpubChapters(
  zip: JSZip,
  opf: Document,
  opfDir: string,
  resources: Map<string, BookResource>,
): Promise<{ chapters: BookChapter[]; totalChars: number }> {
  const tocTitles = await parseEpubToc(zip, opf, opfDir);

  const items = findAll(opf, 'item');
  const manifest = new Map<string, { href: string; mediaType: string }>();
  for (const it of items) {
    const id = it.getAttribute('id');
    const href = it.getAttribute('href');
    if (id && href) manifest.set(id, { href, mediaType: it.getAttribute('media-type') ?? '' });
  }

  const navItem = items.find(it => (it.getAttribute('properties') ?? '').includes('nav'));
  const navPath = navItem?.getAttribute('href')
    ? resolvePath(opfDir, navItem.getAttribute('href')!)
    : null;

  const spineEl = findAll(opf, 'spine')[0];
  if (!spineEl) throw new Error('EPUB: в OPF отсутствует spine');
  const itemrefs = findAll(spineEl, 'itemref');

  type Parsed = {
    id: string;
    title: string;
    titleIsFallback: boolean;
    html: string;
    charCount: number;
    hasImage: boolean;
  };

  const parsed: Parsed[] = [];
  let illustrationCounter = 0;

  for (const ref of itemrefs) {
    if (ref.getAttribute('linear') === 'no') continue;
    const idref = ref.getAttribute('idref');
    if (!idref) continue;
    const man = manifest.get(idref);
    if (!man) continue;
    if (!man.mediaType.includes('xhtml') && !man.mediaType.includes('html')) continue;

    const path = resolvePath(opfDir, man.href);
    if (navPath && path === navPath) continue;

    const file = zip.file(path);
    if (!file) {
      console.warn('[epub] глава не найдена в ZIP:', path);
      continue;
    }

    const rawHtml = await file.async('string');
    const cleaned = await prepareEpubChapterHtml(rawHtml, path, resources);
      if (import.meta.env.DEV && parsed.length < 3) {
      console.log('[epub:diag]', path, {
        rawLen: rawHtml.length,
        rawHead: rawHtml.slice(0, 200),
        cleanedLen: cleaned.length,
        cleanedHead: cleaned.slice(0, 200),
      });
    }
    const html = sanitizeHtml(cleaned);
    const charCount = countChars(html);
    const hasImage = /<(?:img|image|object|embed)[\s>/]/i.test(cleaned);

    let title = tocTitles.get(path);
    let titleIsFallback = false;

    if (!title) {
      if (charCount === 0 && hasImage) {
        illustrationCounter++;
        title = `Иллюстрация ${illustrationCounter}`;
      } else {
        const div = document.createElement('div');
        div.innerHTML = html;
        const heading = div.querySelector('h1, h2, h3')?.textContent?.trim();
        title = heading || fallbackTitle(html);
        titleIsFallback = !heading;
      }
    }

    parsed.push({ id: idref, title, titleIsFallback, html, charCount, hasImage });
  }

  // Основной фильтр: текст или картинка
  let chapters: BookChapter[] = [];
  let charStart = 0;
  for (const p of parsed) {
    if (p.charCount === 0 && !p.hasImage) continue;
    chapters.push({
      id: p.id,
      title: p.title,
      titleIsFallback: p.titleIsFallback,
      html: p.html,
      charStart,
      charCount: p.charCount,
    });
    charStart += p.charCount;
  }

  // Fallback: если всё отфильтровано — включаем всё, чтобы книга открылась
  if (chapters.length === 0 && parsed.length > 0) {
    console.warn('[epub] все главы отфильтрованы, включаю все для открытия книги');
    charStart = 0;
    chapters = parsed.map(p => {
      const ch: BookChapter = {
        id: p.id,
        title: p.title,
        titleIsFallback: p.titleIsFallback,
        html: p.html,
        charStart,
        charCount: p.charCount,
      };
      charStart += p.charCount;
      return ch;
    });
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

  return { chapters, totalChars: charStart };
}

// ---------- Подготовка HTML главы ----------

async function prepareEpubChapterHtml(
  xhtml: string,
  chapterPath: string,
  resources: Map<string, BookResource>,
): Promise<string> {
  const chapterDir = dirname(chapterPath);

  // Попытка 1: HTML с препроцессингом
  let clean = xhtml.replace(/<\?xml[^>]*\?>/i, '');
  clean = clean.replace(/<(title|script|style|textarea)\s*\/>/gi, '<$1></$1>');

  let doc = new DOMParser().parseFromString(clean, 'text/html');
  let bodyHTML = doc.body?.innerHTML?.trim() ?? '';

  // Попытка 2: если HTML съел тело — берём через XML
  if (!bodyHTML) {
    const xd = new DOMParser().parseFromString(xhtml, 'application/xml');
    if (!xd.querySelector('parsererror')) {
      const xmlBody =
        xd.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'body')[0] ??
        xd.getElementsByTagName('body')[0];
      if (xmlBody) {
        const serializer = new XMLSerializer();
        let s = '';
        for (const child of Array.from(xmlBody.childNodes)) {
          s += serializer.serializeToString(child);
        }
        bodyHTML = s;
        doc = new DOMParser().parseFromString(
          `<html><body>${bodyHTML}</body></html>`,
          'text/html',
        );
      }
    }
  }

  if (!bodyHTML) {
    if (import.meta.env.DEV) {
      console.warn('[epub] не удалось извлечь тело:', chapterPath);
    }
    return '';
  }

  // Обработка картинок на итоговом HTML-документе
  const all: Element[] = [];
  const walker = doc.createTreeWalker(
    doc.body ?? doc.documentElement,
    NodeFilter.SHOW_ELEMENT,
  );
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const el = n as Element;
    const ln = el.localName?.toLowerCase() ?? '';
    if (ln === 'img' || ln === 'image' || ln === 'object' || ln === 'embed') all.push(el);
  }

  if (import.meta.env.DEV) {
    console.log('[epub:chapter]', chapterPath, 'imgs found:', all.length);
  }

  for (const img of all) {
    const src =
      img.getAttribute('src') ??
      img.getAttribute('href') ??
      img.getAttribute('data') ??
      img.getAttributeNS(XLINK_NS, 'href') ??
      img.getAttribute('xlink:href');
    if (!src) continue;
    if (src.startsWith('data:') || src.startsWith('blob:')) continue;

    const resolved = resolvePath(chapterDir, src);
    const res = resources.get(resolved);

    if (res) {
      const ln = img.localName.toLowerCase();
      if (ln === 'image') {
        img.setAttribute('href', res.url);
        img.setAttributeNS(XLINK_NS, 'xlink:href', res.url);
      } else if (ln === 'object') {
        img.setAttribute('data', res.url);
      } else {
        img.setAttribute('src', res.url);
      }
    } else if (import.meta.env.DEV) {
      console.warn('[epub] изображение не найдено:', { src, resolved, chapterPath });
    }
  }

  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const href = a.getAttribute('href');
    if (!href) continue;
    if (href.startsWith('#') || /^(https?:|mailto:)/.test(href)) continue;
    a.setAttribute('data-epub-href', href);
    a.removeAttribute('href');
  }

  return doc.body?.innerHTML ?? bodyHTML;
}