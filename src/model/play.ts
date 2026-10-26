// A tiny simulator of the story, for trying a scenario as a player would.
// It follows buttons, add/remove and variables (facts), but not rounds or dice.

import { isEventLike, type QComponent, type Scenario } from '../format/scenario';
import { runOps, testsPass, type Vars } from './facts';
import { buttonsOf, getComponent } from './ops';

export interface PlayState {
  visible: string[]; // objects currently on the board
  current: string | null; // event window the players are looking at
  path: string[]; // events fired so far, newest last
  vars: Vars; // what the game remembers
  ended: boolean;
  note: string; // shown when a hidden event led nowhere or chose at random
}

const list = (v: string | undefined) => (v ?? '').split(/\s+/).filter(Boolean);

export function emptyState(): PlayState {
  return { visible: [], current: null, path: [], vars: {}, ended: false, note: '' };
}

// Fire one event (or a token/door the players pressed).
export function fire(s: Scenario, state: PlayState, name: string, depth = 0): PlayState {
  const c = getComponent(s, name);
  if (!c || depth > 40) return { ...state, current: null, note: c ? 'Цепочка скрытых событий слишком длинная.' : '' };
  // An event whose own condition is not met is skipped, as in the game.
  if (!testsPass(c.data.vartests, state.vars)) {
    return { ...state, current: state.current, note: `${name}: условие события не выполнено, оно пропущено.` };
  }
  const vars = runOps(c.data.operations, state.vars);
  const visible = new Set(state.visible);
  for (const n of list(c.data.remove)) visible.delete(n);
  for (const n of list(c.data.add)) visible.add(n);
  const ended = state.ended || /(^|\s)\$end,=,1(\s|$)/.test(c.data.operations ?? '');
  const next: PlayState = { ...state, vars, visible: [...visible], path: [...state.path, name], ended, current: name, note: '' };
  if (!isEventLike(c.type)) return next;
  if (c.data.display === 'false') {
    // A hidden event shows no window: the game goes straight on to its first button.
    const all = buttonsOf(c)[0]?.targets ?? [];
    // The game takes the first target whose own condition is met.
    const targets = all.filter((n) => testsPass(getComponent(s, n)?.data.vartests, vars));
    if (!targets.length) return { ...next, current: null, note: `${name} сработало без окна и ни к чему не привело (нет подходящего следующего события).` };
    const out = fire(s, { ...next, current: null }, targets[0], depth + 1);
    return all.length > 1 ? { ...out, note: 'Скрытое событие выбирает случайный путь, здесь показан первый.' } : out;
  }
  return next;
}

// A button is shown, greyed out or hidden depending on its condition.
export function buttonState(c: QComponent, index: number, vars: Vars): 'ok' | 'disabled' | 'hidden' {
  const cond = c.data[`event${index}Condition`];
  if (!cond || testsPass(cond, vars)) return 'ok';
  return c.data[`event${index}ConditionAction`] === 'hide' ? 'hidden' : 'disabled';
}

export function startPlay(s: Scenario): PlayState {
  let state = emptyState();
  for (const c of s.components) if (c.data.trigger === 'EventStart') state = fire(s, state, c.name);
  return state;
}
