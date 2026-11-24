import { useCallback, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import JSZip from 'jszip';
import { parseFb2 } from '../lib/parsers/fb2';
import { parseEpub } from '../lib/parsers/epub';
import type { ParsedBook } from '../types/book';

export interface ZipEntry {
  name: string;
}

interface PendingZip {
  zip: JSZip;
  entries: ZipEntry[];
}

async function readBytes(path: string): Promise<Uint8Array> {
  const buf = await invoke<ArrayBuffer>('read_file_bytes', { path });
  return new Uint8Array(buf);
}

async function parseBookBytes(bytes: Uint8Array, filename: string): Promise<ParsedBook> {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'epub') return parseEpub(bytes);
  if (ext === 'fb2') return parseFb2(bytes);
  throw new Error(`Неизвестный формат: ${ext}`);
}

export function useBook() {
  const [book, setBook] = useState<ParsedBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingZip, setPendingZip] = useState<PendingZip | null>(null);

  const openBook = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const path = await open({
        multiple: false,
        filters: [
          { name: 'Книги и архивы', extensions: ['fb2', 'epub', 'zip'] },
          { name: 'FB2', extensions: ['fb2'] },
          { name: 'EPUB', extensions: ['epub'] },
          { name: 'ZIP', extensions: ['zip'] },
        ],
      });
      if (typeof path !== 'string') return;

      const u8 = await readBytes(path);
      const ext = path.split('.').pop()?.toLowerCase();

      if (ext === 'zip') {
        const zip = await JSZip.loadAsync(u8);
        const entries: ZipEntry[] = [];
        zip.forEach((relPath, file) => {
          if (file.dir) return;
          const lower = relPath.toLowerCase();
          if (lower.endsWith('.fb2') || lower.endsWith('.epub')) {
            entries.push({ name: relPath });
          }
        });
        entries.sort((a, b) => a.name.localeCompare(b.name));

        if (entries.length === 0) {
          throw new Error('В архиве нет файлов FB2 или EPUB');
        }
        if (entries.length === 1) {
          const data = await zip.file(entries[0].name)!.async('uint8array');
          const parsed = await parseBookBytes(data, entries[0].name);
          setBook(parsed);
        } else {
          setPendingZip({ zip, entries });
        }
      } else {
        const parsed = await parseBookBytes(u8, path);
        setBook(parsed);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const pickFromZip = useCallback(
    async (name: string) => {
      if (!pendingZip) return;
      setError(null);
      setLoading(true);
      try {
        const file = pendingZip.zip.file(name);
        if (!file) throw new Error(`Файл не найден в архиве: ${name}`);
        const data = await file.async('uint8array');
        const parsed = await parseBookBytes(data, name);
        setBook(parsed);
        setPendingZip(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [pendingZip],
  );

  const cancelZip = useCallback(() => setPendingZip(null), []);

  return {
    book,
    error,
    loading,
    openBook,
    pendingZipEntries: pendingZip ? pendingZip.entries : null,
    pickFromZip,
    cancelZip,
  };
}