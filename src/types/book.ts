export interface BookMeta {
  title: string;
  authors: string[];
  language?: string;
  annotation?: string;
  cover?: string;
}

export interface BookResource {
  key: string;
  mediaType: string;
  url: string;
}

export interface BookChapter {
  id: string;
  title?: string;
  titleIsFallback?: boolean;   // NEW
  html: string;
  charStart: number;
  charCount: number;
}

export interface Bookmark {        // NEW
  id: string;
  charOffset: number;
  chapterIndex: number;
  label: string;
  createdAt: number;
}

export interface ParsedBook {
  meta: BookMeta;
  chapters: BookChapter[];
  resources: Map<string, BookResource>;
  totalChars: number;
  formatData?: Record<string, unknown>;
}