// The constructor's state: the project, its pictures and sounds, undo, and autosave to the browser.

import { get as idbGet, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { loadValkyrie, saveValkyrie } from '../format/valkyrie';
import { compile } from './compile';
import { projectFromScenario } from './load';
import { newProject, type Assets, type Project } from './project';

export type Step = 'cover' | 'prologue' | 'map' | 'endings' | 'play';
export type Selection = { kind: 'room' | 'piece'; id: string } | null;

const AUTOSAVE_KEY = 'mse-builder';
const HISTORY_LIMIT = 200;

interface State {
  project: Project;
  assets: Assets;
  fileName: string;
  step: Step;
  selected: Selection;
  past: Project[];
  future: Project[];
  dirty: boolean;
  foreign: boolean; // opened from a scenario made in another editor
  notice: string;
  change: (fn: (p: Project) => Project, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  setStep: (s: Step) => void;
  select: (s: Selection) => void;
  addAsset: (name: string, data: Uint8Array) => string;
  flash: (text: string) => void;
  open: (file: File) => Promise<void>;
  reset: () => void;
  save: () => Promise<Blob>;
}

let lastKey: string | undefined;
let lastAt = 0;
let noticeTimer: number | undefined;

export const useBuilder = create<State>((set, get) => ({
  project: newProject(),
  assets: {},
  fileName: 'scenario.valkyrie',
  step: 'cover',
  selected: null,
  past: [],
  future: [],
  dirty: false,
  foreign: false,
  notice: '',

  change: (fn, mergeKey) => {
    const { project, past } = get();
    const next = fn(project);
    if (next === project) return;
    const now = Date.now();
    const merge = mergeKey !== undefined && mergeKey === lastKey && now - lastAt < 1500;
    lastKey = mergeKey;
    lastAt = now;
    set({ project: next, past: merge ? past : [...past, project].slice(-HISTORY_LIMIT), future: [], dirty: true });
  },
  undo: () => {
    const { past, future, project } = get();
    if (!past.length) return;
    lastKey = undefined;
    set({ project: past[past.length - 1], past: past.slice(0, -1), future: [project, ...future], dirty: true });
  },
  redo: () => {
    const { past, future, project } = get();
    if (!future.length) return;
    lastKey = undefined;
    set({ project: future[0], past: [...past, project], future: future.slice(1), dirty: true });
  },
  setStep: (step) => set({ step }),
  select: (selected) => set({ selected }),
  // Files the author adds keep their name, unless it is taken by different content.
  addAsset: (name, data) => {
    const assets = get().assets;
    const clean = name.replace(/[^\w.\-а-яё]+/gi, '_') || 'file';
    let out = clean;
    for (let i = 2; assets[out] && !same(assets[out], data); i++) out = clean.replace(/(\.[^.]*)?$/, `_${i}$1`);
    set({ assets: { ...assets, [out]: data }, dirty: true });
    return out;
  },
  flash: (notice) => {
    set({ notice });
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => set({ notice: '' }), 4500);
  },
  open: async (file) => {
    const s = await loadValkyrie(file);
    const { project, assets, foreign } = projectFromScenario(s);
    set({
      project,
      assets,
      foreign,
      fileName: file.name.endsWith('.valkyrie') ? file.name : file.name + '.valkyrie',
      step: foreign ? 'map' : 'cover',
      selected: null,
      past: [],
      future: [],
      dirty: false,
    });
  },
  reset: () =>
    set({ project: newProject(), assets: {}, foreign: false, fileName: 'scenario.valkyrie', step: 'cover', selected: null, past: [], future: [], dirty: false }),
  save: async () => {
    const { project, assets } = get();
    const blob = await saveValkyrie(compile(project, unused(project, assets)));
    set({ dirty: false });
    return blob;
  },
}));

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Files the author added and then stopped using are not packed. Files of a scenario made elsewhere always stay.
function unused(p: Project, assets: Assets): Assets {
  if (p.raw) return assets;
  const used = new Set([p.cover, p.prologue.image, p.prologue.music, ...p.pieces.map((x) => x.outcome.sound ?? ''), ...p.pieces.map((x) => x.outcome.puzzle?.image ?? '')].filter(Boolean));
  return Object.fromEntries(Object.entries(assets).filter(([k]) => used.has(k)));
}

// --- the browser keeps the work if the tab is closed ---------------------------------------------

export async function restoreAutosave(): Promise<boolean> {
  try {
    const saved = await idbGet<{ project: Project; assets: Assets; fileName: string; foreign?: boolean }>(AUTOSAVE_KEY);
    if (!saved?.project) return false;
    useBuilder.setState({ project: { ...newProject(), ...saved.project }, assets: saved.assets ?? {}, fileName: saved.fileName, foreign: !!saved.foreign });
    return true;
  } catch {
    return false;
  }
}

let timer: number | undefined;
useBuilder.subscribe((st, prev) => {
  if (st.project === prev.project && st.assets === prev.assets) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    idbSet(AUTOSAVE_KEY, { project: st.project, assets: st.assets, fileName: st.fileName, foreign: st.foreign }).catch(() => {});
  }, 800);
});
