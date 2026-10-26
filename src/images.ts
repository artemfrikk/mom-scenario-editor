// Pictures of tiles, monsters and items come from the player's own Valkyrie install
// (MoM/import/img). They belong to Fantasy Flight Games, so they are never uploaded or
// committed anywhere: the browser copies them into its own private storage (IndexedDB)
// once, and later visits load them from there without asking again.

import { clear, createStore, entries, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import catalog from './content/catalog.json';

export const IMPORT_PATH_HINT = '%APPDATA%\\Valkyrie\\MoM\\import\\img';

const store = createStore('mse-images', 'files');
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const MAX_DEPTH = 4;

export function imageKey(path: string | undefined): string {
  return (path ?? '').split(/[\\/]/).pop()!.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
}

// Only pictures the editor can actually show are copied, the rest of the folder is skipped.
const WANTED = new Set(
  [...catalog.tiles, ...catalog.monsters, ...catalog.items].map((x) => imageKey(x.image)).filter(Boolean),
);

type Status = 'unknown' | 'none' | 'loading' | 'ready';

interface ImagesState {
  status: Status;
  urls: Record<string, string>;
  count: number;
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
  async function finish(blobs: Map<string, Blob>) {
    if (blobs.size === 0) {
      set({
        status: 'none',
        error: 'В этой папке не нашлось картинок игры. Нужна папка img внутри MoM\\import.',
      });
      return;
    }
    try {
      await clear(store);
      await Promise.all([...blobs].map(([key, blob]) => idbSet(key, blob, store)));
      void navigator.storage?.persist?.();
    } catch {
      // Storage may be full or blocked; the pictures still work until the tab is closed.
    }
    set({ status: 'ready', urls: toUrls(blobs, get().urls), count: blobs.size, error: '', found: blobs.size });
  }

  return {
    status: 'unknown',
    urls: {},
    count: 0,
    found: 0,
    error: '',

    restore: async () => {
      try {
        const saved = await entries<string, Blob>(store);
        if (saved.length === 0) {
          set({ status: 'none' });
          return;
        }
        set({ status: 'ready', urls: toUrls(new Map(saved), get().urls), count: saved.length });
      } catch {
        set({ status: 'none' });
      }
    },

    fromHandle: async (root) => {
      set({ status: 'loading', error: '', found: 0 });
      const blobs = new Map<string, Blob>();
      async function walk(dir: FileSystemDirectoryHandle, depth: number) {
        for await (const entry of dir.values()) {
          if (entry.kind === 'directory') {
            if (depth < MAX_DEPTH) await walk(entry as FileSystemDirectoryHandle, depth + 1);
          } else if (IMAGE_EXT.test(entry.name)) {
            const key = imageKey(entry.name);
            if (!WANTED.has(key) || blobs.has(key)) continue;
            blobs.set(key, await (entry as FileSystemFileHandle).getFile());
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
      await finish(blobs);
    },

    fromFiles: async (files) => {
      set({ status: 'loading', error: '', found: 0 });
      const blobs = new Map<string, Blob>();
      for (const f of Array.from(files)) {
        if (!IMAGE_EXT.test(f.name)) continue;
        const key = imageKey(f.name);
        if (WANTED.has(key) && !blobs.has(key)) blobs.set(key, f);
      }
      await finish(blobs);
    },

    forget: async () => {
      await clear(store).catch(() => {});
      set({ status: 'none', urls: toUrls(new Map(), get().urls), count: 0, error: '' });
    },
  };
});

export const canPickFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// Opens the browser's folder dialog. Returns false when the user cancelled or the browser refused.
export async function pickFolder(): Promise<boolean> {
  const w = window as unknown as {
    showDirectoryPicker: (o?: { id?: string; mode?: string }) => Promise<FileSystemDirectoryHandle>;
  };
  try {
    const dir = await w.showDirectoryPicker({ id: 'valkyrie-img', mode: 'read' });
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
