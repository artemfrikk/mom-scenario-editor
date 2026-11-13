// The constructor's project -> a Valkyrie scenario. Everything the author never sees is decided here:
// which event shows which room, how a room appears once, how monsters come out, how the game is won.
//
// The pieces are tied together with Valkyrie's own "custom triggers" (EventManager.AddCustomTriggers):
// an outcome sets @open_R2 to 1, and the event with trigger=Varopen_R2 runs right after it. So one room
// can be opened by several doors, and one outcome can open several rooms and call several monsters.

import catalog from '../content/catalog.json';
import { CURRENT_FORMAT, type QComponent, type Scenario } from '../format/scenario';
import { setIntro } from '../model/intro';
import { allOutcomes, PACE, chapterPath, doneVar, markVar, PROJECT_FILE, startRoom, type Assets, type Piece, type Project, type Harm, type PuzzleSpec, type Room, type SkillTest } from './project';

export const LANG = 'Russian';

const PACK_OF = new Map<string, string>(
  [...catalog.tiles, ...catalog.monsters, ...catalog.tokens, ...catalog.items].map((x) => [x.id, (x as { pack?: string }).pack ?? 'MoMBase']),
);

// Names inside the files. Imported rooms keep the tile name they came with.
export const tileName = (r: Room) => 'Tile' + r.id;
// The investigators' weapon kinds in Valkyrie's MoM attack window (content attacks.ini).
export const ATTACK_TYPES = ['heavy', 'bladed', 'firearm', 'spell', 'unarmed'];

// A monster with its own name or texts becomes a CustomMonster built on the figure from the box.
export const customMonster = (x: Piece) =>
  x.kind === 'monster' && (x.title.trim() || Object.values(x.voice ?? {}).some((t) => t?.trim())) ? 'CustomMonster' + x.id : undefined;
const horrorName = (x: Piece) => 'EventHorror' + x.id;

export const tokenName = (x: Piece) => (x.kind === 'monster' ? 'Spawn' : 'Token') + x.id;
const actName = (x: Piece) => 'Event' + x.id;
const defeatName = (x: Piece) => 'EventDefeated' + x.id;
const openName = (r: Room) => 'EventOpen' + r.id;
const itemName = (x: Piece) => 'QItem' + x.id;
const passName = (x: Piece) => 'EventPass' + x.id;
const failName = (x: Piece) => 'EventFail' + x.id;
const lockedName = (x: Piece) => 'EventLocked' + x.id;
const choiceName = (x: Piece, c: string) => 'EventAnswer' + x.id + c;
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

// Valkyrie's own mythos events read these flags (as in SmugglersPoint): the higher, the nastier.
const MYTHOS_FLAGS: Record<number, [number, number, number, number]> = { 0: [1, 0, 0, 0], 1: [1, 1, 0, 0], 2: [0, 1, 1, 0], 3: [0, 0, 1, 1] };
// In "only" mode the game's own mythos events stay silent: every flag is off.
const NO_MYTHOS = ['$mythosFlavor,=,0', '$mythosMinor,=,0', '$mythosMajor,=,0', '$mythosDeadly,=,0', '$mythosHelp,=,0'];

export function mythosOps(level: number): string[] {
  const [flavor, minor, major, deadly] = MYTHOS_FLAGS[level] ?? MYTHOS_FLAGS[1];
  return [`$mythosFlavor,=,${flavor}`, `$mythosMinor,=,${minor}`, `$mythosMajor,=,${major}`, `$mythosDeadly,=,${deadly}`, '$mythosHelp,=,0'];
}

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
  const levelOps = (level: number) => (p.mythos?.mode === 'only' && p.mythos.own?.length ? NO_MYTHOS : mythosOps(level));
  const rawEvents = p.raw?.components ?? [];
  const rawHas = (trigger: string) => rawEvents.some((c) => c.data.trigger === trigger);
  const monsters = p.pieces.filter((x) => x.kind === 'monster');
  const roomById = new Map(p.rooms.map((r) => [r.id, r]));
  // pieces something else waits for: their result is remembered in a variable
  const needed = new Set(p.pieces.flatMap((x) => x.outcome.lock?.needs ?? []).flatMap((n) => [n, n.split('.')[0]]));

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
    if (needed.has(x.id)) ops.push(`${doneVar(x.id)},=,1`);
    for (const m of o.remember ?? []) ops.push(`${markVar(m)},=,1`);
    if (o.win) ops.push('@win,=,1');
    return ops;
  };
  const outcomeEvent = (name: string, x: Piece, extra: Record<string, string | undefined> = {}, item = itemName(x)) => {
    const o = x.outcome;
    const ops = operations(x);
    const remove = o.once && x.kind !== 'monster' ? tokenName(x) : undefined;
    let shown = o.text.trim();
    if (o.clues) shown += (shown ? '\n\n' : '') + `<i>Сыщик получает ${o.clues > 1 ? `улики: ${o.clues}` : 'улику'}.</i>`;
    put(name, 'Event', 'events.ini', {
      display: shown ? undefined : 'false',
      buttons: '1',
      event1: '',
      add: o.item ? item : undefined,
      remove,
      operations: ops.join(' ') || undefined,
      audio: o.sound || undefined,
      ...extra,
    });
    text(name + '.text', shown);
    if (shown) text(name + '.button1', 'Далее');
    if (o.item) put(item, 'QItem', 'items.ini', { itemname: o.item, starting: 'False' });
  };

  // What using a piece does: the words, then a test, a puzzle or answers, and the result. `when` adds tests of its own.
  const actEvents = (x: Piece, when?: string, extra: Record<string, string | undefined> = {}) => {
    const o = x.outcome;
    const lock = o.lock?.needs.length ? o.lock : undefined;
    const vartests = [when, ...(lock ? lock.needs.map((n) => `VarOperation:${doneVar(n)},==,1`) : [])].filter(Boolean).join(' ') || undefined;
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
    const choices = o.choices?.filter((c) => c.label.trim()) ?? [];
    if (choices.length) {
      // A conversation: one button per answer, each answer has its own result and is remembered.
      const data: Record<string, string | undefined> = { buttons: String(choices.length), vartests, audio: o.sound || undefined };
      choices.forEach((c, i) => (data['event' + (i + 1)] = choiceName(x, c.id)));
      put(actName(x), 'Event', 'events.ini', data);
      text(actName(x) + '.text', o.text.trim() || '…');
      choices.forEach((c, i) => text(actName(x) + '.button' + (i + 1), c.label.trim()));
      for (const c of choices) {
        const name = choiceName(x, c.id);
        outcomeEvent(name, { ...x, outcome: { ...c.outcome, once: o.once } }, {}, itemName(x) + c.id);
        if (needed.has(`${x.id}.${c.id}`)) {
          const ev = comps.find((q) => q.name === name)!;
          ev.data.operations = [ev.data.operations, `${doneVar(`${x.id}.${c.id}`)},=,1`].filter(Boolean).join(' ');
        }
      }
      return;
    }
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
      return;
    }
    if (!test) {
      outcomeEvent(actName(x), x, { vartests, ...extra });
      return;
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
    };

  for (const x of p.pieces) {
    if (x.kind === 'start' || x.kind === 'mark') continue;
    if (x.kind === 'monster') {
      const r = roomById.get(x.room);
      put(tokenName(x), 'Spawn', 'spawns.ini', {
        xposition: num(x.x),
        yposition: num(x.y),
        trigger: `Varspawn_${x.id}`,
        monster: customMonster(x) ?? x.look,
        buttons: '1',
        event1: '',
        vartests: `VarOperation:spawned_${x.id},==,0`,
        operations: `spawned_${x.id},=,1`,
      });
      text(tokenName(x) + '.text', x.title.trim() ? `Появляется ${x.title.trim()}!` : r ? 'Из темноты появляется чудовище!' : '');
      text(tokenName(x) + '.button1', 'Далее');
      if (p.moreMonsters && !x.outcome.win) {
        // more investigators, more monsters: an ordinary monster comes with a twin (not the one whose defeat wins)
        put(tokenName(x) + 'Twin', 'Spawn', 'spawns.ini', {
          xposition: num(x.x + 1),
          yposition: num(x.y),
          trigger: `Varspawn_${x.id}`,
          monster: customMonster(x) ?? x.look,
          buttons: '1',
          event1: '',
          vartests: `VarOperation:#heroes,>=,4 VarOperation:twin_${x.id},==,0`,
          operations: `twin_${x.id},=,1`,
        });
        text(tokenName(x) + 'Twin.text', 'С ним приходит ещё один!');
        text(tokenName(x) + 'Twin.button1', 'Далее');
      }
      const own = customMonster(x);
      if (own) {
        const v = x.voice ?? {};
        const say = (t?: string) => t?.trim() ?? '';
        put(own, 'CustomMonster', 'monsters.ini', {
          base: x.look,
          activation: say(v.attack) ? x.id : undefined,
          attacks: say(v.hit) ? ATTACK_TYPES.map((t) => t + ':1').join(' ') : undefined,
          horrorevent: say(v.horror) ? horrorName(x) : undefined,
        });
        text(own + '.monstername', x.title);
        if (say(v.attack)) {
          // Valkyrie's monster phase: how it moves, then "Монстр атакует" or "Никого рядом"
          put('Activation' + x.id, 'Activation', 'monsters.ini', {});
          text('Activation' + x.id + '.ability', say(v.move) || '{0} движется на 2 клетки к ближайшему сыщику.');
          text('Activation' + x.id + '.master', say(v.attack));
          text('Activation' + x.id + '.movebutton', 'Никого рядом');
          text('Activation' + x.id + '.move', '{0} ничего не делает и ждёт.');
        }
        for (const t of say(v.hit) ? ATTACK_TYPES : []) text(`${own}.Attack_${t}_1`, say(v.hit));
        if (say(v.horror)) {
          put(horrorName(x), 'Event', 'events.ini', { buttons: '1', event1: '' });
          text(horrorName(x) + '.text', say(v.horror));
          text(horrorName(x) + '.button1', 'Далее');
        }
      }
      const o = x.outcome;
      if (o.text.trim() || o.win || o.reveal?.length || o.spawn?.length || o.clues || o.item || o.remember?.length || needed.has(x.id)) {
        outcomeEvent(defeatName(x), x, { trigger: 'Defeated' + tokenName(x) });
      }
      continue;
    }
    actEvents(x);
  }

  // A room appears once, however many doors lead to it.
  const start = startRoom(p);
  const revealed = new Set(allOutcomes(p).flatMap((o) => o.reveal ?? []));
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
    const startOps = [...(p.mythos ? levelOps(p.mythos.level) : []), ...(start ? comesOut(start).map((m) => `@spawn_${m.id},=,1`) : [])];
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
  // The end of a chapter: the game ends, or the button opens the next chapter of the campaign.
  const ending = (how: 'win' | 'lose') => {
    const to = p.next?.[how];
    return to ? { event1: chapterPath(to), operations: undefined, button: 'Следующая глава' } : { event1: '', operations: '$end,=,1', button: 'Завершить' };
  };

  // --- time: Valkyrie's own mythos events get stronger, and the author's events come in their rounds ---
  // With "adapt", every round below is kept in a variable set at the start for the number of investigators.
  const adapt = !!p.mythos?.adapt;
  const due: [string, number][] = [];
  const roundTest = (key: string, round: number, op: '==' | '>=') => {
    if (!adapt) return `VarOperation:#round,${op},${round}`;
    due.push([key, round]);
    return `VarOperation:#round,${op},${key}`;
  };
  for (const r of p.mythos?.rises ?? []) {
    if (r.round < 2) continue;
    // set at the end of the round before, so the mythos phase of this round is already stronger
    const ops = levelOps(r.level).join(' ');
    if (adapt) put(`EventMythos${r.round}`, 'Event', 'events.ini', { trigger: 'EndRound', display: 'false', buttons: '1', event1: '', vartests: roundTest(`due_rise${r.round}`, r.round - 1, '=='), operations: ops });
    else put(`EventMythos${r.round}`, 'Event', 'events.ini', { trigger: `EndRound${r.round - 1}`, display: 'false', buttons: '1', event1: '', operations: ops });
  }
  for (const t of p.timeline ?? []) {
    const name = 'EventTime' + t.id;
    const x: Piece = { id: t.id, room: '', kind: 'interact', look: '', x: 0, y: 0, title: '', outcome: { ...t.outcome, once: false } };
    outcomeEvent(name, x, { trigger: 'Mythos', vartests: roundTest(`due_${t.id}`, t.round, t.every ? '>=' : '==') });
    if (t.lose) {
      const c = comps.find((q) => q.name === name)!;
      const e = ending('lose');
      c.data.operations = [c.data.operations, e.operations].filter(Boolean).join(' ');
      c.data.event1 = e.event1;
      delete c.data.display;
      text(name + '.text', t.outcome.text.trim() || p.loseText || 'Время вышло.');
      text(name + '.button1', e.button);
    }
  }

  if (due.length) {
    // one hidden event per group of investigators; Valkyrie runs every EventStart event at the start
    const groups: [string, string, number][] = [
      ['1', 'VarOperation:#heroes,<=,1', PACE[1]],
      ['2', 'VarOperation:#heroes,==,2', PACE[2]],
      ['3', 'VarOperation:#heroes,>=,3 VarOperation:#heroes,<=,4', PACE[3]],
      ['5', 'VarOperation:#heroes,>=,5', PACE[5]],
    ];
    for (const [id, test, shift] of groups) {
      put('EventPace' + id, 'Event', 'events.ini', {
        trigger: 'EventStart',
        display: 'false',
        buttons: '1',
        event1: '',
        vartests: test,
        operations: due.map(([key, round]) => `${key},=,${Math.max(1, round + shift)}`).join(' '),
      });
    }
  }

  // The author's own mythos events: a hidden pool picks one at random, like Valkyrie's PerilMythosPool.
  const cards = p.mythos?.own?.filter((c) => c.outcome.text.trim() || c.outcome.test) ?? [];
  if (cards.length) {
    const names: string[] = [];
    for (const c of cards) {
      const x: Piece = { id: c.id, room: '', kind: 'interact', look: '', x: 0, y: 0, title: '', outcome: { ...c.outcome, once: false, lock: undefined, puzzle: undefined, choices: undefined } };
      const when = [c.from > 1 ? `VarOperation:#round,>=,${c.from}` : '', c.once ? `VarOperation:used_${c.id},==,0` : ''].filter(Boolean).join(' ');
      actEvents(x, when || undefined);
      const ev = comps.find((q) => q.name === actName(x))!;
      if (c.once) ev.data.operations = [ev.data.operations, `used_${c.id},=,1`].filter(Boolean).join(' ');
      names.push(actName(x));
    }
    // along with Valkyrie's events, about every second round brings one of the author's
    const quiet = p.mythos?.mode === 'only' ? [] : names.map((_, i) => `EventMythosQuiet${i + 1}`);
    for (const q of quiet) put(q, 'Event', 'events.ini', { display: 'false', buttons: '1', event1: '' });
    put('EventMythosOwn', 'Event', 'events.ini', { trigger: 'Mythos', randomevents: 'true', display: 'false', buttons: '1', event1: [...names, ...quiet].join(' ') });
  }

  if (!p.raw || allOutcomes(p).some((o) => o.win)) {
    const e = ending('win');
    put(WIN, 'Event', 'events.ini', { trigger: 'Varwin', buttons: '1', event1: e.event1, operations: e.operations });
    text(WIN + '.text', p.winText || 'Победа!');
    text(WIN + '.button1', e.button);
  }
  if (!rawHas('Eliminated')) {
    const e = ending('lose');
    put(LOSE, 'Event', 'events.ini', { trigger: 'Eliminated', buttons: '1', event1: e.event1, operations: e.operations });
    text(LOSE + '.text', p.loseText || 'Поражение.');
    text(LOSE + '.button1', e.button);
  }

  // --- the scenario card ---
  const packs = [...new Set([...usedPacks(p), ...(p.raw?.quest.packs ?? '').split(/\s+/).filter(Boolean)])].sort();
  const quest: Record<string, string> = {
    ...(p.raw?.quest ?? {}),
    format: CURRENT_FORMAT,
    hidden: p.chapter && p.chapter !== 'ch1' ? 'True' : 'False',
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
