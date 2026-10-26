// Pictures of tiles, monsters and items come from the player's own Valkyrie install
// (MoM/import/img). They belong to Fantasy Flight Games, so they are never uploaded or
// committed anywhere: the browser copies them into its own private storage (IndexedDB)
// once, and later visits load them from there without asking again.

import { clear, createStore, entries, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import catalog from './content/catalog.json';
import { ddsToPng } from './dds';
import { parseLocalization } from './format/localization';

const ROOT_KEY = 'mse-valkyrie-root';
const DEFAULT_ROOT = '%APPDATA%\\Valkyrie';

// Valkyrie keeps its data in %APPDATA%\\Valkyrie unless the person picked another root folder.
export const valkyrieRoot = (() => {
  try {
    return localStorage.getItem(ROOT_KEY) || DEFAULT_ROOT;
  } catch {
    return DEFAULT_ROOT;
  }
})();

export function importPath(root: string): string {
  const clean = root.trim().replace(/[\\/]+$/, '') || DEFAULT_ROOT;
  try {
    localStorage.setItem(ROOT_KEY, clean);
  } catch {
    // remembering is optional
  }
  return clean + '\\MoM\\import';
}

const store = createStore('mse-images', 'files');
const namesStore = createStore('mse-names', 'files');
// Valkyrie's own import keeps the official texts in text/Localization_<Language>.txt (digits in the name mean other files).
const TEXT_FILE = /^Localization[^\d]*\.txt$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|dds)$/i;
const MAX_DEPTH = 4;

export function imageKey(path: string | undefined): string {
  return (path ?? '').split(/[\\/]/).pop()!.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

// Valkyrie's own pictures are .dds, which a browser cannot show: they are turned into PNG on the way in.
async function readable(name: string, file: Blob): Promise<Blob | null> {
  return /\.dds$/i.test(name) ? ddsToPng(file) : file;
}

// Only pictures the editor can actually show are copied, the rest of the folder is skipped.
const WANTED = new Set(
  [...catalog.tiles, ...catalog.monsters, ...catalog.items, ...catalog.tokens].map((x) => imageKey((x as { image?: string }).image)).filter(Boolean),
);

const WANTED_KEYS = new Set([...catalog.tiles, ...catalog.monsters, ...catalog.items].map((x) => x.nameKey).filter(Boolean) as string[]);

// language -> official key -> text, only for keys the catalog uses
type Names = Record<string, Record<string, string>>;

function pickNames(text: string): { language: string; names: Record<string, string> } | null {
  const file = parseLocalization(text);
  const names: Record<string, string> = {};
  for (const [k, v] of file.entries) if (WANTED_KEYS.has(k)) names[k] = v;
  return Object.keys(names).length ? { language: file.language, names } : null;
}

type Status = 'unknown' | 'none' | 'loading' | 'ready';

interface ImagesState {
  status: Status;
  urls: Record<string, string>;
  count: number;
  names: Names;
  found: number; // pictures seen while scanning, for the progress line
  error: string;
  restore: () => Promise<void>;
  fromHandle: (dir: FileSystemDirectoryHandle) => Promise<void>;
  fromFiles: (files: FileList | File[]) => Promise<void>;
  forget: () => Promise<void>;
}

function toUrls(blobs: Map<string, Blob>, previous: Record<string, string>): Record<string, string> {
  for (const url of Object.values(previous)) URL.revokeObjectURL(url);
  const urls: Record<string, string> = {};
  for (const [key, blob] of blobs) urls[key] = URL.createObjectURL(blob);
  return urls;
}

export const useImages = create<ImagesState>((set, get) => {
  async function finish(blobs: Map<string, Blob>, names: Names = {}) {
    if (blobs.size === 0 && Object.keys(get().urls).length > 0) {
      set({ status: 'ready', error: 'В этой папке не нашлось новых картинок игры.' });
      return;
    }
    if (blobs.size === 0) {
      set({
        status: 'none',
        error: 'В этой папке не нашлось картинок игры. Нужна папка import внутри MoM.',
      });
      return;
    }
    try {
      // New pictures are added to the ones already kept, so the program's own icons and the import folder can be connected one after another.
      await Promise.all([...blobs].map(([key, blob]) => idbSet(key, blob, store)));
      await Promise.all(Object.entries(names).map(([lang, map]) => idbSet(lang, { ...(get().names[lang] ?? {}), ...map }, namesStore)));
      void navigator.storage?.persist?.();
    } catch {
      // Storage may be full or blocked; the pictures still work until the tab is closed.
    }
    const all = new Map<string, Blob>();
    try {
      for (const [k, b] of await entries<string, Blob>(store)) all.set(k, b);
    } catch {
      // storage blocked: only what was just read
    }
    for (const [k, b] of blobs) all.set(k, b);
    const merged: Names = { ...get().names };
    for (const [lang, map] of Object.entries(names)) merged[lang] = { ...merged[lang], ...map };
    set({ status: 'ready', urls: toUrls(all, get().urls), count: all.size, names: merged, error: '', found: blobs.size });
  }

  return {
    status: 'unknown',
    urls: {},
    count: 0,
    names: {},
    found: 0,
    error: '',

    restore: async () => {
      try {
        const saved = await entries<string, Blob>(store);
        if (saved.length === 0) {
          set({ status: 'none' });
          return;
        }
        const names: Names = Object.fromEntries(await entries<string, Record<string, string>>(namesStore));
        set({ status: 'ready', urls: toUrls(new Map(saved), get().urls), count: saved.length, names });
      } catch {
        set({ status: 'none' });
      }
    },

    fromHandle: async (root) => {
      set({ status: 'loading', error: '', found: 0 });
      const blobs = new Map<string, Blob>();
      const names: Names = {};
      async function walk(dir: FileSystemDirectoryHandle, depth: number) {
        for await (const entry of dir.values()) {
          if (entry.kind === 'directory') {
            if (depth < MAX_DEPTH) await walk(entry as FileSystemDirectoryHandle, depth + 1);
          } else if (TEXT_FILE.test(entry.name)) {
            const found = pickNames(await (await (entry as FileSystemFileHandle).getFile()).text());
            if (found) names[found.language] = { ...names[found.language], ...found.names };
          } else if (IMAGE_EXT.test(entry.name)) {
            const key = imageKey(entry.name);
            if (!WANTED.has(key) || blobs.has(key)) continue;
            const blob = await readable(entry.name, await (entry as FileSystemFileHandle).getFile());
            if (!blob) continue;
            blobs.set(key, blob);
            set({ found: blobs.size });
          }
        }
      }
      try {
        await walk(root, 0);
      } catch (e) {
        set({ status: 'none', error: 'Не удалось прочитать папку: ' + (e as Error).message });
        return;
      }
      await finish(blobs, names);
    },

    fromFiles: async (files) => {
      set({ status: 'loading', error: '', found: 0 });
      const blobs = new Map<string, Blob>();
      const names: Names = {};
      for (const f of Array.from(files)) {
        if (TEXT_FILE.test(f.name)) {
          const found = pickNames(await f.text());
          if (found) names[found.language] = { ...names[found.language], ...found.names };
          continue;
        }
        if (!IMAGE_EXT.test(f.name)) continue;
        const key = imageKey(f.name);
        if (!WANTED.has(key) || blobs.has(key)) continue;
        const blob = await readable(f.name, f);
        if (blob) blobs.set(key, blob);
        set({ found: blobs.size });
      }
      await finish(blobs, names);
    },

    forget: async () => {
      await clear(store).catch(() => {});
      await clear(namesStore).catch(() => {});
      set({ status: 'none', urls: toUrls(new Map(), get().urls), count: 0, names: {}, error: '' });
    },
  };
});

export const canPickFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// Opens the browser's folder dialog. Returns false when the user cancelled or the browser refused.
export async function pickFolder(id = 'valkyrie-img'): Promise<boolean> {
  const w = window as unknown as {
    showDirectoryPicker: (o?: { id?: string; mode?: string }) => Promise<FileSystemDirectoryHandle>;
  };
  try {
    const dir = await w.showDirectoryPicker({ id, mode: 'read' });
    await useImages.getState().fromHandle(dir);
    return true;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return false;
    useImages.setState({
      status: 'none',
      error:
        'Браузер не разрешил открыть эту папку (Chrome закрывает служебные папки вроде AppData). Нажмите «Выбрать другим способом» ниже.',
    });
    return false;
  }
}

export function imageUrl(urls: Record<string, string>, path: string | undefined): string | undefined {
  return urls[imageKey(path)];
}

// The official name of a tile, monster or item in the editor's language, when the player's import has it.
export function localName(names: Names, key: string | undefined, language = 'Russian'): string | undefined {
  return key ? names[language]?.[key] : undefined;
}
