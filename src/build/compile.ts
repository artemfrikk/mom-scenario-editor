// The constructor's project -> a Valkyrie scenario. Everything the author never sees is decided here:
// which event shows which room, how a room appears once, how monsters come out, how the game is won.
//
// The pieces are tied together with Valkyrie's own "custom triggers" (EventManager.AddCustomTriggers):
// an outcome sets @open_R2 to 1, and the event with trigger=Varopen_R2 runs right after it. So one room
// can be opened by several doors, and one outcome can open several rooms and call several monsters.

import catalog from '../content/catalog.json';
import { CURRENT_FORMAT, type QComponent, type Scenario } from '../format/scenario';
import { setIntro } from '../model/intro';
import { PROJECT_FILE, startRoom, type Assets, type Piece, type Project, type Harm, type PuzzleSpec, type Room, type SkillTest } from './project';

export const LANG = 'Russian';

const PACK_OF = new Map<string, string>(
  [...catalog.tiles, ...catalog.monsters, ...catalog.tokens, ...catalog.items].map((x) => [x.id, (x as { pack?: string }).pack ?? 'MoMBase']),
);

// Names inside the files. Imported rooms keep the tile name they came with.
export const tileName = (r: Room) => 'Tile' + r.id;
export const tokenName = (x: Piece) => (x.kind === 'monster' ? 'Spawn' : 'Token') + x.id;
const actName = (x: Piece) => 'Event' + x.id;
const defeatName = (x: Piece) => 'EventDefeated' + x.id;
const openName = (r: Room) => 'EventOpen' + r.id;
const itemName = (x: Piece) => 'QItem' + x.id;
const passName = (x: Piece) => 'EventPass' + x.id;
const failName = (x: Piece) => 'EventFail' + x.id;
const lockedName = (x: Piece) => 'EventLocked' + x.id;
const puzzleName = (x: Piece) => 'Puzzle' + x.id;
const START = 'EventStart';
const GOAL = 'EventGoal';
const WIN = 'EventWin';
const LOSE = 'EventLose';

const num = (n: number) => String(Math.round(n * 1e4) / 1e4);

export const KIND_TOKEN: Record<string, string> = {
  start: 'TokenInvestigators',
  search: 'TokenSearch',
  explore: 'TokenExplore',
  interact: 'TokenInteract',
  sight: 'TokenSight',
};

// "Проверка {lore}": Valkyrie draws the skill's symbol in place of the tag.
export function testText(before: string, t: SkillTest): string {
  const line = `<b>Проверка {${t.skill}}</b>` + (t.need > 1 ? `, нужно ${t.need} {success}` : '');
  return (before.trim() ? before.trim() + '\n\n' : '') + line;
}

// "Сыщик получает 2 урона", "Каждый сыщик в этой комнате получает 1 ужас".
export function harmText(h: Harm): string {
  const word = h.kind === 'damage' ? (h.amount === 1 ? 'урон' : 'урона') : h.amount === 1 ? 'ужас' : 'ужаса';
  return `${h.who === 'all' ? 'Каждый сыщик в этой комнате получает' : 'Сыщик получает'} ${h.amount} ${word}.`;
}

const PUZZLE_HINT: Record<PuzzleSpec['kind'], string> = {
  slide: 'Выдвиньте выделенный брусок наружу.',
  code: 'Подберите верную комбинацию.',
  image: 'Соберите картинку.',
  tower: 'Перенесите все кольца на одну башню.',
};
const puzzleHint = (p: PuzzleSpec) => PUZZLE_HINT[p.kind];

export function usedPacks(p: Project): string[] {
  const ids = [...p.rooms.map((r) => r.tile), ...p.pieces.map((x) => x.look), ...p.pieces.map((x) => x.outcome.item ?? '')];
  const packs = new Set<string>();
  for (const id of ids) {
    const pack = PACK_OF.get(id);
    if (pack && pack !== 'MoMBase') packs.add(pack);
  }
  return [...packs].sort();
}

export function compile(p: Project, assets: Assets = {}): Scenario {
  const comps: QComponent[] = [];
  const texts: Record<string, string> = {};
  const put = (name: string, type: QComponent['type'], source: string, data: Record<string, string | undefined>) => {
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined && v !== '') clean[k] = v;
    comps.push({ name, type, source, data: clean });
  };
  const text = (key: string, value: string) => {
    if (value.trim()) texts[key] = value.trim();
  };
  const rawEvents = p.raw?.components ?? [];
  const rawHas = (trigger: string) => rawEvents.some((c) => c.data.trigger === trigger);
  const monsters = p.pieces.filter((x) => x.kind === 'monster');
  const roomById = new Map(p.rooms.map((r) => [r.id, r]));
  // pieces something else waits for: their result is remembered in a variable
  const needed = new Set(p.pieces.flatMap((x) => x.outcome.lock?.needs ?? []));

  // --- the map ---
  for (const r of p.rooms) {
    put(tileName(r), 'Tile', 'tiles.ini', { xposition: num(r.x), yposition: num(r.y), side: r.tile, rotation: r.rot ? String(r.rot) : undefined });
  }
  // What appears together with a room: its tile and every token in it; its monsters come out right after.
  const shows = (r: Room) => [tileName(r), ...p.pieces.filter((x) => x.room === r.id && x.kind !== 'monster').map(tokenName)];
  const comesOut = (r: Room) => monsters.filter((m) => m.room === r.id && (m.when ?? 'room') === 'room');

  for (const x of p.pieces) {
    if (x.kind === 'monster') continue;
    const type = x.look || KIND_TOKEN[x.kind] || 'TokenInteract';
    const acts = x.kind !== 'start' && x.kind !== 'mark';
    put(tokenName(x), 'Token', 'tokens.ini', {
      xposition: num(x.x),
      yposition: num(x.y),
      type,
      display: 'false',
      buttons: acts ? '1' : '0',
      event1: acts ? actName(x) : undefined,
    });
  }

  // --- what happens ---
  const operations = (x: Piece): string[] => {
    const o = x.outcome;
    const ops: string[] = [];
    if (o.clues) ops.push(`clues,+,${o.clues}`);
    for (const r of o.reveal ?? []) if (roomById.has(r)) ops.push(`@open_${r},=,1`);
    for (const m of o.spawn ?? []) if (monsters.some((q) => q.id === m)) ops.push(`@spawn_${m},=,1`);
    if (needed.has(x.id)) ops.push(`done_${x.id},=,1`);
    if (o.win) ops.push('@win,=,1');
    return ops;
  };
  const outcomeEvent = (name: string, x: Piece, extra: Record<string, string | undefined> = {}) => {
    const o = x.outcome;
    const ops = operations(x);
    const remove = o.once && x.kind !== 'monster' ? tokenName(x) : undefined;
    let shown = o.text.trim();
    if (o.clues) shown += (shown ? '\n\n' : '') + `<i>Сыщик получает ${o.clues > 1 ? `улики: ${o.clues}` : 'улику'}.</i>`;
    put(name, 'Event', 'events.ini', {
      display: shown ? undefined : 'false',
      buttons: '1',
      event1: '',
      add: o.item ? itemName(x) : undefined,
      remove,
      operations: ops.join(' ') || undefined,
      audio: o.sound || undefined,
      ...extra,
    });
    text(name + '.text', shown);
    if (shown) text(name + '.button1', 'Далее');
    if (o.item) put(itemName(x), 'QItem', 'items.ini', { itemname: o.item, starting: 'False' });
  };

  for (const x of p.pieces) {
    if (x.kind === 'start' || x.kind === 'mark') continue;
    if (x.kind === 'monster') {
      const r = roomById.get(x.room);
      put(tokenName(x), 'Spawn', 'spawns.ini', {
        xposition: num(x.x),
        yposition: num(x.y),
        trigger: `Varspawn_${x.id}`,
        monster: x.look,
        buttons: '1',
        event1: '',
        vartests: `VarOperation:spawned_${x.id},==,0`,
        operations: `spawned_${x.id},=,1`,
      });
      text(tokenName(x) + '.text', x.title.trim() ? `Появляется ${x.title.trim()}!` : r ? 'Из темноты появляется чудовище!' : '');
      text(tokenName(x) + '.button1', 'Далее');
      const o = x.outcome;
      if (o.text.trim() || o.win || o.reveal?.length || o.spawn?.length || o.clues || o.item || needed.has(x.id)) {
        outcomeEvent(defeatName(x), x, { trigger: 'Defeated' + tokenName(x) });
      }
      continue;
    }
    const o = x.outcome;
    const lock = o.lock?.needs.length ? o.lock : undefined;
    const vartests = lock ? lock.needs.map((n) => `VarOperation:done_${n},==,1`).join(' ') : undefined;
    if (lock) {
      // Valkyrie runs the first event whose tests pass: the result when it is open, else "closed"
      const tok = comps.find((c) => c.name === tokenName(x));
      if (tok) tok.data.event1 = `${actName(x)} ${lockedName(x)}`;
      put(lockedName(x), 'Event', 'events.ini', { buttons: '1', event1: '' });
      text(lockedName(x) + '.text', lock.text.trim() || 'Заперто.');
      text(lockedName(x) + '.button1', 'Далее');
    }
    const test = o.test;
    const puzzle = o.puzzle;
    if (puzzle) {
      // The players read the words, then the puzzle window opens; solving it gives the gifts.
      put(actName(x), 'Event', 'events.ini', {
        display: o.text.trim() ? undefined : 'false',
        buttons: '1',
        event1: puzzleName(x),
        vartests,
        audio: o.sound || undefined,
      });
      text(actName(x) + '.text', o.text);
      if (o.text.trim()) text(actName(x) + '.button1', 'К головоломке');
      put(puzzleName(x), 'Puzzle', 'puzzles.ini', {
        class: puzzle.kind,
        skill: `{${puzzle.skill}}`,
        puzzlelevel: String(puzzle.level),
        puzzlealtlevel: puzzle.kind === 'code' || puzzle.kind === 'image' ? String(puzzle.alt) : undefined,
        image: puzzle.kind === 'image' ? puzzle.image : undefined,
        buttons: '1',
        event1: passName(x),
      });
      text(puzzleName(x) + '.text', puzzleHint(puzzle));
      text(puzzleName(x) + '.button1', 'Готово');
      outcomeEvent(passName(x), { ...x, outcome: { ...o, text: puzzle.pass, sound: undefined } });
      continue;
    }
    if (!test) {
      outcomeEvent(actName(x), x, { vartests });
      continue;
    }
    // A skill test: the players roll and press the button; the gifts come only with success.
    put(actName(x), 'Event', 'events.ini', {
      buttons: '2',
      event1: passName(x),
      event2: failName(x),
      buttoncolor1: 'green',
      buttoncolor2: 'red',
      vartests,
      audio: o.sound || undefined,
    });
    text(actName(x) + '.text', testText(o.text, test));
    text(actName(x) + '.button1', 'Успех');
    text(actName(x) + '.button2', 'Провал');
    outcomeEvent(passName(x), { ...x, outcome: { ...o, text: test.pass, sound: undefined } });
    const failText = [test.fail.trim(), test.harm && test.harm.amount > 0 ? `<i>${harmText(test.harm)}</i>` : ''].filter(Boolean).join('\n\n');
    put(failName(x), 'Event', 'events.ini', { display: failText ? undefined : 'false', buttons: '1', event1: '' });
    text(failName(x) + '.text', failText);
    if (failText) text(failName(x) + '.button1', 'Далее');
  }

  // A room appears once, however many doors lead to it.
  const start = startRoom(p);
  const revealed = new Set(p.pieces.flatMap((x) => x.outcome.reveal ?? []));
  for (const r of p.rooms) {
    if (r === start || !revealed.has(r.id)) continue;
    const opened = `opened_${r.id}`;
    const out = comesOut(r).map((m) => `@spawn_${m.id},=,1`);
    put(openName(r), 'Event', 'events.ini', {
      trigger: `Varopen_${r.id}`,
      display: r.enterText.trim() ? undefined : 'false',
      buttons: '1',
      event1: '',
      add: shows(r).join(' '),
      vartests: `VarOperation:${opened},==,0`,
      operations: [`${opened},=,1`, ...out].join(' '),
    });
    text(openName(r) + '.text', r.enterText);
    if (r.enterText.trim()) text(openName(r) + '.button1', 'Далее');
  }

  // --- the beginning and the endings ---
  if (!rawHas('EventStart')) {
    const goal = p.goal.trim();
    const startOps = start ? comesOut(start).map((m) => `@spawn_${m.id},=,1`) : [];
    put(START, 'Event', 'events.ini', {
      trigger: 'EventStart',
      buttons: '1',
      event1: goal ? GOAL : '',
      add: start ? shows(start).join(' ') : undefined,
      operations: startOps.join(' ') || undefined,
      music: p.prologue.music || undefined,
    });
    text(START + '.text', p.prologue.text || 'Начинается расследование.');
    text(START + '.button1', goal ? 'Далее' : 'Начать расследование');
    if (goal) {
      put(GOAL, 'Event', 'events.ini', { buttons: '1', event1: '' });
      text(GOAL + '.text', goal);
      text(GOAL + '.button1', 'Начать расследование');
    }
    if (start?.enterText.trim()) {
      // the first room's description is part of the beginning
      const last = goal ? GOAL : START;
      const first = comps.find((c) => c.name === last)!;
      first.data.event1 = openName(start);
      put(openName(start), 'Event', 'events.ini', { buttons: '1', event1: '' });
      text(openName(start) + '.text', start.enterText);
      text(openName(start) + '.button1', 'Далее');
    }
  }
  if (!p.raw || p.pieces.some((x) => x.outcome.win)) {
    put(WIN, 'Event', 'events.ini', { trigger: 'Varwin', buttons: '1', event1: '', operations: '$end,=,1' });
    text(WIN + '.text', p.winText || 'Победа!');
    text(WIN + '.button1', 'Завершить');
  }
  if (!rawHas('Eliminated')) {
    put(LOSE, 'Event', 'events.ini', { trigger: 'Eliminated', buttons: '1', event1: '', operations: '$end,=,1' });
    text(LOSE + '.text', p.loseText || 'Поражение.');
    text(LOSE + '.button1', 'Завершить');
  }

  // --- the scenario card ---
  const packs = [...new Set([...usedPacks(p), ...(p.raw?.quest.packs ?? '').split(/\s+/).filter(Boolean)])].sort();
  const quest: Record<string, string> = {
    ...(p.raw?.quest ?? {}),
    format: CURRENT_FORMAT,
    hidden: 'False',
    type: 'MoM',
    defaultlanguage: p.raw?.quest.defaultlanguage || LANG,
    defaultmusicon: 'True',
    minhero: String(p.minHero),
    maxhero: String(p.maxHero),
    difficulty: num(p.difficulty),
    lengthmin: String(p.lengthMin),
    lengthmax: String(p.lengthMax),
  };
  if (packs.length) quest.packs = packs.join(' ');
  else delete quest.packs;
  if (p.cover) quest.image = p.cover;
  else delete quest.image;
  text('quest.name', p.title || 'Новый сценарий');
  text('quest.description', p.description);
  text('quest.authors', p.authors);
  text('quest.synopsys', p.description.split(/(?<=[.!?])\s/)[0] ?? '');

  // Pieces kept from a scenario made elsewhere go back as they were; the constructor's own names win a clash.
  const names = new Set(comps.map((c) => c.name));
  for (const c of p.raw?.components ?? []) if (!names.has(c.name)) comps.push(c);
  const allTexts: Record<string, Record<string, string>> = {};
  for (const [lang, t] of Object.entries(p.raw?.texts ?? {})) allTexts[lang] = { ...t };
  allTexts[LANG] = { ...(allTexts[LANG] ?? {}), ...texts };

  let s: Scenario = {
    quest,
    components: comps,
    texts: allTexts,
    assets: { ...assets, [PROJECT_FILE]: new TextEncoder().encode(JSON.stringify(p)) },
  };
  // A picture in the prologue: Valkyrie's own opening screen with the picture on the left (as in SmugglersPoint).
  if (p.prologue.image && !rawHas('EventStart')) {
    s = setIntro(s, LANG, { text: texts[START + '.text'] ?? '', button: texts[START + '.button1'] ?? 'Далее', image: p.prologue.image });
  }
  return s;
}
