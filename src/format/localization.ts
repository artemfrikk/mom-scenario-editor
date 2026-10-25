// Reader/writer for Valkyrie's Localization.<Language>.txt files
// (unity/Assets/Scripts/Content/DictionaryI18n.cs: AddData, ParseEntry, SerializeMultiple).

const TRIPLE = '|||';
const QUOTE = '"';

export interface LocalizationFile {
  language: string;
  entries: Map<string, string>;
}

export function parseLocalization(text: string): LocalizationFile {
  text = text.replace(/^﻿/, '');
  const lines = (text.includes('\r') ? text.split('\r') : text.split('\n')).map((l) =>
    l.replace(/^[\r\n]+|[\r\n]+$/g, ''),
  );

  // Join physical lines into logical entries, the same way Valkyrie does.
  const raw: string[] = [];
  let current: string[] = [];
  let tripleMode = false;
  for (const line of lines) {
    const sections = line.split(QUOTE).length;
    const isFirst = current.length === 0;
    current.push(line);
    let end = false;

    if ((isFirst && line.includes(',' + TRIPLE)) || tripleMode) {
      tripleMode = !line.trimEnd().endsWith(TRIPLE);
      end = !tripleMode;
    } else if (sections % 2 === 1) {
      end = isFirst && !tripleMode;
    } else if (!isFirst || isOldFormat(line)) {
      end = !tripleMode;
    }

    if (end) {
      raw.push(current.join('\n'));
      current = [];
      tripleMode = false;
    }
  }
  if (current.length) raw.push(current.join('\\n'));

  const language = (raw[0] ?? '.,English').split(',')[1]?.replace(/"/g, '') ?? 'English';
  const entries = new Map<string, string>();
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].trim().startsWith('//')) continue;
    const comma = raw[i].indexOf(',');
    if (comma === -1) continue;
    const key = raw[i].substring(0, comma);
    if (!entries.has(key)) entries.set(key, parseEntry(raw[i].substring(comma + 1)));
  }
  return { language, entries };
}

function isOldFormat(line: string): boolean {
  const comma = line.indexOf(',');
  return !(comma !== -1 && line[comma + 1] === QUOTE);
}

function parseEntry(entry: string): string {
  let v = entry.replace(/\\n/g, '\n');
  if (v.length >= TRIPLE.length * 2 && v.startsWith(TRIPLE) && v.trim().endsWith(TRIPLE)) {
    v = v.substring(TRIPLE.length, v.length - TRIPLE.length);
  }
  if (v.length > 1 && v[0] === QUOTE && v[v.length - 1] === QUOTE) {
    v = v.substring(1, v.length - 1).replace(/""/g, QUOTE);
  }
  return v;
}

export function serializeLocalization(file: LocalizationFile, nl = '\r\n'): string {
  const out = ['.,' + file.language];
  for (const [key, value] of file.entries) {
    const v = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\\n');
    if (v.includes(QUOTE) && !v.includes(TRIPLE)) {
      out.push(`${key},${TRIPLE}${v}${TRIPLE}`);
    } else if (v.includes(QUOTE) || v.includes(TRIPLE) || v.includes('\\n')) {
      out.push(`${key},${QUOTE}${v.replace(/"/g, '""')}${QUOTE}`);
    } else {
      out.push(`${key},${v}`);
    }
  }
  return out.join(nl);
}
