// "What can happen" menu: each plain-language action fills in the right fields of an event.

import catalog from '../content/catalog.json';
import type { Scenario } from '../format/scenario';
import { factId, formatOps, knownFacts, parseOps } from './facts';
import { placeBeside, tileBox } from './geometry';
import { addComponent, buttonsOf, fmt, getComponent, position, setButtonTargets, setText, updateData } from './ops';
import { buildTemplate } from './templates';

export type ActionId = 'tile' | 'monster' | 'search' | 'door' | 'item' | 'remember' | 'end';

export interface Action {
  id: ActionId;
  icon: string;
  title: string;
  what: string;
  needs?: 'tile' | 'monster' | 'item'; // a choice from the catalog is asked first
}

export const ACTIONS: Action[] = [
  { id: 'tile', icon: '🧱', title: 'Появится комната', what: 'Новая комната встанет на карту рядом с остальными.', needs: 'tile' },
  { id: 'monster', icon: '👹', title: 'Появится монстр', what: 'После первой кнопки события на поле выйдет монстр, и сюжет пойдёт дальше.', needs: 'monster' },
  { id: 'search', icon: '🔍', title: 'Появится жетон с находкой', what: 'Жетон на карте и событие с находкой, привязанные к этому событию.' },
  { id: 'door', icon: '🚪', title: 'Появится дверь', what: 'Дверь на карте. Нажатие на неё запускает своё событие.' },
  { id: 'item', icon: '🗝', title: 'Игроки получат предмет', what: 'Предмет из игры попадёт к сыщикам.', needs: 'item' },
  { id: 'remember', icon: '🧠', title: 'Игра что-то запомнит', what: 'Например, «Есть ключ». Потом это можно проверить в условиях.' },
  { id: 'end', icon: '🏁', title: 'Игра закончится', what: 'Сценарий завершится после этого события.' },
];

const SIZES = new Map(catalog.tiles.map((t) => [t.id, t.traits]));

function tileSize(side: string): [number, number] {
  const traits = SIZES.get(side) ?? [];
  if (traits.includes('big')) return [10.5, 7];
  if (traits.includes('medium')) return [7, 7];
  return [7, 3.5];
}

// Free place for a new room: against the newest room, on the first free side.
export function spotForTile(s: Scenario, side: string): { x: number; y: number } {
  const tiles = s.components.filter((c) => c.type === 'Tile');
  const boxes = tiles.map((c) => {
    const p = position(c) ?? { x: 0, y: 0 };
    const [w, h] = tileSize(c.data.side ?? '');
    return tileBox(p.x, p.y, w, h, Number(c.data.rotation ?? 0) || 0);
  });
  if (!boxes.length) return { x: 0, y: 0 };
  const [w, h] = tileSize(side);
  return placeBeside(boxes[boxes.length - 1], w, h, 'right', boxes) ?? { x: 0, y: -10.5 * tiles.length };
}

function show(s: Scenario, event: string, name: string): Scenario {
  const c = getComponent(s, event);
  if (!c) return s;
  const add = (c.data.add ?? '').split(/\s+/).filter(Boolean);
  return add.includes(name) ? s : updateData(s, event, { add: [...add, name].join(' ') });
}

export interface Applied {
  scenario: Scenario;
  facts: Record<string, string>;
  first?: string; // what to select afterwards
}

export function applyAction(s: Scenario, lang: string, event: string, id: ActionId, arg = '', labels: Record<string, string> = {}): Applied | null {
  const c = getComponent(s, event);
  if (!c) return null;
  switch (id) {
    case 'tile': {
      if (!arg) return null;
      const spot = spotForTile(s, arg);
      const [next, name] = addComponent(s, 'Tile', { side: arg, xposition: fmt(spot.x), yposition: fmt(spot.y) }, arg.replace(/^TileSide/, ''));
      return { scenario: show(next, event, name), facts: {}, first: name };
    }
    case 'monster': {
      if (!arg) return null;
      // A monster appears when its Spawn is reached by a button, so the Spawn is put between this event's first button and what follows.
      let [next, name] = addComponent(s, 'Spawn', { monster: arg }, arg.replace(/^Monster/, ''));
      const b = buttonsOf(getComponent(next, event)!)[0];
      if (b) {
        next = setButtonTargets(next, name, 1, b.targets);
        next = setButtonTargets(next, event, 1, [name]);
      }
      next = setText(setText(next, lang, name + '.text', 'Монстр вышел на поле.'), lang, name + '.button1', 'Продолжить');
      return { scenario: next, facts: {}, first: name };
    }
    case 'search': {
      const built = buildTemplate(s, lang, 'search', { event, button: 1 }, labels);
      return built && { scenario: built.scenario, facts: built.facts, first: built.first };
    }
    case 'door': {
      const n = s.components.filter((x) => x.type === 'Token' || x.type === 'Door').length;
      let [next, name] = addComponent(s, 'Door', { xposition: fmt((n % 6) * 3.5), yposition: fmt(-Math.floor(n / 6) * 3.5 - 3.5) });
      next = setText(setText(next, lang, name + '.text', ''), lang, name + '.button1', 'Продолжить');
      return { scenario: show(next, event, name), facts: {}, first: name };
    }
    case 'item': {
      if (!arg) return null;
      const [next, name] = addComponent(s, 'QItem', { itemname: arg, starting: 'false' }, arg.replace(/^Item/, ''));
      return { scenario: show(next, event, name), facts: {}, first: name };
    }
    case 'remember': {
      const ops = parseOps(c.data.operations);
      const known = knownFacts(s, labels);
      let fact = known[0];
      const facts: Record<string, string> = {};
      if (!fact) {
        fact = factId('Новый факт', known);
        facts[fact] = 'Новый факт';
      }
      return { scenario: updateData(s, event, { operations: formatOps([...ops, { name: fact, op: '=', value: '1' }]) }), facts, first: event };
    }
    case 'end': {
      const ops = parseOps(c.data.operations);
      if (ops.some((o) => !('raw' in o) && o.name === '$end')) return { scenario: s, facts: {}, first: event };
      return { scenario: updateData(s, event, { operations: formatOps([...ops, { name: '$end', op: '=', value: '1' }]) }), facts: {}, first: event };
    }
  }
}
