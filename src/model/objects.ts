// The map constructor: what an author can do with a room, a token or a door, said in plain words.
// Each function fills in the events, texts and links that Valkyrie needs, so the author never sees them.

import type { Scenario } from '../format/scenario';
import { tileSize } from './actions';
import { defaultHook } from './builder';
import { factId, formatOps, parseOps } from './facts';
import { tileBox } from './geometry';
import { addComponent, addedBy, deleteComponent, fmt, getComponent, getText, position, setAddedBy, setButtonTargets, setText, updateData } from './ops';
import { buildTemplate } from './templates';
import catalog from '../content/catalog.json';

const list = (v: string | undefined) => (v ?? '').split(/\s+/).filter(Boolean);
const MADE = 'Создано конструктором для ';

// Pieces the constructor made for an object are marked, so changing the object's mode can clear them.
function clearMade(s: Scenario, owner: string): Scenario {
  let out = s;
  for (const c of s.components) if (c.data.comment === MADE + owner) out = deleteComponent(out, c.name);
  return out;
}

const mark = (owner: string) => ({ comment: MADE + owner });

function centre(s: Scenario, tile: string): { x: number; y: number } {
  const c = getComponent(s, tile);
  const p = (c && position(c)) ?? { x: 0, y: 0 };
  const [w, h] = tileSize(c?.data.side ?? '');
  const b = tileBox(p.x, p.y, w, h, Number(c?.data.rotation ?? 0) || 0);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

// --- rooms ----------------------------------------------------------------------------------

// The event that brings a piece onto the board. When none does, one is hung on the story's first free button
// (or becomes the start of the story when there is nothing yet).
export function ensureShown(s: Scenario, lang: string, name: string): { scenario: Scenario; event: string } {
  const have = addedBy(s, name)[0];
  if (have) return { scenario: s, event: have };
  const hook = defaultHook(s, lang, null);
  const built = hook ? buildTemplate(s, lang, 'scene', hook) : null;
  let out: Scenario;
  let event: string;
  if (built) {
    out = built.scenario;
    event = built.first;
  } else {
    [out, event] = addComponent(s, 'Event', { trigger: 'EventStart' }, 'Start');
    out = setText(setText(out, lang, event + '.text', ''), lang, event + '.button1', 'Продолжить');
  }
  const prev = list(getComponent(out, event)?.data.add);
  out = updateData(out, event, { add: [...prev, name].join(' ') });
  return { scenario: out, event };
}

// What the players read when the room appears.
export function roomText(s: Scenario, lang: string, tile: string): string {
  const e = addedBy(s, tile)[0];
  return e ? getText(s, lang, e + '.text') : '';
}

export function setRoomText(s: Scenario, lang: string, tile: string, text: string): Scenario {
  const { scenario, event } = ensureShown(s, lang, tile);
  return setText(scenario, lang, event + '.text', text);
}

export const investigatorsToken = (s: Scenario) => s.components.find((c) => c.type === 'Token' && c.data.type === 'TokenInvestigators')?.name;

// Whether the investigators begin in this room: their figure is shown by the event that shows the room.
export function startsHere(s: Scenario, tile: string): boolean {
  const token = investigatorsToken(s);
  const e = addedBy(s, tile)[0];
  return !!token && !!e && list(getComponent(s, e)?.data.add).includes(token);
}

export function placeInvestigators(s: Scenario, lang: string, tile: string): Scenario {
  const { scenario, event } = ensureShown(s, lang, tile);
  let out = scenario;
  let token = investigatorsToken(out);
  const at = centre(out, tile);
  if (token) {
    out = setAddedBy(out, token, []);
    out = updateData(out, token, { xposition: fmt(at.x), yposition: fmt(at.y) });
  } else {
    [out, token] = addComponent(out, 'Token', { type: 'TokenInvestigators', xposition: fmt(at.x), yposition: fmt(at.y), display: 'false', buttons: '0' }, 'Investigators');
  }
  return setAddedBy(out, token, [event]);
}

export function removeInvestigators(s: Scenario): Scenario {
  const token = investigatorsToken(s);
  return token ? setAddedBy(s, token, []) : s;
}

// A new object on a room: put near the room's middle, shown together with the room.
function spotOn(s: Scenario, tile: string): { xposition: string; yposition: string } {
  const at = centre(s, tile);
  const near = s.components.filter((c) => (c.type === 'Token' || c.type === 'Door') && position(c)).length;
  const dx = ((near % 3) - 1) * 1.75;
  const dy = (Math.floor(near / 3) % 3 - 1) * 1.75;
  return { xposition: fmt(at.x + dx), yposition: fmt(at.y + dy) };
}

export function addSearchOn(s: Scenario, lang: string, tile: string): { scenario: Scenario; name: string } {
  const { scenario, event } = ensureShown(s, lang, tile);
  let out: Scenario, token: string;
  [out, token] = addComponent(scenario, 'Token', { type: 'TokenSearch', ...spotOn(scenario, tile) }, 'Search');
  out = setText(out, lang, token + '.text', 'Вы осматриваете это место.');
  out = setText(out, lang, token + '.button1', 'Продолжить');
  out = updateData(out, event, { add: [...list(getComponent(out, event)?.data.add), token].join(' ') });
  return { scenario: out, name: token };
}

export function addDoorOn(s: Scenario, lang: string, tile: string): { scenario: Scenario; name: string } {
  const { scenario, event } = ensureShown(s, lang, tile);
  let out: Scenario, door: string;
  [out, door] = addComponent(scenario, 'Door', spotOn(scenario, tile), 'Door');
  out = updateData(out, event, { add: [...list(getComponent(out, event)?.data.add), door].join(' ') });
  return { scenario: setDoorMode(out, lang, door, 'open').scenario, name: door };
}

// --- search tokens ----------------------------------------------------------------------------

export type Found = 'nothing' | 'weapon' | 'item' | 'clue';

export function foundEvent(s: Scenario, token: string): string | undefined {
  const c = getComponent(s, token);
  const t = c && list(c.data.event1?.split(',')[0])[0];
  return t && getComponent(s, t) ? t : undefined;
}

export function foundOf(s: Scenario, token: string): { kind: Found; item: string } {
  const e = foundEvent(s, token);
  const c = e ? getComponent(s, e) : undefined;
  if (!c) return { kind: 'nothing', item: '' };
  for (const n of list(c.data.add)) {
    const q = getComponent(s, n);
    if (q?.type !== 'QItem') continue;
    if (q.data.itemname) return { kind: 'item', item: q.data.itemname };
    if ((q.data.traits ?? '').includes('weapon')) return { kind: 'weapon', item: '' };
  }
  const ops = parseOps(c.data.operations);
  if (ops.some((o) => !('raw' in o) && o.name === 'clues')) return { kind: 'clue', item: '' };
  return { kind: 'nothing', item: '' };
}

export const FOUND_TEXT: Record<Found, string> = {
  nothing: 'Здесь ничего нет.',
  weapon: 'Вы нашли оружие! Возьмите случайное оружие из колоды.',
  item: 'Вы нашли предмет!',
  clue: 'Вы нашли улику! {clue}',
};

// What the players find under a search token: nothing, a random weapon, a chosen item or a clue.
export function setFound(s: Scenario, lang: string, token: string, kind: Found, item = ''): Scenario {
  let out = s;
  let ev = foundEvent(out, token);
  if (!ev) {
    [out, ev] = addComponent(out, 'Event', {}, 'Found');
    out = setButtonTargets(out, token, 1, [ev]);
    out = setText(out, lang, ev + '.button1', 'Забрать');
  }
  const old = getComponent(out, ev)!;
  // Drop what the event gave before, and the quest items made only for it.
  const gone = list(old.data.add).filter((n) => getComponent(out, n)?.type === 'QItem');
  let add = list(old.data.add).filter((n) => !gone.includes(n));
  for (const n of gone) if (getComponent(out, n)?.data.comment === MADE + token) out = deleteComponent(out, n);
  const ops = parseOps(old.data.operations).filter((o) => 'raw' in o || o.name !== 'clues');
  if (kind === 'weapon' || kind === 'item') {
    let q: string;
    [out, q] = addComponent(out, 'QItem', kind === 'weapon' ? { traits: 'weapon common', starting: 'false', ...mark(token) } : { itemname: item, starting: 'false', ...mark(token) }, 'Found' + token.replace(/^Token/, ''));
    add = [...add, q];
  }
  if (kind === 'clue') ops.push({ name: 'clues', op: '+', value: '1' });
  const prevKind = foundOf(s, token).kind;
  const wasDefault = !getText(out, lang, ev + '.text') || getText(out, lang, ev + '.text') === FOUND_TEXT[prevKind];
  out = updateData(out, ev, { add: add.length ? add.join(' ') : undefined, operations: ops.length ? formatOps(ops) : undefined });
  if (wasDefault) out = setText(out, lang, ev + '.text', FOUND_TEXT[kind]);
  return out;
}

export function tokenText(s: Scenario, lang: string, token: string): string {
  return getText(s, lang, token + '.text');
}

export function foundText(s: Scenario, lang: string, token: string): string {
  const e = foundEvent(s, token);
  return e ? getText(s, lang, e + '.text') : '';
}

export function setFoundText(s: Scenario, lang: string, token: string, text: string): Scenario {
  const e = foundEvent(s, token);
  return e ? setText(s, lang, e + '.text', text) : s;
}

// --- doors -------------------------------------------------------------------------------------

export type DoorMode = 'open' | 'key' | 'skill' | 'monster';

export const DOOR_MODES: { id: DoorMode; icon: string; title: string; what: string }[] = [
  { id: 'open', icon: '🚪', title: 'Просто открывается', what: 'Игроки нажимают на дверь, и она исчезает с карты.' },
  { id: 'key', icon: '🗝', title: 'Нужен ключ', what: 'Дверь заперта, пока сыщики не найдут ключ. Ключ лежит под жетоном, который сайт добавит на карту.' },
  { id: 'skill', icon: '🎲', title: 'Проверка навыка', what: 'Игроки бросают кубики. Успех открывает дверь, провал нет.' },
  { id: 'monster', icon: '👹', title: 'За дверью монстр', what: 'Когда дверь открывается, на поле выходит монстр.' },
];

export function doorModeOf(s: Scenario, door: string): DoorMode {
  const c = getComponent(s, door);
  const made = s.components.filter((x) => x.data.comment === MADE + door);
  if (made.some((x) => x.type === 'Spawn')) return 'monster';
  if ((c?.data.event1Condition ?? '') !== '') return 'key';
  if (made.some((x) => x.type === 'Event' && x.data.buttons === '2')) return 'skill';
  return 'open';
}

export function setDoorMode(s: Scenario, lang: string, door: string, mode: DoorMode, monster = ''): { scenario: Scenario; facts: Record<string, string> } {
  if (!getComponent(s, door)) return { scenario: s, facts: {} };
  const facts: Record<string, string> = {};
  let out = clearMade(s, door);
  out = updateData(out, door, { buttons: '1', event1: '', event2: undefined, event1Condition: undefined, event1ConditionAction: undefined, button2: undefined });
  if (getText(out, lang, door + '.text') === '' || /^(Дверь|Игроки|Вы)/.test(getText(out, lang, door + '.text'))) {
    out = setText(out, lang, door + '.text', mode === 'key' ? 'Дверь заперта. Здесь нужен ключ.' : mode === 'skill' ? 'Дверь заклинило. Попробуйте её открыть.' : 'Дверь, за которой что-то есть.');
  }
  const label = (key: string, text: string) => setText(out, lang, key, text);
  const open = (extra: Record<string, string> = {}) => {
    let o: string;
    [out, o] = addComponent(out, 'Event', { remove: door, ...extra, ...mark(door) }, 'DoorOpen');
    out = setText(setText(out, lang, o + '.text', 'Дверь открывается.'), lang, o + '.button1', 'Продолжить');
    return o;
  };
  switch (mode) {
    case 'open': {
      const o = open();
      out = setButtonTargets(label(door + '.button1', 'Открыть дверь'), door, 1, [o]);
      break;
    }
    case 'key': {
      const fact = factId('Есть ключ', Object.keys(facts));
      let key: string;
      const c = getComponent(out, door)!;
      const p = position(c) ?? { x: 0, y: 0 };
      [out, key] = addComponent(out, 'Token', { type: 'TokenSearch', xposition: fmt(p.x + 1.75), yposition: fmt(p.y), operations: `${fact},=,1`, ...mark(door) }, 'Key');
      out = setText(setText(out, lang, key + '.text', 'Вы нашли ключ. Теперь им можно открыть запертую дверь.'), lang, key + '.button1', 'Забрать');
      // The key shows up on the map together with the door.
      for (const e of addedBy(out, door)) out = updateData(out, e, { add: [...list(getComponent(out, e)?.data.add), key].join(' ') });
      const o = open();
      out = updateData(out, door, { buttons: '2', event2: '', event1Condition: `VarOperation:${fact},>,0` });
      out = setButtonTargets(out, door, 1, [o]);
      out = setText(setText(out, lang, door + '.button1', 'Открыть дверь'), lang, door + '.button2', 'Отойти');
      facts[fact] = 'Есть ключ';
      break;
    }
    case 'skill': {
      let check: string, fail: string;
      const o = open();
      [out, check] = addComponent(out, 'Event', { buttons: '2', event1: '', event2: '', ...mark(door) }, 'DoorCheck');
      [out, fail] = addComponent(out, 'Event', mark(door), 'DoorStuck');
      out = setButtonTargets(setButtonTargets(out, check, 1, [o]), check, 2, [fail]);
      out = setText(out, lang, check + '.text', 'Проверьте {strength}, чтобы открыть дверь. Бросьте кубики и нажмите нужную кнопку.');
      out = setText(setText(out, lang, check + '.button1', 'Успех'), lang, check + '.button2', 'Провал');
      out = setText(setText(out, lang, fail + '.text', 'Дверь не поддаётся.'), lang, fail + '.button1', 'Продолжить');
      out = setButtonTargets(setText(out, lang, door + '.button1', 'Открыть дверь'), door, 1, [check]);
      break;
    }
    case 'monster': {
      let spawn: string;
      const o = open();
      [out, spawn] = addComponent(out, 'Spawn', { monster: monster || catalog.monsters[0]?.id || '', ...mark(door) }, 'Behind');
      out = setText(setText(out, lang, spawn + '.text', 'За дверью был монстр!'), lang, spawn + '.button1', 'Продолжить');
      out = setButtonTargets(out, o, 1, [spawn]);
      out = setButtonTargets(setText(out, lang, door + '.button1', 'Открыть дверь'), door, 1, [o]);
      break;
    }
  }
  return { scenario: out, facts };
}
