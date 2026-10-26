// Ready-made pieces of a scenario: the new-scenario wizard and one-click patterns.
// Everything here is pure: it returns a new Scenario and never touches the store.

import catalog from '../content/catalog.json';
import { newScenario, type Scenario } from '../format/scenario';
import { factId } from './facts';
import { addComponent, buttonsOf, fmt, getComponent, setButtonTargets, setText, SNAP_TOKEN, updateData } from './ops';

export interface WizardAnswers {
  title: string;
  intro: string;
  goal: string;
  winText: string;
  loseText: string;
  minhero: number;
  maxhero: number;
  tile: string; // catalog tile id of the first room
}

export const DEFAULT_TILE = catalog.tiles[0]?.id ?? '';

export const WIZARD_DEFAULTS: WizardAnswers = {
  title: '',
  intro: '',
  goal: '',
  winText: 'Вы справились. Тайна раскрыта, и кошмар отступает.',
  loseText: 'Сыщиков больше нет. Тьма поглощает дом.',
  minhero: 1,
  maxhero: 5,
  tile: DEFAULT_TILE,
};

// A working skeleton: intro -> goal -> win, plus a defeat that fires when all investigators fall.
export function wizardScenario(a: WizardAnswers, lang: string): { scenario: Scenario; notes: string } {
  let s = newScenario(lang);
  s = { ...s, quest: { ...s.quest, minhero: String(a.minhero), maxhero: String(a.maxhero) } };
  s = setText(s, lang, 'quest.name', a.title.trim() || 'Новый сценарий');
  s = setText(s, lang, 'quest.description', a.intro.trim());

  let tile = '';
  if (a.tile) {
    [s, tile] = addComponent(s, 'Tile', { side: a.tile, xposition: '0', yposition: '0' }, a.tile.replace(/^TileSide/, ''));
  }
  let goal: string, win: string, lose: string;
  [s, goal] = addComponent(s, 'Event', {}, 'Goal');
  [s, win] = addComponent(s, 'Event', { operations: '$end,=,1' }, 'Win');
  [s, lose] = addComponent(s, 'Event', { trigger: 'Eliminated', operations: '$end,=,1' }, 'Lose');

  s = updateData(s, 'EventStart', { event1: goal, ...(tile ? { add: tile } : {}) });
  s = setText(s, lang, 'EventStart.text', a.intro.trim() || 'Вступление к вашему сценарию.');
  s = setText(s, lang, 'EventStart.button1', 'Начать расследование');
  s = setText(s, lang, goal + '.text', a.goal.trim() ? `Ваша цель: ${a.goal.trim()}` : 'Здесь объясните игрокам, что нужно сделать.');
  s = setText(s, lang, goal + '.button1', 'Цель выполнена');
  s = setButtonTargets(s, goal, 1, [win]);
  s = setText(s, lang, win + '.text', a.winText.trim());
  s = setText(s, lang, win + '.button1', 'Завершить');
  s = setText(s, lang, lose + '.text', a.loseText.trim());
  s = setText(s, lang, lose + '.button1', 'Завершить');

  const notes = [
    `# ${a.title.trim() || 'Новый сценарий'}`,
    '',
    '## Завязка',
    a.intro.trim(),
    '',
    '## Главная цель',
    a.goal.trim(),
    '',
    '## Концовки',
    `- Победа: ${a.winText.trim()}`,
    `- Поражение: ${a.loseText.trim()}`,
    '',
  ].join('\n');
  return { scenario: s, notes };
}

// --- one-click patterns ---------------------------------------------------------------

export interface Template {
  id: string;
  icon: string;
  title: string;
  what: string; // what it builds, in plain words
  needsEvent: boolean; // true when it is a chain of events that hangs on a button
}

export const TEMPLATES: Template[] = [
  {
    id: 'search',
    icon: '🔍',
    title: 'Жетон с находкой',
    what: 'Жетон на карте. Игрок нажимает на него, видит описание, а следом получает находку.',
    needsEvent: false,
  },
  {
    id: 'locked-door',
    icon: '🚪',
    title: 'Запертая дверь и ключ',
    what: 'Дверь на карте и жетон с ключом. Пока ключ не найден, кнопка «Открыть дверь» серая. Когда ключ найден, дверь можно открыть, и она исчезнет с карты.',
    needsEvent: false,
  },
  {
    id: 'ambush',
    icon: '👹',
    title: 'Засада монстра',
    what: 'Событие с описанием, а следом монстр выходит на поле.',
    needsEvent: true,
  },
  {
    id: 'choice',
    icon: '🔀',
    title: 'Развилка: два варианта',
    what: 'Событие с двумя кнопками, каждая ведёт к своему продолжению.',
    needsEvent: true,
  },
  {
    id: 'check',
    icon: '🎲',
    title: 'Проверка навыка',
    what: 'Событие, где игроки бросают кубики и нажимают «Успех» или «Провал». Каждый исход ведёт к своему продолжению.',
    needsEvent: true,
  },
  {
    id: 'win',
    icon: '🏆',
    title: 'Победа',
    what: 'Событие, которое завершает сценарий победой.',
    needsEvent: true,
  },
  {
    id: 'lose',
    icon: '💀',
    title: 'Поражение',
    what: 'Событие, которое завершает сценарий поражением.',
    needsEvent: true,
  },
];

export interface Hook {
  event: string; // event whose button leads to the new chain (or which shows the new objects)
  button: number;
}

export interface Built {
  scenario: Scenario;
  first: string; // component to select afterwards
  events: string[]; // new event-like components, for the story graph
  facts: Record<string, string>; // names of new facts, to be remembered by the editor
}

function freeSpot(s: Scenario): { xposition: string; yposition: string } {
  const n = s.components.filter((c) => c.type === 'Token' || c.type === 'Door').length;
  return { xposition: fmt((n % 6) * SNAP_TOKEN * 2), yposition: fmt(-Math.floor(n / 6) * SNAP_TOKEN * 2 - 3.5) };
}

function showFrom(s: Scenario, hook: Hook | undefined, names: string[]): Scenario {
  const host = hook?.event ?? s.components.find((c) => c.data.trigger === 'EventStart')?.name;
  const c = host ? getComponent(s, host) : undefined;
  if (!c) return s;
  const add = (c.data.add ?? '').split(/\s+/).filter(Boolean);
  return updateData(s, c.name, { add: [...add, ...names.filter((n) => !add.includes(n))].join(' ') });
}

function link(s: Scenario, hook: Hook | undefined, target: string): Scenario {
  const c = hook && getComponent(s, hook.event);
  const b = c && buttonsOf(c).find((x) => x.index === hook.button);
  return b ? setButtonTargets(s, c.name, b.index, [...b.targets, target]) : s;
}

export function buildTemplate(s: Scenario, lang: string, id: string, hook?: Hook, labels: Record<string, string> = {}): Built | null {
  const firstMonster = catalog.monsters[0]?.id ?? '';
  const t = (sc: Scenario, name: string, text: string, button?: string) => {
    let out = setText(sc, lang, name + '.text', text);
    if (button !== undefined) out = setText(out, lang, name + '.button1', button);
    return out;
  };
  switch (id) {
    case 'search': {
      let out: Scenario, token: string, found: string;
      [out, found] = addComponent(s, 'Event', {}, 'Found');
      [out, token] = addComponent(out, 'Token', { type: 'TokenSearch', ...freeSpot(out), event1: found }, 'Search');
      out = t(out, token, 'Вы осматриваете это место. Опишите, что видят сыщики.', 'Искать дальше');
      out = t(out, found, 'Вы нашли что-то важное. Опишите находку.', 'Забрать');
      out = showFrom(out, hook, [token]);
      return { scenario: out, first: token, events: [token, found], facts: {} };
    }
    case 'locked-door': {
      let out: Scenario, door: string, key: string, open: string;
      const taken = Object.keys(labels);
      const fact = factId('Есть ключ', taken);
      const label = fact === 'est_klyuch' ? 'Есть ключ' : 'Есть ключ ' + fact.split('_').pop();
      [out, key] = addComponent(s, 'Token', { type: 'TokenSearch', ...freeSpot(s), operations: `${fact},=,1` }, 'Key');
      [out, door] = addComponent(out, 'Door', { ...freeSpot(out), buttons: '2', event1: '', event2: '' }, 'Locked');
      [out, open] = addComponent(out, 'Event', { remove: door }, 'DoorOpen');
      out = setButtonTargets(out, door, 1, [open]);
      out = updateData(out, door, { event1Condition: `VarOperation:${fact},>,0` });
      out = t(out, door, 'Дверь заперта. Здесь нужен ключ.');
      out = setText(setText(out, lang, door + '.button1', 'Открыть дверь'), lang, door + '.button2', 'Отойти');
      out = t(out, open, 'Ключ подошёл, и дверь открывается.', 'Продолжить');
      out = t(out, key, 'Вы нашли ключ. Теперь им можно открыть запертую дверь.', 'Забрать');
      out = showFrom(out, hook, [door, key]);
      return { scenario: out, first: door, events: [door, key, open], facts: { [fact]: label } };
    }
    case 'ambush': {
      // In Valkyrie a monster appears when its Spawn is reached by a button (add= only places tiles, doors, tokens and pictures).
      let out: Scenario, ev: string, spawn: string;
      [out, ev] = addComponent(s, 'Event', {}, 'Ambush');
      [out, spawn] = addComponent(out, 'Spawn', { monster: firstMonster }, 'Ambush');
      out = setButtonTargets(out, ev, 1, [spawn]);
      out = t(out, ev, 'Из темноты на вас бросается чудовище!', 'К бою');
      out = t(out, spawn, 'Монстр вышел на поле. Опишите, что видят сыщики.', 'Продолжить');
      out = link(out, hook, ev);
      return { scenario: out, first: ev, events: [ev, spawn], facts: {} };
    }
    case 'choice': {
      let out: Scenario, ev: string, a: string, b: string;
      [out, ev] = addComponent(s, 'Event', { buttons: '2', event1: '', event2: '' }, 'Choice');
      [out, a] = addComponent(out, 'Event', {}, 'ChoiceA');
      [out, b] = addComponent(out, 'Event', {}, 'ChoiceB');
      out = setButtonTargets(setButtonTargets(out, ev, 1, [a]), ev, 2, [b]);
      out = t(out, ev, 'Перед сыщиками встаёт выбор. Опишите ситуацию.');
      out = setText(setText(out, lang, ev + '.button1', 'Вариант А'), lang, ev + '.button2', 'Вариант Б');
      out = t(out, a, 'Что происходит, если выбран вариант А?', 'Продолжить');
      out = t(out, b, 'Что происходит, если выбран вариант Б?', 'Продолжить');
      out = link(out, hook, ev);
      return { scenario: out, first: ev, events: [ev, a, b], facts: {} };
    }
    case 'check': {
      let out: Scenario, ev: string, pass: string, fail: string;
      [out, ev] = addComponent(s, 'Event', { buttons: '2', event1: '', event2: '' }, 'Check');
      [out, pass] = addComponent(out, 'Event', {}, 'CheckPass');
      [out, fail] = addComponent(out, 'Event', {}, 'CheckFail');
      out = setButtonTargets(setButtonTargets(out, ev, 1, [pass]), ev, 2, [fail]);
      out = t(out, ev, 'Проверьте {will}. Опишите, что нужно преодолеть. Бросьте кубики и нажмите нужную кнопку.');
      out = setText(setText(out, lang, ev + '.button1', 'Успех'), lang, ev + '.button2', 'Провал');
      out = t(out, pass, 'Проверка пройдена. Что происходит?', 'Продолжить');
      out = t(out, fail, 'Проверка провалена. Что происходит?', 'Продолжить');
      out = link(out, hook, ev);
      return { scenario: out, first: ev, events: [ev, pass, fail], facts: {} };
    }
    case 'win':
    case 'lose': {
      const win = id === 'win';
      let out: Scenario, ev: string;
      [out, ev] = addComponent(s, 'Event', { operations: '$end,=,1', ...(hook ? {} : win ? {} : { trigger: 'Eliminated' }) }, win ? 'Win' : 'Lose');
      out = t(out, ev, win ? 'Сыщики победили. Опишите финал.' : 'Сыщики потерпели поражение. Опишите финал.', 'Завершить');
      out = link(out, hook, ev);
      return { scenario: out, first: ev, events: [ev], facts: {} };
    }
  }
  return null;
}
