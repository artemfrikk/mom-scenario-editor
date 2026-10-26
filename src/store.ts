import { get as idbGet, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { defaultLanguage, newScenario, type Scenario } from './format/scenario';
import { loadValkyrie, saveValkyrie } from './format/valkyrie';

export type View = 'quest' | 'map' | 'story' | 'play' | 'texts' | 'check';
export type Layout = Record<string, { x: number; y: number }>;

// Story-graph node positions travel inside the package; Valkyrie ignores unknown files.
const LAYOUT_FILE = 'mse-layout.json';
// The author's free-form notes about the plot; also kept inside the package.
const NOTES_FILE = 'mse-notes.md';
// Readable names of the variables ("Есть ключ" for est_klyuch); Valkyrie only sees the ids.
const FACTS_FILE = 'mse-facts.json';
const HISTORY_LIMIT = 200;

interface State {
  scenario: Scenario;
  fileName: string;
  layout: Layout;
  notes: string;
  facts: Record<string, string>;
  notice: string;
  view: View;
  selected: string | null;
  lang: string;
  past: Scenario[];
  future: Scenario[];
  dirty: boolean;

  // Apply a change that can be undone. Consecutive changes with the same `mergeKey`
  // (typing in one text field) collapse into one undo step.
  change: (fn: (s: Scenario) => Scenario, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (name: string | null) => void;
  setView: (v: View) => void;
  setLang: (l: string) => void;
  setLayout: (l: Layout, markDirty?: boolean) => void;
  setNotes: (text: string) => void;
  setFact: (id: string, label: string) => void;
  // Replace everything with an earlier state (version history); the scenario part can be undone.
  restore: (snap: { scenario: Scenario; layout: Layout; notes: string; facts: Record<string, string> }) => void;
  flash: (message: string) => void;
  open: (file: File) => Promise<void>;
  reset: () => void;
  startWith: (scenario: Scenario, notes: string) => void;
  save: () => Promise<Blob>;
}

let noticeTimer: number | undefined;
let lastMergeKey: string | undefined;
let lastMergeAt = 0;

const AUTOSAVE_KEY = 'mse-autosave';

export const useStore = create<State>((set, get) => ({
  scenario: newScenario('Russian'),
  fileName: 'scenario.valkyrie',
  layout: {},
  notes: '',
  facts: {},
  notice: '',
  view: 'story',
  selected: null,
  lang: 'Russian',
  past: [],
  future: [],
  dirty: false,

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
  setNotes: (notes) => set({ notes, dirty: true }),
  setFact: (id, label) => set({ facts: { ...get().facts, [id]: label }, dirty: true }),
  restore: (snap) => {
    const { scenario, past } = get();
    lastMergeKey = undefined;
    set({
      scenario: snap.scenario,
      layout: snap.layout,
      notes: snap.notes,
      facts: snap.facts,
      past: [...past, scenario].slice(-HISTORY_LIMIT),
      future: [],
      selected: null,
      dirty: true,
    });
  },
  flash: (notice) => {
    set({ notice });
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => set({ notice: '' }), 4000);
  },
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
    }
    const notes = s.assets[NOTES_FILE] ? new TextDecoder().decode(s.assets[NOTES_FILE]) : '';
    let facts: Record<string, string> = {};
    if (s.assets[FACTS_FILE]) {
      try {
        facts = JSON.parse(new TextDecoder().decode(s.assets[FACTS_FILE]));
      } catch {
        facts = {};
      }
    }
    const assets = { ...s.assets };
    delete assets[LAYOUT_FILE];
    delete assets[NOTES_FILE];
    delete assets[FACTS_FILE];
    s.assets = assets;
    set({
      scenario: s,
      fileName: file.name.endsWith('.valkyrie') ? file.name : file.name + '.valkyrie',
      layout,
      notes,
      facts,
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
      notes: '',
      facts: {},
      selected: null,
      lang: 'Russian',
      past: [],
      future: [],
      dirty: false,
      view: 'quest',
    }),
  startWith: (scenario, notes) =>
    set({
      scenario,
      fileName: 'scenario.valkyrie',
      layout: {},
      notes,
      facts: {},
      selected: null,
      lang: defaultLanguage(scenario),
      past: [],
      future: [],
      dirty: true,
      view: 'story',
    }),
  save: async () => {
    const { scenario, layout, notes, facts } = get();
    const extra: Record<string, Uint8Array> = { [LAYOUT_FILE]: new TextEncoder().encode(JSON.stringify(layout)) };
    if (notes.trim()) extra[NOTES_FILE] = new TextEncoder().encode(notes);
    if (Object.keys(facts).length) extra[FACTS_FILE] = new TextEncoder().encode(JSON.stringify(facts));
    const withLayout: Scenario = { ...scenario, assets: { ...scenario.assets, ...extra } };
    const blob = await saveValkyrie(withLayout);
    set({ dirty: false });
    return blob;
  },
}));

// --- autosave to the browser (IndexedDB), so a closed tab does not lose work -----------

export async function restoreAutosave(): Promise<boolean> {
  try {
    const saved = await idbGet<{ scenario: Scenario; layout: Layout; fileName: string; notes?: string; facts?: Record<string, string> }>(AUTOSAVE_KEY);
    if (!saved?.scenario) return false;
    useStore.setState({
      scenario: saved.scenario,
      layout: saved.layout ?? {},
      notes: saved.notes ?? '',
      facts: saved.facts ?? {},
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
  if (state.scenario === prev.scenario && state.layout === prev.layout && state.notes === prev.notes && state.facts === prev.facts) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    // best effort: storage may be blocked in private windows
    idbSet(AUTOSAVE_KEY, {
      scenario: state.scenario,
      layout: state.layout,
      notes: state.notes,
      facts: state.facts,
      fileName: state.fileName,
    }).catch(() => {});
  }, 800);
});
