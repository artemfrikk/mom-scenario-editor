// INI reader/writer compatible with Valkyrie's IniRead (libraries/ValkyrieTools/IniRead.cs).
// Sections and keys keep their file order so that saving changes as little as possible.

export type IniSection = Record<string, string>;
export interface IniFile {
  sections: Map<string, IniSection>;
}

export function parseIni(text: string): IniFile {
  const sections = new Map<string, IniSection>();
  let current: IniSection | null = null;

  for (const raw of text.replace(/^﻿/, '').split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line[0] === '#' || line[0] === ';') continue;

    if (line[0] === '[') {
      const name = line.replace(/^\[+|\]+$/g, '');
      // Valkyrie ignores duplicate sections: the first one wins.
      if (name === '' || sections.has(name)) {
        current = null;
      } else {
        current = {};
        sections.set(name, current);
      }
      continue;
    }
    if (!current) continue;

    const eq = raw.indexOf('=');
    const key = (eq === -1 ? raw : raw.substring(0, eq)).trim();
    if (key in current) continue;
    current[key] = eq === -1 ? '' : stripQuotes(raw.substring(eq + 1).trim());
  }
  return { sections };
}

function stripQuotes(value: string): string {
  return value.replace(/^"+|"+$/g, '');
}

export const NL = '\r\n';

export function serializeSection(name: string, data: IniSection): string {
  let out = `[${name}]${NL}`;
  for (const [key, value] of Object.entries(data)) {
    out += value === '' && isBareKey(name) ? `${key}${NL}` : `${key}=${value}${NL}`;
  }
  return out;
}

// [QuestData] and [QuestText] list file names as bare keys without "=".
function isBareKey(section: string): boolean {
  return section === 'QuestData' || section === 'QuestText';
}
