import { get as idbGet, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { defaultLanguage, newScenario, type Scenario } from './format/scenario';
import { loadValkyrie, saveValkyrie } from './format/valkyrie';

export type View = 'quest' | 'map' | 'story' | 'texts' | 'check';
export type Layout = Record<string, { x: number; y: number }>;

// Story-graph node positions travel inside the package; Valkyrie ignores unknown files.
const LAYOUT_FILE = 'mse-layout.json';
const HISTORY_LIMIT = 200;

interface State {
  scenario: Scenario;
  fileName: string;
  layout: Layout;
  view: View;
  selected: string | null;
  lang: string;
  past: Scenario[];
  future: Scenario[];
  dirty: boolean;
  tileImages: Record<string, string>; // image base name (lower case) -> object URL

  // Apply a change that can be undone. Consecutive changes with the same `mergeKey`
  // (typing in one text field) collapse into one undo step.
  change: (fn: (s: Scenario) => Scenario, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (name: string | null) => void;
  setView: (v: View) => void;
  setLang: (l: string) => void;
  setLayout: (l: Layout, markDirty?: boolean) => void;
  open: (file: File) => Promise<void>;
  reset: () => void;
  save: () => Promise<Blob>;
  setTileImages: (m: Record<string, string>) => void;
}

let lastMergeKey: string | undefined;
let lastMergeAt = 0;

const AUTOSAVE_KEY = 'mse-autosave';

export const useStore = create<State>((set, get) => ({
  scenario: newScenario('Russian'),
  fileName: 'scenario.valkyrie',
  layout: {},
  view: 'story',
  selected: null,
  lang: 'Russian',
  past: [],
  future: [],
  dirty: false,
  tileImages: {},

  change: (fn, mergeKey) => {
    const { scenario, past } = get();
    const next = fn(scenario);
    if (next === scenario) return;
    const now = Date.now();
    const merge = mergeKey !== undefined && mergeKey === lastMergeKey && now - lastMergeAt < 1500;
    lastMergeKey = mergeKey;
    lastMergeAt = now;
    set({
      scenario: next,
      past: merge ? past : [...past, scenario].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
    });
  },
  undo: () => {
    const { past, future, scenario } = get();
    if (!past.length) return;
    lastMergeKey = undefined;
    set({ scenario: past[past.length - 1], past: past.slice(0, -1), future: [scenario, ...future], dirty: true });
  },
  redo: () => {
    const { past, future, scenario } = get();
    if (!future.length) return;
    lastMergeKey = undefined;
    set({ scenario: future[0], past: [...past, scenario], future: future.slice(1), dirty: true });
  },
  select: (name) => set({ selected: name }),
  setView: (view) => set({ view }),
  setLang: (lang) => set({ lang }),
  setLayout: (layout, markDirty = true) => set(markDirty ? { layout, dirty: true } : { layout }),

  open: async (file) => {
    const s = await loadValkyrie(file);
    let layout: Layout = {};
    const raw = s.assets[LAYOUT_FILE];
    if (raw) {
      try {
        layout = JSON.parse(new TextDecoder().decode(raw));
      } catch {
        layout = {};
      }
      const assets = { ...s.assets };
      delete assets[LAYOUT_FILE];
      s.assets = assets;
    }
    set({
      scenario: s,
      fileName: file.name.endsWith('.valkyrie') ? file.name : file.name + '.valkyrie',
      layout,
      selected: null,
      lang: defaultLanguage(s),
      past: [],
      future: [],
      dirty: false,
      view: 'story',
    });
  },
  reset: () =>
    set({
      scenario: newScenario('Russian'),
      fileName: 'scenario.valkyrie',
      layout: {},
      selected: null,
      lang: 'Russian',
      past: [],
      future: [],
      dirty: false,
      view: 'quest',
    }),
  save: async () => {
    const { scenario, layout } = get();
    const withLayout: Scenario = {
      ...scenario,
      assets: { ...scenario.assets, [LAYOUT_FILE]: new TextEncoder().encode(JSON.stringify(layout)) },
    };
    const blob = await saveValkyrie(withLayout);
    set({ dirty: false });
    return blob;
  },
  setTileImages: (tileImages) => set({ tileImages }),
}));

// --- autosave to the browser (IndexedDB), so a closed tab does not lose work -----------

export async function restoreAutosave(): Promise<boolean> {
  try {
    const saved = await idbGet<{ scenario: Scenario; layout: Layout; fileName: string }>(AUTOSAVE_KEY);
    if (!saved?.scenario) return false;
    useStore.setState({
      scenario: saved.scenario,
      layout: saved.layout ?? {},
      fileName: saved.fileName,
      lang: defaultLanguage(saved.scenario),
    });
    return true;
  } catch {
    return false;
  }
}

let autosaveTimer: number | undefined;
useStore.subscribe((state, prev) => {
  if (state.scenario === prev.scenario && state.layout === prev.layout) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    // best effort: storage may be blocked in private windows
    idbSet(AUTOSAVE_KEY, { scenario: state.scenario, layout: state.layout, fileName: state.fileName }).catch(() => {});
  }, 800);
});
