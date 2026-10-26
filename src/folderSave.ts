// Saving straight into a folder of the person's choice (for example the one Valkyrie reads scenarios from).
// Chrome and Edge only; the folder handle is remembered in the browser, so the choice is made once.

import { del, get, set } from 'idb-keyval';

const KEY = 'mse-save-folder';

interface Handle extends FileSystemDirectoryHandle {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
}

export const canSaveToFolder = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function savedFolder(): Promise<FileSystemDirectoryHandle | undefined> {
  try {
    return await get<FileSystemDirectoryHandle>(KEY);
  } catch {
    return undefined;
  }
}

export async function forgetFolder(): Promise<void> {
  await del(KEY).catch(() => {});
}

// Returns null when the person cancels the dialog.
export async function chooseFolder(): Promise<FileSystemDirectoryHandle | null> {
  const w = window as unknown as { showDirectoryPicker: (o?: { id?: string; mode?: string }) => Promise<FileSystemDirectoryHandle> };
  try {
    const dir = await w.showDirectoryPicker({ id: 'valkyrie-quests', mode: 'readwrite' });
    await set(KEY, dir).catch(() => {});
    return dir;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null;
    throw e;
  }
}

// Must run inside a click: the browser may ask the person to allow writing again after a restart.
export async function writeToFolder(dir: FileSystemDirectoryHandle, name: string, blob: Blob): Promise<boolean> {
  const h = dir as Handle;
  if ((await h.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
    if ((await h.requestPermission?.({ mode: 'readwrite' })) !== 'granted') return false;
  }
  const file = await dir.getFileHandle(name, { create: true });
  const w = await file.createWritable();
  await w.write(blob);
  await w.close();
  return true;
}
