// A tiny simulator of the story, for trying a scenario as a player would.
// It follows buttons and add/remove, but not variables or rounds.

import { isEventLike, type Scenario } from '../format/scenario';
import { buttonsOf, getComponent } from './ops';

export interface PlayState {
  visible: string[]; // objects currently on the board
  current: string | null; // event window the players are looking at
  path: string[]; // events fired so far, newest last
  ended: boolean;
  note: string; // shown when a hidden event led nowhere or chose at random
}

const list = (v: string | undefined) => (v ?? '').split(/\s+/).filter(Boolean);

export function emptyState(): PlayState {
  return { visible: [], current: null, path: [], ended: false, note: '' };
}

// Fire one event (or a token/door the players pressed).
export function fire(s: Scenario, state: PlayState, name: string, depth = 0): PlayState {
  const c = getComponent(s, name);
  if (!c || depth > 40) return { ...state, current: null, note: c ? 'Цепочка скрытых событий слишком длинная.' : '' };
  const visible = new Set(state.visible);
  for (const n of list(c.data.remove)) visible.delete(n);
  for (const n of list(c.data.add)) visible.add(n);
  const ended = state.ended || /(^|\s)\$end,=,1(\s|$)/.test(c.data.operations ?? '');
  const next: PlayState = { ...state, visible: [...visible], path: [...state.path, name], ended, current: name, note: '' };
  if (!isEventLike(c.type)) return next;
  if (c.data.display === 'false') {
    // A hidden event shows no window: the game goes straight on to its first button.
    const targets = buttonsOf(c)[0]?.targets ?? [];
    if (!targets.length) return { ...next, current: null, note: `${name} сработало без окна и ни к чему не привело.` };
    const out = fire(s, { ...next, current: null }, targets[0], depth + 1);
    return targets.length > 1 ? { ...out, note: 'Скрытое событие выбирает случайный путь, здесь показан первый.' } : out;
  }
  return next;
}

export function startPlay(s: Scenario): PlayState {
  let state = emptyState();
  for (const c of s.components) if (c.data.trigger === 'EventStart') state = fire(s, state, c.name);
  return state;
}
