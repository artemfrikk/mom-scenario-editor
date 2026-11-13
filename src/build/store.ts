// The constructor's state: the project, its pictures and sounds, undo, and autosave to the browser.

import { get as idbGet, set as idbSet } from 'idb-keyval';
import { create } from 'zustand';
import { loadValkyrie, saveValkyrie } from '../format/valkyrie';
import { chaptersOf, compileCampaign, newChapter } from './campaign';
import { projectFromScenario } from './load';
import { newProject, type Assets, type Outcome, type Project } from './project';

export type Step = 'cover' | 'prologue' | 'map' | 'threat' | 'endings' | 'play';
export type Selection = { kind: 'room' | 'piece'; id: string } | null;

const AUTOSAVE_KEY = 'mse-builder';
const HISTORY_LIMIT = 200;

interface State {
  project: Project; // the chapter being edited
  chapters: Project[]; // every chapter of the campaign; the one being edited is kept in project
  chapter: number;
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
  goChapter: (i: number) => void;
  addChapter: () => void;
  removeChapter: (i: number) => void;
  open: (file: File) => Promise<void>;
  reset: () => void;
  save: () => Promise<Blob>;
}

let lastKey: string | undefined;
let lastAt = 0;
let noticeTimer: number | undefined;

export const useBuilder = create<State>((set, get) => ({
  project: newProject(),
  chapters: [newProject()],
  chapter: 0,
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
  goChapter: (i) => {
    const { chapter } = get();
    if (i === chapter) return;
    const chapters = allChapters();
    if (!chapters[i]) return;
    lastKey = undefined;
    set({ chapters, chapter: i, project: chapters[i], past: [], future: [], selected: null, step: 'cover' });
  },
  addChapter: () => {
    const chapters = allChapters();
    if (chapters.length === 1 && !chapters[0].chapter) chapters[0] = { ...chapters[0], chapter: 'ch1', chapterTitle: chapters[0].chapterTitle ?? 'Глава 1' };
    const fresh = newChapter(chapters);
    const all = [...chapters, fresh];
    lastKey = undefined;
    set({ chapters: all, chapter: all.length - 1, project: fresh, past: [], future: [], selected: null, step: 'cover', dirty: true });
  },
  // The first chapter is the scenario itself and stays. Endings that led to a removed chapter end the campaign.
  removeChapter: (i) => {
    if (i <= 0) return;
    const chapters = allChapters();
    const gone = chapters[i]?.chapter;
    if (!gone) return;
    const unlink = (n?: string) => (n === gone ? undefined : n);
    const left = chapters
      .filter((_, k) => k !== i)
      .map((c) => {
        const remember = (o: Outcome): Outcome => ({ ...o, choices: o.choices?.map((c) => ({ ...c, outcome: remember(c.outcome) })), remember: o.remember?.filter((m) => !m.startsWith(gone + 'm')), lock: o.lock && { ...o.lock, needs: o.lock.needs.filter((n) => !n.startsWith('%' + gone + 'm')) } });
        return {
          ...c,
          next: c.next && { win: unlink(c.next.win), lose: unlink(c.next.lose) },
          pieces: c.pieces.map((x) => ({ ...x, outcome: remember(x.outcome) })),
          timeline: c.timeline?.map((t) => ({ ...t, outcome: remember(t.outcome) })),
        };
      });
    const chapter = Math.min(get().chapter >= i ? get().chapter - 1 : get().chapter, left.length - 1);
    lastKey = undefined;
    set({ chapters: left, chapter, project: left[chapter], past: [], future: [], selected: null, dirty: true });
  },
  open: async (file) => {
    const s = await loadValkyrie(file);
    const { project, assets, foreign } = projectFromScenario(s);
    const chapters = chaptersOf(project);
    set({
      project: chapters[0],
      chapters,
      chapter: 0,
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
    set({ project: newProject(), chapters: [newProject()], chapter: 0, assets: {}, foreign: false, fileName: 'scenario.valkyrie', step: 'cover', selected: null, past: [], future: [], dirty: false }),
  save: async () => {
    const blob = await saveValkyrie(compileCampaign(allChapters(), get().assets));
    set({ dirty: false });
    return blob;
  },
}));

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Every chapter as it is now: the one being edited is in project.
export function allChapters(): Project[] {
  const { chapters, chapter, project } = useBuilder.getState();
  const out = chapters.length ? [...chapters] : [project];
  out[Math.min(chapter, out.length - 1)] = project;
  return out;
}

// --- the browser keeps the work if the tab is closed ---------------------------------------------

export async function restoreAutosave(): Promise<boolean> {
  try {
    const saved = await idbGet<{ project: Project; chapters?: Project[]; chapter?: number; assets: Assets; fileName: string; foreign?: boolean }>(AUTOSAVE_KEY);
    if (!saved?.project) return false;
    const chapters = (saved.chapters?.length ? saved.chapters : [saved.project]).map((c) => ({ ...newProject(), ...c }));
    const chapter = Math.min(saved.chapter ?? 0, chapters.length - 1);
    chapters[chapter] = { ...newProject(), ...saved.project };
    useBuilder.setState({ project: chapters[chapter], chapters, chapter, assets: saved.assets ?? {}, fileName: saved.fileName, foreign: !!saved.foreign });
    return true;
  } catch {
    return false;
  }
}

let timer: number | undefined;
useBuilder.subscribe((st, prev) => {
  if (st.project === prev.project && st.assets === prev.assets && st.chapters === prev.chapters) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    idbSet(AUTOSAVE_KEY, { project: st.project, chapters: st.chapters, chapter: st.chapter, assets: st.assets, fileName: st.fileName, foreign: st.foreign }).catch(() => {});
  }, 800);
});
