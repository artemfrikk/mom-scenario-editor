// State of the translator screen. Work is kept in the browser (IndexedDB) after every change,
// together with the opened file, so closing the tab loses nothing.

import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { buildPackage, openPackage, type TranslationPackage } from './package';
import { browserEngineAvailable, prepareBrowserEngine, ThrottledError, translateAll, type Engine } from './machine';
import { buildGroups, type Group, type Row } from './rows';
import { fixTerms } from './terms';
import { needsNoTranslation } from './tokens';
import { existingOf, unitsOf } from './units';

export type Status = 'auto' | 'check' | 'done';

export interface Entry {
  text: string;
  status: Status;
}

export type Translations = Record<string, Entry>;

interface TranslatorState {
  pkg?: TranslationPackage;
  source: string;
  target: string;
  groups: Group[];
  tr: Translations;
  // the state before the last bulk change, for "Отменить"
  undo?: Translations;
  undoLabel?: string;
  open(file: Blob, name: string): Promise<'restored' | 'existing' | 'new'>;
  restoreLast(): Promise<boolean>;
  close(): void;
  setLanguages(source: string, target: string): Promise<void>;
  setText(key: string, text: string, status?: Status): void;
  setStatus(key: string, status: Status): void;
  bulk(label: string, change: (tr: Translations) => Translations): void;
  undoBulk(): void;
  // Forgets every translation (saved in the browser and the one already in the file) so everything is translated again.
  restart(): void;
  // Texts that still have no translation.
  missing(): Row[];
  // Machine-translates the given rows; returns how many lost a game mark on the way.
  machine(rows: Row[], onProgress: (done: number) => void, signal?: AbortSignal, opts?: { engine?: Engine; onWait?: (seconds: number) => void }): Promise<number>;
  build(): Promise<Blob>;
  // Which machine translator to use, and whether Chrome's built-in one can do this pair of languages.
  engine: Engine;
  browserAvailable: boolean;
  setEngine(engine: Engine): void;
  // Translates the rows with the chosen engine; if Google stops answering and Chrome can translate by itself,
  // the rest goes through Chrome's translator.
  auto(rows: Row[], onProgress: (p: Progress) => void, signal: AbortSignal): Promise<{ lost: number; switched: boolean }>;
}

export interface Progress {
  done: number;
  total: number;
  // seconds of pause Google asked for, 0 when working
  wait: number;
}

const FILE_KEY = 'mse-tr-file';
export const workKey = (name: string, source: string, target: string) => `mse-tr:${name}:${source}:${target}`;

let saveTimer: number | undefined;
function saveSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const { pkg, source, target, tr } = useTranslator.getState();
    if (pkg) void set(workKey(pkg.fileName, source, target), tr).catch(() => {});
  }, 600);
}

function pickLanguages(pkg: TranslationPackage, wanted = 'Russian'): { source: string; target: string } {
  const langs = Object.keys(pkg.texts);
  const source = langs.find((l) => l !== wanted && l === pkg.defaultLanguage) ?? langs.find((l) => l !== wanted && l === 'English') ?? langs.find((l) => l !== wanted) ?? langs[0];
  return { source, target: wanted };
}

// Translations already in the file, and texts that need no translator (numbers, dashes, only icons), copied as they are.
export function startingTranslations(pkg: TranslationPackage, source: string, target: string): Translations {
  const tr: Translations = {};
  for (const [k, v] of existingOf(pkg, source, target)) tr[k] = { text: v, status: 'done' };
  for (const u of unitsOf(pkg, source)) if (!tr[u.id] && needsNoTranslation(u.source)) tr[u.id] = { text: u.source, status: 'done' };
  return tr;
}

async function load(pkg: TranslationPackage, source: string, target: string): Promise<{ tr: Translations; restored: boolean }> {
  const saved = await get<Translations>(workKey(pkg.fileName, source, target)).catch(() => undefined);
  if (saved && Object.keys(saved).length) return { tr: { ...startingTranslations(pkg, source, target), ...saved }, restored: true };
  return { tr: startingTranslations(pkg, source, target), restored: false };
}

export const useTranslator = create<TranslatorState>((setState, getState) => ({
  source: 'English',
  target: 'Russian',
  groups: [],
  tr: {},

  async open(file, name) {
    const pkg = await openPackage(file, name);
    const { source, target } = pickLanguages(pkg);
    const { tr, restored } = await load(pkg, source, target);
    setState({ pkg, source, target, tr, groups: buildGroups(pkg, source, target), undo: undefined });
    void browserEngineAvailable(source, target).then((ok) => setState({ browserAvailable: ok }));
    void set(FILE_KEY, { name, file: file instanceof Blob ? file : new Blob([file]) }).catch(() => {});
    if (restored) return 'restored';
    return pkg.texts[target] ? 'existing' : 'new';
  },

  async restoreLast() {
    const last = await get<{ name: string; file: Blob }>(FILE_KEY).catch(() => undefined);
    if (!last) return false;
    try {
      await getState().open(last.file, last.name);
      return true;
    } catch {
      await del(FILE_KEY).catch(() => {});
      return false;
    }
  },

  close() {
    void del(FILE_KEY).catch(() => {});
    setState({ pkg: undefined, groups: [], tr: {}, undo: undefined });
  },

  async setLanguages(source, target) {
    const { pkg } = getState();
    if (!pkg) return;
    const { tr } = await load(pkg, source, target);
    setState({ source, target, tr, groups: buildGroups(pkg, source, target), undo: undefined });
    void browserEngineAvailable(source, target).then((ok) => setState({ browserAvailable: ok }));
  },

  setText(key, text, status = 'done') {
    setState((st) => ({ tr: { ...st.tr, [key]: { text, status } } }));
    saveSoon();
  },

  setStatus(key, status) {
    setState((st) => (st.tr[key] ? { tr: { ...st.tr, [key]: { ...st.tr[key], status } } } : st));
    saveSoon();
  },

  bulk(label, change) {
    setState((st) => ({ undo: st.tr, undoLabel: label, tr: change(st.tr) }));
    saveSoon();
  },

  undoBulk() {
    setState((st) => (st.undo ? { tr: st.undo, undo: undefined } : st));
    saveSoon();
  },

  restart() {
    const { pkg, source } = getState();
    if (!pkg) return;
    const tr: Translations = {};
    for (const u of unitsOf(pkg, source)) if (needsNoTranslation(u.source)) tr[u.id] = { text: u.source, status: 'done' };
    setState((st) => ({ undo: st.tr, undoLabel: 'Перевести всё заново', tr }));
    saveSoon();
  },

  missing() {
    const { groups, tr } = getState();
    return groups.flatMap((g) => g.rows).filter((r) => r.source.trim() && !needsNoTranslation(r.source) && !(tr[r.key]?.text ?? '').trim());
  },

  async machine(rows, onProgress, signal, opts = {}) {
    const { source, target } = getState();
    let done = 0;
    let lost = 0;
    // Results arrive by the hundred; the screen takes them in a few times a second.
    let pending: Translations = {};
    const flush = () => {
      if (!Object.keys(pending).length) return;
      const add = pending;
      pending = {};
      setState((st) => ({ tr: { ...st.tr, ...add } }));
      saveSoon();
      onProgress(done);
    };
    const timer = window.setInterval(flush, 400);
    try {
      await translateAll(
        rows.map((r) => r.source),
        source,
        target,
        (i, res) => {
          done++;
          if (!res.ok) lost++;
          pending[rows[i].key] = { text: target === 'Russian' ? fixTerms(rows[i].source, res.text) : res.text, status: 'auto' };
        },
        { signal, ...opts },
      );
    } finally {
      window.clearInterval(timer);
      flush();
    }
    return lost;
  },

  engine: 'google',
  browserAvailable: false,
  setEngine(engine) {
    if (engine === 'browser') prepareBrowserEngine(getState().source, getState().target);
    setState({ engine });
  },

  async auto(rows, onProgress, signal) {
    const total = rows.length;
    let base = 0;
    let last = 0;
    const run = (list: Row[], engine: Engine) =>
      getState().machine(
        list,
        (d) => onProgress({ done: (last = base + d), total, wait: 0 }),
        signal,
        { engine, onWait: (wait) => onProgress({ done: last, total, wait }) },
      );
    const engine = getState().engine;
    try {
      return { lost: await run(rows, engine), switched: false };
    } catch (e) {
      if (!(e instanceof ThrottledError) || engine !== 'google' || !getState().browserAvailable) throw e;
      setState({ engine: 'browser' });
      const tr = getState().tr;
      const rest = rows.filter((r) => !(tr[r.key]?.text ?? '').trim());
      base = total - rest.length;
      try {
        return { lost: await run(rest, 'browser'), switched: true };
      } catch {
        // Chrome could not start its translator without a click: let the person pick it in the list and press again.
        if (signal.aborted) return { lost: 0, switched: true };
        throw new Error(e.message + ' Или выберите «встроенным переводчиком Chrome» рядом с кнопкой «Перевести автоматически» и нажмите её снова.');
      }
    }
  },

  async build() {
    const { pkg, source, target, tr } = getState();
    if (!pkg) throw new Error('Сценарий не открыт');
    const map = new Map<string, string>();
    for (const [k, e] of Object.entries(tr)) map.set(k, e.text);
    return buildPackage(pkg, source, target, map);
  },
}));
