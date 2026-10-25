// Open and save .valkyrie packages (a zip of quest.ini, other ini files and Localization.*.txt).
// Saving follows QuestEditor.Save in unity/Assets/Scripts/QuestEditor/QuestEditor.cs.

import JSZip from 'jszip';
import { NL, parseIni, serializeSection } from './ini';
import { parseLocalization, serializeLocalization } from './localization';
import { DEFAULT_SOURCE, typeOfSection, type QComponent, type Scenario } from './scenario';

export const SAVED_BY = '; Saved by MoM Scenario Editor';

export type FileMap = Record<string, Uint8Array>;

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

export async function readZip(data: ArrayBuffer | Uint8Array | Blob): Promise<FileMap> {
  const zip = await JSZip.loadAsync(data);
  const files: FileMap = {};
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    files[entry.name.replace(/\\/g, '/')] = await entry.async('uint8array');
  }
  return stripCommonFolder(files);
}

// Some packages are zipped with the quest folder inside; make paths relative to quest.ini.
function stripCommonFolder(files: FileMap): FileMap {
  const questIni = Object.keys(files).find((p) => p.toLowerCase().endsWith('quest.ini'));
  if (!questIni) throw new Error('В архиве нет quest.ini: это не сценарий Valkyrie.');
  const prefix = questIni.substring(0, questIni.length - 'quest.ini'.length);
  if (!prefix) return files;
  const out: FileMap = {};
  for (const [p, d] of Object.entries(files)) if (p.startsWith(prefix)) out[p.substring(prefix.length)] = d;
  return out;
}

function findFile(files: FileMap, name: string): string | undefined {
  if (name in files) return name;
  const lower = name.toLowerCase().replace(/\\/g, '/');
  return Object.keys(files).find((p) => p.toLowerCase() === lower);
}

export function scenarioFromFiles(files: FileMap): Scenario {
  const questPath = findFile(files, 'quest.ini');
  if (!questPath) throw new Error('В архиве нет quest.ini: это не сценарий Valkyrie.');
  const questIni = parseIni(decoder.decode(files[questPath]));
  const quest = questIni.sections.get('Quest');
  if (!quest) throw new Error('В quest.ini нет раздела [Quest].');

  const used = new Set<string>([questPath]);
  const components: QComponent[] = [];
  const seen = new Set<string>();

  const iniFiles = ['quest.ini', ...Object.keys(questIni.sections.get('QuestData') ?? {})];
  for (const file of iniFiles) {
    if (!file.toLowerCase().endsWith('.ini')) continue;
    const path = findFile(files, file);
    if (!path) continue;
    used.add(path);
    const ini = file === 'quest.ini' ? questIni : parseIni(decoder.decode(files[path]));
    for (const [section, data] of ini.sections) {
      let name = section;
      // Format 3 used "StartingItem" for what is now QItem.
      if (name.startsWith('StartingItem')) name = 'QItem' + name.substring('StartingItem'.length);
      const type = typeOfSection(name);
      if (!type || seen.has(name)) continue;
      seen.add(name);
      components.push({ name, type, source: file, data: { ...data } });
    }
  }

  const texts: Scenario['texts'] = {};
  for (const file of Object.keys(questIni.sections.get('QuestText') ?? {})) {
    const path = findFile(files, file);
    if (!path) continue;
    used.add(path);
    const loc = parseLocalization(decoder.decode(files[path]));
    const target = (texts[loc.language] ??= {});
    for (const [k, v] of loc.entries) if (!(k in target)) target[k] = v;
  }

  const assets: FileMap = {};
  for (const [p, d] of Object.entries(files)) {
    if (used.has(p)) continue;
    // Stale copies of text/ini files are regenerated on save, so they are not kept as assets.
    if (/^Localization\.[^/]+\.txt$/i.test(p) || /\.ini$/i.test(p)) continue;
    assets[p] = d;
  }

  return { quest: { ...quest }, components, texts, assets };
}

export function scenarioToFiles(s: Scenario): FileMap {
  const languages = Object.keys(s.texts);
  const bySource = new Map<string, QComponent[]>();
  for (const c of s.components) {
    const source = c.source || DEFAULT_SOURCE[c.type];
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source)!.push(c);
  }

  let quest = `${SAVED_BY}${NL}${serializeSection('Quest', s.quest)}${NL}`;
  if (languages.length) {
    quest += `${NL}[QuestText]${NL}`;
    for (const l of languages) quest += `Localization.${l}.txt${NL}`;
    quest += NL;
  }
  quest += `[QuestData]${NL}`;
  for (const source of bySource.keys()) if (source !== 'quest.ini') quest += `${source}${NL}`;

  const files: FileMap = { ...s.assets };
  for (const [source, list] of bySource) {
    if (source === 'quest.ini') continue;
    files[source] = encoder.encode(SAVED_BY + NL + list.map((c) => NL + serializeSection(c.name, c.data)).join(''));
  }
  for (const c of bySource.get('quest.ini') ?? []) quest += NL + serializeSection(c.name, c.data);
  files['quest.ini'] = encoder.encode(quest);

  for (const l of languages) {
    files[`Localization.${l}.txt`] = encoder.encode(
      serializeLocalization({ language: l, entries: new Map(Object.entries(s.texts[l])) }),
    );
  }
  return files;
}

export async function loadValkyrie(data: ArrayBuffer | Uint8Array | Blob): Promise<Scenario> {
  return scenarioFromFiles(await readZip(data));
}

export async function saveValkyrie(s: Scenario): Promise<Blob> {
  const zip = new JSZip();
  for (const [p, d] of Object.entries(scenarioToFiles(s))) zip.file(p, d);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export async function saveValkyrieBytes(s: Scenario): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [p, d] of Object.entries(scenarioToFiles(s))) zip.file(p, d);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
