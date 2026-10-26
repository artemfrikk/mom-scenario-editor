// Opens a .valkyrie package for translation and writes the translation back into it.
// Only Localization.<Language>.txt and quest.ini change; every other file stays byte for byte the same.

import JSZip from 'jszip';
import { parseIni } from '../format/ini';
import { parseLocalization, serializeLocalization } from '../format/localization';
import { typeOfSection, type ComponentType } from '../format/scenario';

export interface TranslationPackage {
  fileName: string;
  zip: JSZip;
  // folder inside the zip that holds quest.ini ('' for most packages)
  prefix: string;
  questIni: string;
  defaultLanguage: string;
  // language -> key -> text, keys in file order
  texts: Record<string, Map<string, string>>;
  // component name -> its type, from the ini files
  types: Map<string, ComponentType>;
}

const decoder = new TextDecoder('utf-8');

export async function openPackage(data: Blob | ArrayBuffer | Uint8Array, fileName: string): Promise<TranslationPackage> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error('Это не файл сценария Valkyrie (.valkyrie): архив не открывается.');
  }
  const questPath = Object.keys(zip.files).find((p) => !zip.files[p].dir && /(^|\/)quest\.ini$/i.test(p.replace(/\\/g, '/')));
  if (!questPath) throw new Error('В файле нет quest.ini: это не сценарий Valkyrie.');
  const prefix = questPath.substring(0, questPath.length - 'quest.ini'.length);
  const read = async (name: string) => {
    const wanted = (prefix + name).replace(/\\/g, '/').toLowerCase();
    const path = Object.keys(zip.files).find((p) => p.replace(/\\/g, '/').toLowerCase() === wanted);
    return path ? decoder.decode(await zip.files[path].async('uint8array')) : undefined;
  };

  const questIni = decoder.decode(await zip.files[questPath].async('uint8array'));
  const ini = parseIni(questIni);
  const quest = ini.sections.get('Quest') ?? {};
  const defaultLanguage = quest.defaultlanguage || 'English';

  const texts: Record<string, Map<string, string>> = {};
  for (const file of Object.keys(ini.sections.get('QuestText') ?? {})) {
    const body = await read(file);
    if (body === undefined) continue;
    const loc = parseLocalization(body);
    const target = (texts[loc.language] ??= new Map());
    for (const [k, v] of loc.entries) if (!target.has(k)) target.set(k, v);
  }
  if (!Object.keys(texts).length) throw new Error('В сценарии нет ни одного файла с текстами (Localization.*.txt).');

  const types = new Map<string, ComponentType>();
  for (const file of ['quest.ini', ...Object.keys(ini.sections.get('QuestData') ?? {})]) {
    if (!file.toLowerCase().endsWith('.ini')) continue;
    const body = file === 'quest.ini' ? questIni : await read(file);
    if (body === undefined) continue;
    for (const name of parseIni(body).sections.keys()) {
      const t = typeOfSection(name);
      if (t) types.set(name, t);
    }
  }

  return { fileName, zip, prefix, questIni, defaultLanguage, texts, types };
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
  const entries = new Map<string, string>();
  const keys = [...(pkg.texts[source]?.keys() ?? []), ...(pkg.texts[target]?.keys() ?? [])];
  for (const k of keys) {
    const v = translations.get(k) ?? pkg.texts[target]?.get(k);
    if (v !== undefined && v.trim() !== '' && !entries.has(k)) entries.set(k, v);
  }

  const file = `Localization.${target}.txt`;
  // Replace any existing file for this language, whatever its case.
  for (const p of Object.keys(pkg.zip.files)) {
    if (p.replace(/\\/g, '/').toLowerCase() === (pkg.prefix + file).toLowerCase()) pkg.zip.remove(p);
  }
  pkg.zip.file(pkg.prefix + file, serializeLocalization({ language: target, entries }));

  let ini = addQuestText(pkg.questIni, file);
  // The scenario list reads name.<Language> / synopsys.<Language> from quest.ini when the author filled them in.
  const quest = parseIni(ini).sections.get('Quest') ?? {};
  for (const [field, key] of [
    ['name', 'quest.name'],
    ['synopsys', 'quest.synopsys'],
  ] as const) {
    const t = entries.get(key);
    if (t && quest[`${field}.${pkg.defaultLanguage}`] !== undefined) ini = setQuestKey(ini, `${field}.${target}`, t);
  }
  const questPath = Object.keys(pkg.zip.files).find((p) => p.toLowerCase() === (pkg.prefix + 'quest.ini').toLowerCase())!;
  pkg.zip.file(questPath, ini);

  return pkg.zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/octet-stream' });
}
