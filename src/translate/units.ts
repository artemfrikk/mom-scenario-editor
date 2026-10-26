// What the person translates. In an ordinary scenario that is every text key. In a big package with hundreds of
// generated quests the same sentences repeat with different place and family names, so names are swapped for
// {@Key} marks and each distinct sentence is translated once; saving puts the right names back in every quest.

import type { Doc, TranslationPackage } from './package';

// "a/b/../c.txt" -> "a/c.txt"
export function normalizePath(path: string): string {
  const out: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  }
  return out.join('/');
}

export interface Unit {
  id: string;
  // the first text key where it appears, to label it on screen
  key: string;
  source: string;
}

export const MULTI = 'm:';

// Short phrases without a dot in the key ("City", "Family") that change from quest to quest
// and are used inside other texts: names to swap out.
export function varKeysOf(docs: Doc[]): Set<string> {
  const values = new Map<string, Set<string>>();
  const bad = new Set<string>();
  for (const d of docs) {
    for (const [k, v] of d.entries) {
      if (k.includes('.') || bad.has(k)) continue;
      const t = v.trim();
      if (t.length < 3 || t.length > 40 || /[{}<>\n]/.test(t)) {
        bad.add(k);
        continue;
      }
      let set = values.get(k);
      if (!set) values.set(k, (set = new Set()));
      set.add(t);
    }
  }
  // ...and that are used inside other texts of the same quest.
  const keys = new Set<string>();
  for (const [k, set] of values) {
    if (bad.has(k) || set.size < 2) continue;
    const used = docs.some((d) => {
      const v = d.entries.get(k)?.trim();
      if (!v) return false;
      for (const [other, text] of d.entries) if (other !== k && text.includes(v)) return true;
      return false;
    });
    if (used) keys.add(k);
  }
  return keys;
}

export interface DocVars {
  // value -> key, for this quest
  byValue: Map<string, string>;
  pattern: RegExp | null;
}

export function docVars(doc: Doc, keys: Set<string>): DocVars {
  const byValue = new Map<string, string>();
  for (const k of keys) {
    const v = doc.entries.get(k)?.trim();
    if (v && !byValue.has(v)) byValue.set(v, k);
  }
  const alts = [...byValue.keys()].sort((a, b) => b.length - a.length).map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { byValue, pattern: alts.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${alts.join('|')})(?![\\p{L}\\p{N}])`, 'gu') : null };
}

export function templateOf(text: string, vars: DocVars): string {
  return vars.pattern ? text.replace(vars.pattern, (v) => `{@${vars.byValue.get(v)}}`) : text;
}

// Puts the (translated) names of one quest back into a translated sentence.
export function fillTemplate(text: string, name: (key: string) => string): string {
  return text.replace(/\{@([^{}]+)\}/g, (_, k: string) => name(k));
}

export function sourceDocs(pkg: TranslationPackage, source: string): Doc[] {
  const used = new Set(pkg.quests.flatMap((q) => q.texts.map((t) => t.path.toLowerCase())));
  return pkg.docs.filter((d) => d.language === source && used.has(normalizePath(d.path).toLowerCase()));
}

// The text file for `target` next to a source file: Localization.English_global.txt -> Localization.Russian_global.txt
export function siblingName(name: string, source: string, target: string): string {
  const re = new RegExp(`Localization\\.${source}`, 'i');
  if (re.test(name)) return name.replace(re, `Localization.${target}`);
  return name.replace(/([^/]*)$/, `Localization.${target}_$1`);
}

export interface MultiIndex {
  keys: Set<string>;
  vars: Map<Doc, DocVars>;
}

export function multiIndex(pkg: TranslationPackage, source: string): MultiIndex {
  const docs = sourceDocs(pkg, source);
  const keys = varKeysOf(docs);
  return { keys, vars: new Map(docs.map((d) => [d, docVars(d, keys)])) };
}

export function unitIdOf(index: MultiIndex, doc: Doc, key: string, text: string): string {
  return MULTI + (index.keys.has(key) ? text.trim() : templateOf(text, index.vars.get(doc)!));
}

export function unitsOf(pkg: TranslationPackage, source: string): Unit[] {
  if (!pkg.multi) return [...(pkg.texts[source] ?? new Map<string, string>())].map(([key, text]) => ({ id: key, key, source: text }));
  const index = multiIndex(pkg, source);
  const seen = new Map<string, Unit>();
  for (const doc of index.vars.keys()) {
    for (const [key, text] of doc.entries) {
      const id = unitIdOf(index, doc, key, text);
      if (!seen.has(id)) seen.set(id, { id, key, source: id.substring(MULTI.length) });
    }
  }
  return [...seen.values()];
}

// Translations already in the package (an earlier Localization.<target>.txt next to the source file).
export function existingOf(pkg: TranslationPackage, source: string, target: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!pkg.multi) {
    for (const [k, v] of pkg.texts[target] ?? []) if (v.trim()) out.set(k, v);
    return out;
  }
  const index = multiIndex(pkg, source);
  const byPath = new Map(pkg.docs.map((d) => [normalizePath(d.path).toLowerCase(), d]));
  for (const doc of index.vars.keys()) {
    const old = byPath.get(siblingName(normalizePath(doc.path), source, target).toLowerCase());
    if (!old) continue;
    for (const [k, v] of old.entries) {
      const src = doc.entries.get(k);
      if (src === undefined || !v.trim()) continue;
      const id = unitIdOf(index, doc, k, src);
      // A sentence with names inside can't be matched back to its template.
      if (!id.includes('{@') && !out.has(id)) out.set(id, v);
    }
  }
  return out;
}
