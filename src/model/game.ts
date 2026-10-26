// The rules of playing a scenario inside the editor. It follows what Valkyrie does
// (unity/Assets/Scripts/Quest/EventManager.cs, RoundControllerMoM.cs): a stack of events, triggers, variables,
// board pieces that appear and disappear, monsters that come out of Spawns, rounds and the mythos phase.
// Everything here is pure; the randomness is passed in so that tests can fix it.

import catalog from '../content/catalog.json';
import { isEventLike, type QComponent, type Scenario } from '../format/scenario';
import { runOps, testsPass, type Vars } from './facts';
import { buttonsOf, getComponent, getText, resolveText } from './ops';
import { newPuzzle, puzzleSolved, solvePuzzle, type PuzzleState } from './puzzles';

export interface Monster {
  spawn: string; // the Spawn that brought it
  monsterId: string; // catalog id or CustomMonster name
  name: string;
  hp: number;
  maxHp: number;
  title: string; // unique monsters have their own title
}

export interface GameState {
  heroes: string[];
  vars: Vars;
  visible: string[]; // tiles, doors, tokens and pictures on the board
  items: string[]; // quest items the investigators received
  clues: number; // clues the investigators hold
  startItems: string[]; // catalog items the investigators began with
  puzzle: PuzzleState | null; // the puzzle on the table while its window is open
  puzzles: Record<string, PuzzleState>; // puzzles put aside half way, by component name
  monsters: Monster[];
  stack: string[]; // events waiting; the last one goes first
  current: string | null; // event whose window is open
  hero: string; // the hero named by {rnd:hero} in the open window
  phase: 'investigator' | 'mythos' | 'monsters' | 'horror'; // Valkyrie's MoM round: sleuths, mythos events, monsters, horror
  round: number;
  pendingNewRound: boolean;
  ended: boolean;
  log: string[];
}

export type Rng = () => number;
const pick = <T,>(list: T[], rng: Rng): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
const list = (v: string | undefined) => (v ?? '').split(/\s+/).filter(Boolean);
const BOARD = ['Tile', 'Door', 'Token', 'UI'];

function withVar(st: GameState, name: string, value: number): GameState {
  return { ...st, vars: { ...st.vars, [name]: value } };
}

const note = (st: GameState, text: string): GameState => ({ ...st, log: [...st.log, text] });

export const MAX_START = 6;

// How the investigators begin: some clues and some items from the game, chosen by the players or at random.
export interface Start {
  clues: number;
  items: string[];
}

export const NO_START: Start = { clues: 0, items: [] };

// Everyday items (not unique to one scenario) that make a fair random start.
export function randomItems(count: number, rng: Rng = Math.random): string[] {
  const pool = catalog.items.filter((i) => i.traits.includes('common')).map((i) => i.id);
  const out: string[] = [];
  while (out.length < Math.min(MAX_START, count) && out.length < pool.length) {
    const id = pick(pool, rng);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function newGame(s: Scenario, heroes: string[], rng: Rng = Math.random, start: Start = NO_START): GameState {
  const given = s.components.filter((c) => c.type === 'QItem' && (c.data.starting ?? '').toLowerCase() === 'true').map((c) => c.name);
  let st: GameState = {
    heroes,
    vars: { '#round': 1, '#heroes': heroes.length, '#monsters': 0 },
    visible: [],
    items: given,
    clues: Math.max(0, Math.min(MAX_START, Math.floor(start.clues))),
    startItems: start.items.slice(0, MAX_START),
    puzzle: null,
    puzzles: {},
    monsters: [],
    stack: [],
    current: null,
    hero: '',
    phase: 'investigator',
    round: 1,
    pendingNewRound: false,
    ended: false,
    log: [],
  };
  // Valkyrie queues StartRound first and EventStart on top of it, so the intro comes first.
  st = queueTrigger(s, st, 'StartRound');
  st = queueTrigger(s, st, 'EventStart');
  return next(s, st, rng);
}

// --- queue --------------------------------------------------------------------------------------

export function isDisabled(s: Scenario, st: GameState, name: string): boolean {
  const c = getComponent(s, name);
  return !c || !testsPass(c.data.vartests, st.vars);
}

export function queueEvent(s: Scenario, st: GameState, name: string): GameState {
  const c = getComponent(s, name);
  if (!c) return note(st, `Предупреждение: нет события «${name}».`);
  if (isDisabled(s, st, name)) return st;
  return { ...st, stack: [...st.stack, name] };
}

export function queueTrigger(s: Scenario, st: GameState, trigger: string): GameState {
  let out = st;
  for (const c of s.components) if (isEventLike(c.type) && c.data.trigger === trigger) out = queueEvent(s, out, c.name);
  return out;
}

// --- running an event ----------------------------------------------------------------------------

function pickMonster(c: QComponent, rng: Rng): string {
  const named = list(c.data.monster);
  if (named.length) return pick(named, rng);
  const traits = list(c.data.traits);
  const pool = catalog.monsters.filter((m) => traits.every((t) => m.traits.includes(t)));
  return pool.length ? pick(pool, rng).id : '';
}

function spawnMonster(s: Scenario, st: GameState, c: QComponent, rng: Rng): GameState {
  const id = pickMonster(c, rng);
  if (!id) return note(st, `${c.name}: не выбран монстр.`);
  const custom = getComponent(s, id);
  const base = catalog.monsters.find((m) => m.id === id);
  const n = st.heroes.length;
  const health = Number(custom?.data.health ?? base?.health ?? 1);
  const perHero = Number(custom?.data.healthperhero ?? base?.healthperhero ?? 0);
  const unique = c.data.unique === 'true';
  const hp = unique ? Number(c.data.uniquehealth ?? health) + Number(c.data.uniquehealthhero ?? 0) * n : Math.round(health + perHero * n);
  const monster: Monster = {
    spawn: c.name,
    monsterId: id,
    name: base?.name ?? custom?.name ?? id,
    hp: Math.max(1, hp),
    maxHp: Math.max(1, hp),
    title: unique ? getText(s, Object.keys(s.texts)[0] ?? '', c.name + '.uniquetitle') : '',
  };
  const monsters = [...st.monsters, monster];
  return { ...st, monsters, vars: { ...st.vars, '#monsters': monsters.length } };
}

function addComponents(s: Scenario, st: GameState, c: QComponent): GameState {
  let visible = st.visible;
  let items = st.items;
  for (const n of list(c.data.remove)) {
    visible = visible.filter((x) => x !== n);
    items = items.filter((x) => x !== n);
  }
  for (const n of list(c.data.add)) {
    const t = getComponent(s, n);
    if (!t) continue;
    if (BOARD.includes(t.type) && !visible.includes(n)) visible = [...visible, n];
    if (t.type === 'QItem' && !items.includes(n)) items = [...items, n];
  }
  return { ...st, visible, items };
}

// Custom triggers: a variable "@name" above zero fires the events with trigger "Varname" once.
function customTriggers(s: Scenario, st: GameState): GameState {
  let out = st;
  for (const [k, v] of Object.entries(st.vars)) {
    if (v > 0 && (k.startsWith('@') || k.startsWith('$@'))) {
      out = withVar(out, k, 0);
      out = queueTrigger(s, out, k.startsWith('$@') ? 'Var$' + k.slice(2) : 'Var' + k.slice(1));
    }
  }
  return out;
}

// Valkyrie adds no "Continue" to a token without buttons; such a window, like a cancelable one, has only a close cross.
export const closable = (c: QComponent) => c.data.cancelable === 'true' || (c.type === 'Token' && !(c.data.buttons ?? '').trim());

export type ButtonState = 'ok' | 'disabled' | 'hidden';

export function buttonState(c: QComponent, index: number, vars: Vars): ButtonState {
  const cond = c.data[`event${index}Condition`];
  if (!cond || testsPass(cond, vars)) return 'ok';
  return c.data[`event${index}ConditionAction`] === 'hide' ? 'hidden' : 'disabled';
}

// Take the next event off the stack and perform it, like Valkyrie's TriggerEvent.
export function next(s: Scenario, st: GameState, rng: Rng = Math.random, depth = 0): GameState {
  if (st.ended || depth > 200) return st;
  if (st.stack.length === 0) {
    if (st.pendingNewRound) return startRound(s, { ...st, pendingNewRound: false }, rng, depth);
    return { ...st, current: null };
  }
  const name = st.stack[st.stack.length - 1];
  let out: GameState = { ...st, stack: st.stack.slice(0, -1) };
  const c = getComponent(s, name);
  if (!c || isDisabled(s, out, name)) return next(s, out, rng, depth + 1);

  out = { ...out, vars: runOps(c.data.operations, out.vars) };
  // The variable "clues" is the constructor's way of handing the investigators a clue.
  const found = (out.vars.clues ?? 0) - (st.vars.clues ?? 0);
  if (found) out = { ...out, clues: Math.max(0, out.clues + found) };
  if (c.type === 'Spawn') out = spawnMonster(s, out, c, rng);
  out = addComponents(s, out, c);
  out = { ...out, log: [...out.log, name], hero: out.heroes.length ? pick(out.heroes, rng) : '' };

  if (c.type === 'Puzzle') {
    // A puzzle always opens its window, whatever "display" says; one put aside earlier is picked up where it was left.
    return { ...out, current: name, puzzle: out.puzzles[name] ?? newPuzzle(c, rng) };
  }
  if (c.data.display === 'false') {
    // No window: the game goes on by itself through the first button that is enabled.
    const index = buttonsOf(c).findIndex((b) => buttonState(c, b.index, out.vars) !== 'disabled' && buttonState(c, b.index, out.vars) !== 'hidden');
    return choose(s, { ...out, current: name }, Math.max(0, index) + 1, rng, depth + 1);
  }
  return { ...out, current: name };
}

// The players moved something on the puzzle table.
export function puzzleSet(st: GameState, puzzle: PuzzleState): GameState {
  return st.puzzle ? { ...st, puzzle } : st;
}

// "Close": the puzzle is put aside as it is, and the game goes on without pressing the button.
export function puzzleClose(s: Scenario, st: GameState, rng: Rng = Math.random): GameState {
  if (!st.current || !st.puzzle) return st;
  const puzzles = { ...st.puzzles, [st.current]: st.puzzle };
  return next(s, { ...st, current: null, puzzle: null, puzzles }, rng);
}

// The button of a solved puzzle: the puzzle is gone for good and the story goes on.
export function puzzleFinish(s: Scenario, st: GameState, rng: Rng = Math.random): GameState {
  if (!st.current || !st.puzzle || !puzzleSolved(st.puzzle)) return st;
  const puzzles = { ...st.puzzles };
  delete puzzles[st.current];
  return choose(s, { ...st, puzzle: null, puzzles }, 1, rng);
}

// For authors: skip the playing and take the solved puzzle.
export function puzzleSolve(st: GameState): GameState {
  return st.puzzle ? { ...st, puzzle: solvePuzzle(st.puzzle) } : st;
}

// The players pressed a button of the open window.
export function choose(s: Scenario, st: GameState, index: number, rng: Rng = Math.random, depth = 0): GameState {
  const c = st.current ? getComponent(s, st.current) : undefined;
  let out: GameState = { ...st, current: null };
  if (!c) return next(s, out, rng, depth + 1);
  // Button 0 is the window's close cross of a "cancelable" event: it closes the window and goes nowhere.
  if (index === 0) return next(s, out, rng, depth + 1);
  const targets = buttonsOf(c).find((b) => b.index === index)?.targets ?? [];
  const enabled = targets.filter((t) => !isDisabled(s, out, t) && getComponent(s, t));
  for (const t of targets) if (!getComponent(s, t)) out = note(out, `Предупреждение: нет события «${t}».`);

  if ((out.vars['$end'] ?? 0) !== 0) return { ...out, ended: true, stack: [] };
  if (enabled.length) out = queueEvent(s, out, c.data.randomevents === 'true' ? pick(enabled, rng) : enabled[0]);
  out = customTriggers(s, out);
  return next(s, out, rng, depth + 1);
}

// --- the board and the rounds --------------------------------------------------------------------

// The players touched a token or a door on the map.
export function touch(s: Scenario, st: GameState, name: string, rng: Rng = Math.random): GameState {
  if (st.current || st.ended || !st.visible.includes(name)) return st;
  return next(s, queueEvent(s, st, name), rng);
}

export function endInvestigatorPhase(s: Scenario, st: GameState, rng: Rng = Math.random): GameState {
  if (st.current || st.phase !== 'investigator' || st.ended) return st;
  let out: GameState = { ...st, phase: 'mythos', log: [...st.log, '— Фаза мифов —'] };
  out = queueTrigger(s, out, 'BeforeMonsterActivation');
  out = queueTrigger(s, out, 'Mythos');
  out = queueTrigger(s, out, 'EndInvestigatorTurn');
  return next(s, out, rng);
}

// Mythos events are done: the monsters act, then the horror phase follows (Valkyrie's RoundControllerMoM).
export function nextPhase(st: GameState): GameState {
  if (st.current || st.ended) return st;
  if (st.phase === 'mythos') return { ...st, phase: 'monsters', log: [...st.log, '— Монстры действуют —'] };
  if (st.phase === 'monsters') return { ...st, phase: 'horror', log: [...st.log, '— Фаза ужаса —'] };
  return st;
}

export function newRound(s: Scenario, st: GameState, rng: Rng = Math.random): GameState {
  if (st.current || st.phase === 'investigator' || st.ended) return st;
  let out: GameState = { ...st, pendingNewRound: true };
  out = queueTrigger(s, out, 'EndRound');
  out = queueTrigger(s, out, 'EndRound' + st.round);
  return next(s, out, rng);
}

function startRound(s: Scenario, st: GameState, rng: Rng, depth: number): GameState {
  const round = st.round + 1;
  let out: GameState = { ...withVar(st, '#round', round), round, phase: 'investigator', log: [...st.log, `— Раунд ${round} —`] };
  out = queueTrigger(s, out, 'StartRound');
  return next(s, out, rng, depth + 1);
}

export function eliminated(s: Scenario, st: GameState, rng: Rng = Math.random): GameState {
  if (st.current || st.ended) return st;
  const out = queueTrigger(s, note(st, 'Все сыщики выбыли.'), 'Eliminated');
  return out.stack.length === st.stack.length ? { ...out, ended: true } : next(s, out, rng);
}

export function adjustClues(st: GameState, delta: number): GameState {
  return { ...st, clues: Math.max(0, st.clues + delta) };
}

export function adjustHp(st: GameState, index: number, delta: number): GameState {
  return { ...st, monsters: st.monsters.map((m, i) => (i === index ? { ...m, hp: Math.max(0, Math.min(m.maxHp, m.hp + delta)) } : m)) };
}

// A monster is defeated: events "Defeated<monster id>" and "Defeated<spawn name>" fire.
export function defeat(s: Scenario, st: GameState, index: number, rng: Rng = Math.random): GameState {
  const m = st.monsters[index];
  if (!m || st.current || st.ended) return st;
  const monsters = st.monsters.filter((_, i) => i !== index);
  let out: GameState = { ...st, monsters, vars: { ...st.vars, '#monsters': monsters.length }, log: [...st.log, `Побеждён: ${m.name}`] };
  out = queueTrigger(s, out, 'Defeated' + m.monsterId);
  out = queueTrigger(s, out, 'Defeated' + m.spawn);
  return next(s, out, rng);
}

// --- text ------------------------------------------------------------------------------------------

// The text of an open window with the game's own placeholders filled in.
export function windowText(s: Scenario, st: GameState, lang: string, name: string, label?: (component: string) => string | undefined): string {
  let text = resolveText(s, lang, getText(s, lang, name + '.text'));
  // {c:X} names a component. A Spawn is named by its monster; a text never pulls in its own text again.
  text = text.replace(/\{c:([^}]+)\}/g, (_, n: string) => {
    const c = getComponent(s, n);
    if (!c) return n;
    if (c.type === 'Spawn') return label?.(n) ?? st.monsters.find((m) => m.spawn === n)?.name ?? n;
    if (n === name || c.type === 'Tile') return label?.(n) ?? n;
    return resolveText(s, lang, getText(s, lang, n + '.text'));
  });
  text = text.replace(/\{rnd:hero\}/g, st.hero || 'Сыщик');
  text = text.replace(/\{var:([^}]+)\}/g, (_, n: string) => String(st.vars[n] ?? 0));
  return text;
}
