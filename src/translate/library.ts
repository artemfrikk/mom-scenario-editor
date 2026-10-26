// The list of scenarios in Valkyrie's Download folder. In Chrome and Edge the folder is chosen once and remembered
// (the same folder the editor saves to), and translated files are written straight back into it.
// Other browsers can still read the folder through a folder picker, but the result has to be downloaded.

import { get } from 'idb-keyval';
import { create } from 'zustand';
import { canSaveToFolder, chooseFolder, savedFolder, writeToFolder } from '../folderSave';
import { openPackage } from './package';
import { workKey, type Translations } from './store';
import { needsNoTranslation } from './tokens';

export interface ScenarioInfo {
  fileName: string;
  title: string;
  languages: string[];
  file: File;
  // texts in the original language that need translating, and how many of them already have a translation
  total: number;
  translated: number;
  // the translation exists in the file itself (not just started in the browser)
  inFile: boolean;
  error?: string;
}

interface Handle extends FileSystemDirectoryHandle {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
}

interface LibraryState {
  dir?: FileSystemDirectoryHandle;
  // the folder is remembered, but the browser wants a click before reading it again
  needsPermission: boolean;
  items: ScenarioInfo[];
  loading: boolean;
  scanned: boolean;
  restore(): Promise<void>;
  choose(): Promise<void>;
  allow(): Promise<void>;
  fromFiles(files: FileList | File[]): Promise<void>;
  rescan(): Promise<void>;
  refreshOne(fileName: string, file?: File): Promise<void>;
  // Writes a finished file back into the folder. Returns false when there is no folder to write to.
  write(fileName: string, blob: Blob): Promise<boolean>;
}

export const canUseFolder = canSaveToFolder;

export async function describe(file: File, target = 'Russian'): Promise<ScenarioInfo> {
  try {
    const pkg = await openPackage(file, file.name);
    const languages = Object.keys(pkg.texts);
    const source = languages.find((l) => l !== target && l === pkg.defaultLanguage) ?? languages.find((l) => l !== target) ?? languages[0];
    const title = pkg.texts[target]?.get('quest.name') || pkg.texts[source]?.get('quest.name') || file.name.replace(/\.valkyrie$/i, '');
    const keys = [...(pkg.texts[source] ?? new Map<string, string>())].filter(([, v]) => !needsNoTranslation(v)).map(([k]) => k);
    const saved = (await get<Translations>(workKey(file.name, source, target)).catch(() => undefined)) ?? {};
    const old = pkg.texts[target];
    const translated = keys.filter((k) => (saved[k]?.text ?? old?.get(k) ?? '').trim()).length;
    return { fileName: file.name, title, languages, file, total: keys.length, translated, inFile: !!old };
  } catch (e) {
    return { fileName: file.name, title: file.name, languages: [], file, total: 0, translated: 0, inFile: false, error: (e as Error).message };
  }
}

async function listFolder(dir: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  for await (const h of dir.values()) {
    if (h.kind === 'file' && h.name.toLowerCase().endsWith('.valkyrie')) files.push(await (h as FileSystemFileHandle).getFile());
  }
  return files;
}

// One file at a time: scenarios with music can weigh tens of megabytes. The list fills in as it goes.
async function scanFiles(files: File[]) {
  useLibrary.setState({ items: [], loading: true, scanned: true });
  for (const f of files) {
    const info = await describe(f);
    useLibrary.setState((st) => ({ items: [...st.items, info].sort(byTitle) }));
  }
  useLibrary.setState({ loading: false });
}

const byTitle = (a: ScenarioInfo, b: ScenarioInfo) => a.title.localeCompare(b.title, 'ru');

export const useLibrary = create<LibraryState>((set, get) => ({
  needsPermission: false,
  items: [],
  loading: false,
  scanned: false,

  async restore() {
    if (!canUseFolder()) return;
    const dir = (await savedFolder()) as Handle | undefined;
    if (!dir) return;
    const state = await dir.queryPermission?.({ mode: 'readwrite' }).catch(() => 'prompt' as PermissionState);
    set({ dir, needsPermission: state !== 'granted' });
    if (state === 'granted') await get().rescan();
  },

  async choose() {
    const dir = await chooseFolder();
    if (!dir) return;
    set({ dir, needsPermission: false });
    await get().rescan();
  },

  async allow() {
    const dir = get().dir as Handle | undefined;
    if (!dir) return get().choose();
    if ((await dir.requestPermission?.({ mode: 'readwrite' })) !== 'granted') return;
    set({ needsPermission: false });
    await get().rescan();
  },

  async fromFiles(list) {
    set({ dir: undefined });
    await scanFiles([...list].filter((f) => f.name.toLowerCase().endsWith('.valkyrie')));
  },

  async rescan() {
    const dir = get().dir;
    if (!dir) return;
    set({ loading: true });
    try {
      await scanFiles(await listFolder(dir));
    } finally {
      set({ loading: false });
    }
  },

  async refreshOne(fileName, file) {
    const dir = get().dir;
    const f = file ?? (dir ? await (await dir.getFileHandle(fileName)).getFile() : get().items.find((i) => i.fileName === fileName)?.file);
    if (!f) return;
    const info = await describe(f);
    set((st) => ({ items: st.items.map((i) => (i.fileName === fileName ? info : i)) }));
  },

  async write(fileName, blob) {
    const dir = get().dir;
    if (!dir) return false;
    return writeToFolder(dir, fileName, blob);
  },
}));
