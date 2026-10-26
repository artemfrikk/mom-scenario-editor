// Opens a .valkyrie package for translation and writes the translation back into it.
// Only Localization.<Language>.txt and quest.ini change; every other file stays byte for byte the same.

import JSZip from 'jszip';
import { parseIni } from '../format/ini';
import { parseLocalization, serializeLocalization } from '../format/localization';
import { typeOfSection, type ComponentType } from '../format/scenario';
import { fillTemplate, MULTI, multiIndex, normalizePath, siblingName, unitIdOf } from './units';

export { normalizePath };

export interface Doc {
  // full path inside the zip
  path: string;
  language: string;
  entries: Map<string, string>;
}

export interface QuestFile {
  path: string;
  // folder of quest.ini inside the zip, with a trailing slash ('' at the top)
  dir: string;
  ini: string;
  // [QuestText] entries as written, and the zip paths they point to
  texts: { rel: string; path: string }[];
}

export interface TranslationPackage {
  fileName: string;
  zip: JSZip;
  // folder inside the zip that holds the main quest.ini ('' for most packages)
  prefix: string;
  questIni: string;
  defaultLanguage: string;
  // texts of the main quest: language -> key -> text, keys in file order
  texts: Record<string, Map<string, string>>;
  // component name -> its type, from the ini files
  types: Map<string, ComponentType>;
  // Every quest.ini and every text file. Big packages (procedurally generated campaigns) hold hundreds of quests
  // that share most of their texts; such a package is "multi" and is translated phrase by phrase.
  quests: QuestFile[];
  docs: Doc[];
  multi: boolean;
}

const decoder = new TextDecoder('utf-8');

export async function openPackage(data: Blob | ArrayBuffer | Uint8Array, fileName: string): Promise<TranslationPackage> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error('Это не файл сценария Valkyrie (.valkyrie): архив не открывается.');
  }
  const byLower = new Map<string, string>();
  for (const p of Object.keys(zip.files)) if (!zip.files[p].dir) byLower.set(normalizePath(p).toLowerCase(), p);
  const read = async (path: string) => {
    const real = byLower.get(normalizePath(path).toLowerCase());
    return real ? decoder.decode(await zip.files[real].async('uint8array')) : undefined;
  };

  // The main quest is the one closest to the top of the archive.
  const questPaths = [...byLower.values()]
    .filter((p) => /(^|\/)quest\.ini$/i.test(normalizePath(p)))
    .sort((a, b) => normalizePath(a).split('/').length - normalizePath(b).split('/').length);
  if (!questPaths.length) throw new Error('В файле нет quest.ini: это не сценарий Valkyrie.');

  const quests: QuestFile[] = [];
  const docs = new Map<string, Doc>();
  for (const path of questPaths) {
    const ini = decoder.decode(await zip.files[path].async('uint8array'));
    const dir = normalizePath(path).replace(/[^/]*$/, '');
    const texts = Object.keys(parseIni(ini).sections.get('QuestText') ?? {}).map((rel) => ({ rel, path: normalizePath(dir + rel) }));
    quests.push({ path, dir, ini, texts });
    for (const t of texts) {
      const key = t.path.toLowerCase();
      if (docs.has(key)) continue;
      const body = await read(t.path);
      if (body === undefined) continue;
      const loc = parseLocalization(body);
      docs.set(key, { path: byLower.get(key)!, language: loc.language, entries: loc.entries });
    }
  }

  const main = quests[0];
  const questIni = main.ini;
  const ini = parseIni(questIni);
  const defaultLanguage = ini.sections.get('Quest')?.defaultlanguage || 'English';

  const texts: Record<string, Map<string, string>> = {};
  for (const t of main.texts) {
    const doc = docs.get(t.path.toLowerCase());
    if (!doc) continue;
    const target = (texts[doc.language] ??= new Map());
    for (const [k, v] of doc.entries) if (!target.has(k)) target.set(k, v);
  }
  if (!docs.size) throw new Error('В сценарии нет ни одного файла с текстами (Localization.*.txt).');
  const multi = quests.filter((q) => q.texts.length).length > 1;
  // The main quest of a campaign may keep its texts elsewhere; show at least the languages it has.
  if (!Object.keys(texts).length) for (const d of docs.values()) texts[d.language] ??= new Map();

  // Component types name the groups on screen. In a big package the quests look alike, so one more quest is enough.
  const types = new Map<string, ComponentType>();
  for (const q of quests.slice(0, multi ? 2 : 1)) {
    for (const file of ['quest.ini', ...Object.keys(parseIni(q.ini).sections.get('QuestData') ?? {})]) {
      if (!file.toLowerCase().endsWith('.ini')) continue;
      const body = file === 'quest.ini' ? q.ini : await read(q.dir + file);
      if (body === undefined) continue;
      for (const name of parseIni(body).sections.keys()) {
        const t = typeOfSection(name);
        if (t) types.set(name, t);
      }
    }
  }

  return { fileName, zip, prefix: main.dir, questIni, defaultLanguage, texts, types, quests, docs: [...docs.values()], multi };
}

// Adds a file to [QuestText] (if it is not there yet), keeping the rest of quest.ini as it was.
export function addQuestText(ini: string, file: string): string {
  const nl = ini.includes('\r\n') ? '\r\n' : '\n';
  const lines = ini.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === '[questtext]');
  if (start === -1) {
    const body = ini.replace(/(\r?\n)*$/, '');
    return `${body}${nl}${nl}[QuestText]${nl}${file}${nl}`;
  }
  let end = lines.findIndex((l, i) => i > start && l.trim().startsWith('['));
  if (end === -1) end = lines.length;
  if (lines.slice(start + 1, end).some((l) => l.trim().toLowerCase() === file.toLowerCase())) return ini;
  lines.splice(start + 1, 0, file);
  return lines.join(nl);
}

// Sets key=value inside [Quest], replacing the old line or adding one right after the header.
export function setQuestKey(ini: string, key: string, value: string): string {
  const nl = ini.includes('\r\n') ? '\r\n' : '\n';
  const lines = ini.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim().toLowerCase() === '[quest]');
  if (start === -1) return ini;
  let end = lines.findIndex((l, i) => i > start && l.trim().startsWith('['));
  if (end === -1) end = lines.length;
  const line = `${key}=${value.replace(/\s*\r?\n\s*/g, ' ')}`;
  const at = lines.findIndex((l, i) => i > start && i < end && l.split('=')[0].trim() === key);
  if (at !== -1) lines[at] = line;
  else lines.splice(start + 1, 0, line);
  return lines.join(nl);
}

// Builds the translated package. Untranslated texts are left out, so Valkyrie shows the original instead.
export async function buildPackage(pkg: TranslationPackage, source: string, target: string, translations: Map<string, string>): Promise<Blob> {
  return pkg.multi ? buildMulti(pkg, source, target, translations) : buildSingle(pkg, source, target, translations);
}

function writeText(pkg: TranslationPackage, path: string, body: string) {
  // Replace any existing file with this name, whatever its case.
  for (const p of Object.keys(pkg.zip.files)) if (normalizePath(p).toLowerCase() === path.toLowerCase()) pkg.zip.remove(p);
  pkg.zip.file(path, body);
}

// The scenario list reads name.<Language> / synopsys.<Language> from quest.ini when the author filled them in.
function questNames(pkg: TranslationPackage, ini: string, target: string, texts: Map<string, string>): string {
  const quest = parseIni(ini).sections.get('Quest') ?? {};
  for (const [field, key] of [
    ['name', 'quest.name'],
    ['synopsys', 'quest.synopsys'],
  ] as const) {
    const t = texts.get(key);
    if (t && quest[`${field}.${pkg.defaultLanguage}`] !== undefined) ini = setQuestKey(ini, `${field}.${target}`, t);
  }
  return ini;
}

function generate(pkg: TranslationPackage): Promise<Blob> {
  return pkg.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/octet-stream' });
}

function buildSingle(pkg: TranslationPackage, source: string, target: string, translations: Map<string, string>): Promise<Blob> {
  const entries = new Map<string, string>();
  const keys = [...(pkg.texts[source]?.keys() ?? []), ...(pkg.texts[target]?.keys() ?? [])];
  for (const k of keys) {
    const v = translations.get(k) ?? pkg.texts[target]?.get(k);
    if (v !== undefined && v.trim() !== '' && !entries.has(k)) entries.set(k, v);
  }
  const file = `Localization.${target}.txt`;
  writeText(pkg, pkg.prefix + file, serializeLocalization({ language: target, entries }));
  pkg.zip.file(pkg.quests[0].path, questNames(pkg, addQuestText(pkg.questIni, file), target, entries));
  return generate(pkg);
}

function buildMulti(pkg: TranslationPackage, source: string, target: string, translations: Map<string, string>): Promise<Blob> {
  const index = multiIndex(pkg, source);
  const byPath = new Map(pkg.docs.map((d) => [normalizePath(d.path).toLowerCase(), d]));
  const written = new Map<string, Map<string, string>>();
  for (const [doc, vars] of index.vars) {
    const path = siblingName(normalizePath(doc.path), source, target);
    const old = byPath.get(path.toLowerCase())?.entries;
    const name = (k: string) => {
      const v = doc.entries.get(k)?.trim() ?? '';
      return translations.get(MULTI + v)?.trim() || v;
    };
    const entries = new Map<string, string>();
    for (const [k, v] of doc.entries) {
      let t = translations.get(unitIdOf(index, doc, k, v));
      if (t !== undefined && vars.pattern && !index.keys.has(k)) t = fillTemplate(t, name);
      if (!t?.trim()) t = old?.get(k);
      if (t?.trim()) entries.set(k, t);
    }
    for (const [k, v] of old ?? []) if (!entries.has(k) && v.trim()) entries.set(k, v);
    writeText(pkg, path, serializeLocalization({ language: target, entries }));
    written.set(normalizePath(doc.path).toLowerCase(), entries);
  }
  pkg.quests.forEach((q, i) => {
    let ini = q.ini;
    const mine = new Map<string, string>();
    for (const t of q.texts) {
      const entries = written.get(t.path.toLowerCase());
      if (!entries) continue;
      ini = addQuestText(ini, siblingName(t.rel, source, target));
      for (const [k, v] of entries) if (!mine.has(k)) mine.set(k, v);
    }
    if (i === 0) ini = questNames(pkg, ini, target, mine);
    if (ini !== q.ini) pkg.zip.file(q.path, ini);
  });
  return generate(pkg);
}
