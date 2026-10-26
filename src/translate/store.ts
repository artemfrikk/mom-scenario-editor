// State of the translator screen. Work is kept in the browser (IndexedDB) after every change,
// together with the opened file, so closing the tab loses nothing.

import { del, get, set } from 'idb-keyval';
import { create } from 'zustand';
import { buildPackage, openPackage, type TranslationPackage } from './package';
import { buildGroups, type Group } from './rows';
import { needsNoTranslation } from './tokens';

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
  build(): Promise<Blob>;
}

const FILE_KEY = 'mse-tr-file';
const workKey = (name: string, source: string, target: string) => `mse-tr:${name}:${source}:${target}`;

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

// Texts that need no translator (numbers, dashes, only icons) are copied as they are.
function startingTranslations(pkg: TranslationPackage, source: string, target: string): Translations {
  const tr: Translations = {};
  const old = pkg.texts[target];
  for (const [k, v] of pkg.texts[source] ?? []) {
    const existing = old?.get(k);
    if (existing !== undefined && existing.trim() !== '') tr[k] = { text: existing, status: 'done' };
    else if (needsNoTranslation(v)) tr[k] = { text: v, status: 'done' };
  }
  for (const [k, v] of old ?? []) if (!tr[k] && v.trim()) tr[k] = { text: v, status: 'done' };
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

  async build() {
    const { pkg, source, target, tr } = getState();
    if (!pkg) throw new Error('Сценарий не открыт');
    const map = new Map<string, string>();
    for (const [k, e] of Object.entries(tr)) map.set(k, e.text);
    return buildPackage(pkg, source, target, map);
  },
}));
