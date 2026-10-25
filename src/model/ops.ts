// Pure helpers that read and change a Scenario. They never mutate their input.

import {
  DEFAULT_SOURCE,
  defaultLanguage,
  isEventLike,
  type ComponentType,
  type QComponent,
  type Scenario,
} from '../format/scenario';

export function getComponent(s: Scenario, name: string): QComponent | undefined {
  return s.components.find((c) => c.name === name);
}

export function uniqueName(s: Scenario, type: ComponentType, base = ''): string {
  const names = new Set(s.components.map((c) => c.name));
  const stem = type + base.replace(/[^A-Za-z0-9_]/g, '');
  if (base && !names.has(stem)) return stem;
  for (let i = 1; ; i++) if (!names.has(stem + i)) return stem + i;
}

export function addComponent(
  s: Scenario,
  type: ComponentType,
  data: Record<string, string> = {},
  base = '',
): [Scenario, string] {
  const name = uniqueName(s, type, base);
  const defaults: Record<string, string> = isEventLike(type) ? { buttons: '1', event1: '' } : {};
  const c: QComponent = { name, type, source: DEFAULT_SOURCE[type], data: { ...defaults, ...data } };
  return [{ ...s, components: [...s.components, c] }, name];
}

export function updateData(s: Scenario, name: string, patch: Record<string, string | undefined>): Scenario {
  return {
    ...s,
    components: s.components.map((c) => {
      if (c.name !== name) return c;
      const data = { ...c.data };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete data[k];
        else data[k] = v;
      }
      return { ...c, data };
    }),
  };
}

// --- references between components -------------------------------------------------

const TOKEN_SPLIT = /([\s,]+)/;

function replaceTokens(value: string, from: string, to: string): string {
  return value
    .split(TOKEN_SPLIT)
    .map((t) => (t === from ? to : t))
    .join('');
}

// Keys whose values hold component names (event1.., add, remove, hero, monster...).
function isRefKey(key: string): boolean {
  return /^event\d+$/.test(key) || ['add', 'remove', 'hero', 'trigger', 'activation', 'inspect', 'evadeevent', 'horrorevent', 'monster', 'base'].includes(key) || /^placement\d+$/.test(key);
}

function renameInValue(key: string, value: string, from: string, to: string): string {
  if (key === 'trigger') {
    for (const prefix of ['DefeatedUnique', 'Defeated', '']) {
      if (value === prefix + from) return to ? prefix + to : '';
    }
    return value;
  }
  const out = replaceTokens(value, from, to);
  // Deleting leaves double spaces behind; tidy them up.
  return to ? out : out.replace(/\s{2,}/g, ' ').trim();
}

export function renameComponent(s: Scenario, from: string, to: string): Scenario {
  if (from === to || !to || getComponent(s, to)) return s;
  const components = s.components.map((c) => {
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.data)) data[k] = isRefKey(k) ? renameInValue(k, v, from, to) : v;
    return { ...c, name: c.name === from ? to : c.name, data };
  });
  const texts: Scenario['texts'] = {};
  for (const [lang, entries] of Object.entries(s.texts)) {
    texts[lang] = {};
    for (const [k, v] of Object.entries(entries)) {
      const key = k.startsWith(from + '.') ? to + k.substring(from.length) : k;
      texts[lang][key] = v.split(`{c:${from}}`).join(`{c:${to}}`);
    }
  }
  return { ...s, components, texts };
}

export function deleteComponent(s: Scenario, name: string): Scenario {
  const components = s.components
    .filter((c) => c.name !== name)
    .map((c) => {
      const data: Record<string, string> = {};
      for (const [k, v] of Object.entries(c.data)) data[k] = isRefKey(k) ? renameInValue(k, v, name, '') : v;
      return { ...c, data };
    });
  const texts: Scenario['texts'] = {};
  for (const [lang, entries] of Object.entries(s.texts)) {
    texts[lang] = Object.fromEntries(Object.entries(entries).filter(([k]) => !k.startsWith(name + '.')));
  }
  return { ...s, components, texts };
}

export function duplicateComponent(s: Scenario, name: string): [Scenario, string] {
  const c = getComponent(s, name);
  if (!c) return [s, name];
  const newName = uniqueName(s, c.type, c.name.substring(c.type.length).replace(/\d+$/, ''));
  const data = { ...c.data };
  if (data.xposition) data.xposition = String(Number(data.xposition) + 1.75);
  const texts: Scenario['texts'] = {};
  for (const [lang, entries] of Object.entries(s.texts)) {
    texts[lang] = { ...entries };
    for (const [k, v] of Object.entries(entries)) if (k.startsWith(name + '.')) texts[lang][newName + k.substring(name.length)] = v;
  }
  return [{ ...s, texts, components: [...s.components, { ...c, name: newName, data }] }, newName];
}

// --- buttons ------------------------------------------------------------------------

export interface Button {
  index: number; // 1-based
  targets: string[];
  labelKey: string; // localized text key holding the label
  labelRaw?: string; // label written directly in the ini (older scenarios)
  color?: string;
  condition?: string;
}

export function buttonsOf(c: QComponent): Button[] {
  let n = parseInt(c.data.buttons ?? '0', 10) || 0;
  if (n === 0 && c.data.display !== 'false' && isEventLike(c.type)) n = 1;
  const out: Button[] = [];
  for (let i = 1; i <= n; i++) {
    const raw = c.data['event' + i] ?? '';
    // "EventA EventB,var,=,1" — names, then an optional inline condition.
    const [names] = raw.split(',');
    out.push({
      index: i,
      targets: names.split(/\s+/).filter(Boolean),
      labelKey: `${c.name}.button${i}`,
      labelRaw: c.data['button' + i],
      color: c.data['buttoncolor' + i],
      condition: c.data[`event${i}Condition`],
    });
  }
  return out;
}

export function setButtonTargets(s: Scenario, name: string, index: number, targets: string[]): Scenario {
  const c = getComponent(s, name);
  if (!c) return s;
  const rest = (c.data['event' + index] ?? '').split(',').slice(1);
  return updateData(s, name, { ['event' + index]: [targets.join(' '), ...rest].join(',') });
}

export function addButton(s: Scenario, name: string, label: string, lang: string): Scenario {
  const c = getComponent(s, name);
  if (!c) return s;
  const n = buttonsOf(c).length + 1;
  const next = updateData(s, name, { buttons: String(n), ['event' + n]: '' });
  return setText(next, lang, `${name}.button${n}`, label);
}

export function removeButton(s: Scenario, name: string, index: number): Scenario {
  const c = getComponent(s, name);
  if (!c) return s;
  const buttons = buttonsOf(c);
  const patch: Record<string, string | undefined> = { buttons: String(buttons.length - 1) };
  const textMoves: [string, string | undefined][] = [];
  for (let i = index; i <= buttons.length; i++) {
    for (const key of ['event', 'button', 'buttoncolor']) {
      patch[key + i] = i < buttons.length ? c.data[key + (i + 1)] : undefined;
    }
    patch[`event${i}Condition`] = i < buttons.length ? c.data[`event${i + 1}Condition`] : undefined;
    patch[`event${i}ConditionAction`] = i < buttons.length ? c.data[`event${i + 1}ConditionAction`] : undefined;
    textMoves.push([`${name}.button${i}`, i < buttons.length ? `${name}.button${i + 1}` : undefined]);
  }
  let out = updateData(s, name, patch);
  const texts: Scenario['texts'] = {};
  for (const [lang, entries] of Object.entries(out.texts)) {
    const e = { ...entries };
    for (const [to, from] of textMoves) {
      if (from && from in entries) e[to] = entries[from];
      else delete e[to];
    }
    texts[lang] = e;
  }
  out = { ...out, texts };
  return out;
}

// --- texts --------------------------------------------------------------------------

export function getText(s: Scenario, lang: string, key: string): string {
  return s.texts[lang]?.[key] ?? '';
}

export function setText(s: Scenario, lang: string, key: string, value: string): Scenario {
  return { ...s, texts: { ...s.texts, [lang]: { ...(s.texts[lang] ?? {}), [key]: value } } };
}

// Text with {qst:KEY} references expanded, for previews.
export function resolveText(s: Scenario, lang: string, text: string, depth = 0): string {
  if (depth > 5) return text;
  return text.replace(/\{qst:([^}]+)\}/g, (_, key: string) => {
    const v = s.texts[lang]?.[key] ?? s.texts[defaultLanguage(s)]?.[key];
    return v === undefined ? key : resolveText(s, lang, v, depth + 1);
  });
}

// A label is usually text, often a shared reference such as "{qst:CONTINUE}".
export function buttonLabel(s: Scenario, lang: string, b: Button): string {
  return resolveText(s, lang, b.labelRaw ?? getText(s, lang, b.labelKey));
}

// --- places on the map --------------------------------------------------------------

export function position(c: QComponent): { x: number; y: number } | null {
  if (c.data.xposition === undefined && c.data.yposition === undefined) return null;
  return { x: Number(c.data.xposition ?? 0) || 0, y: Number(c.data.yposition ?? 0) || 0 };
}

export const SQUARE = 3.5; // one MoM room space in Valkyrie units
export const SNAP_TILE = 3.5;
export const SNAP_TOKEN = 1.75;

export function fmt(n: number): string {
  return String(Math.round(n * 10000) / 10000);
}

// --- what shows a component on the board --------------------------------------------

export const BOARD_TYPES: ComponentType[] = ['Tile', 'Token', 'Door', 'UI', 'MPlace'];

const listOf = (v: string | undefined) => (v ?? '').split(/\s+/).filter(Boolean);

export function addedBy(s: Scenario, name: string): string[] {
  return s.components.filter((c) => listOf(c.data.add).includes(name)).map((c) => c.name);
}

export function setAddedBy(s: Scenario, name: string, events: string[]): Scenario {
  const want = new Set(events);
  return {
    ...s,
    components: s.components.map((c) => {
      const add = listOf(c.data.add);
      const has = add.includes(name);
      if (has === want.has(c.name)) return c;
      const next = has ? add.filter((x) => x !== name) : [...add, name];
      const data = { ...c.data };
      if (next.length) data.add = next.join(' ');
      else delete data.add;
      return { ...c, data };
    }),
  };
}
