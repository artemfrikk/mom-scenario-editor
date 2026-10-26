// Turns the texts of a package into rows for the translator screen, grouped by the part of the scenario they belong to.

import type { ComponentType } from '../format/scenario';
import type { TranslationPackage } from './package';
import { unitsOf } from './units';

export interface Row {
  key: string;
  group: string;
  // what the text is, in plain words: "Текст", "Кнопка 2", "Название"
  field: string;
  source: string;
}

export interface Group {
  id: string;
  type: ComponentType | 'quest' | 'other';
  title: string;
  rows: Row[];
}

const QUEST_FIELD: Record<string, string> = {
  name: 'Название сценария',
  synopsys: 'Краткое описание (в списке сценариев)',
  description: 'Описание перед началом',
  authors: 'Авторы',
  authors_short: 'Авторы коротко',
};

const FIELD: Record<string, string> = {
  text: 'Текст',
  name: 'Название',
  description: 'Описание',
  info: 'Описание',
  monstername: 'Имя монстра',
  uitext: 'Надпись',
  feedback: 'Ответ',
  question: 'Вопрос',
  ability: 'Способность',
  minioncombat: 'Атака по приспешнику',
  mastercombat: 'Атака по главарю',
  movebutton: 'Кнопка движения',
  move: 'Движение',
  masterattack: 'Атака главаря',
  minionattack: 'Атака приспешника',
};

export function fieldLabel(group: string, field: string): string {
  if (group === 'quest') return QUEST_FIELD[field] ?? field;
  const button = field.match(/^button(\d+)$/);
  if (button) return `Кнопка ${button[1]}`;
  return FIELD[field] ?? field;
}

export function buildGroups(pkg: TranslationPackage, source: string, target: string): Group[] {
  const groups = new Map<string, Group>();
  const units = unitsOf(pkg, source);
  // Keys that only exist in the old translation stay visible too.
  if (!pkg.multi) for (const k of pkg.texts[target]?.keys() ?? []) if (!pkg.texts[source]?.has(k)) units.push({ id: k, key: k, source: '' });

  for (const { id: rowKey, key, source: text } of units) {
    const dot = key.indexOf('.');
    const owner = dot === -1 ? key : key.substring(0, dot);
    const field = dot === -1 ? '' : key.substring(dot + 1);
    const type = owner === 'quest' ? 'quest' : (pkg.types.get(owner) ?? 'other');
    const gid = type === 'other' ? 'other' : owner;
    let g = groups.get(gid);
    if (!g) {
      g = { id: gid, type, title: type === 'quest' ? 'О сценарии' : type === 'other' ? 'Прочее' : owner.substring(type.length) || owner, rows: [] };
      groups.set(gid, g);
    }
    g.rows.push({ key: rowKey, group: gid, field: type === 'other' ? key : fieldLabel(owner, field), source: text });
  }

  const order = (g: Group) => (g.type === 'quest' ? 0 : g.type === 'other' ? 2 : 1);
  return [...groups.values()].sort((a, b) => order(a) - order(b));
}
