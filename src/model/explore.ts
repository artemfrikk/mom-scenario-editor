// An automatic walk through every path of the story, to answer "can the game be finished?"
// It plays the scenario with the same engine as the Play tab, trying every button, token, door and phase.

import type { Scenario } from '../format/scenario';
import { isEventLike } from '../format/scenario';
import { buttonState, choose, defeat, eliminated, endInvestigatorPhase, newGame, newRound, touch, type GameState } from './game';
import { buttonsOf, getComponent } from './ops';

export interface Exploration {
  states: number;
  complete: boolean; // false when the limit stopped the search
  endings: { event: string; path: string[] }[]; // events that end the game, with the shortest way found
  reached: string[]; // every event that ran at least once
  neverReached: string[]; // events (with or without a window) that did not run in any path
  firstEnding: string[] | null;
}

const LIMIT = 6000;
const MAX_ROUND = 4;
const rngLow = () => 0;
const rngHigh = () => 0.999;

function key(st: GameState): string {
  return JSON.stringify([
    st.stack,
    st.current,
    [...st.visible].sort(),
    [...st.items].sort(),
    st.vars,
    st.monsters.map((m) => [m.spawn, m.hp]),
    st.phase,
    st.pendingNewRound,
    st.ended,
  ]);
}

export function explore(s: Scenario, heroes = ['Сыщик 1', 'Сыщик 2']): Exploration {
  const reached = new Set<string>();
  const endings = new Map<string, string[]>();
  const seen = new Set<string>();
  const start = newGame(s, heroes, rngLow);
  type Node = { st: GameState; path: string[] };
  let frontier: Node[] = [{ st: start, path: [] }];
  seen.add(key(start));
  let states = 1;
  let complete = true;

  const record = (st: GameState, path: string[]) => {
    for (const n of st.log) if (getComponent(s, n)) reached.add(n);
    if ((st.vars['$end'] ?? 0) !== 0) {
      const last = [...st.log].reverse().find((n) => getComponent(s, n)) ?? '';
      if (!endings.has(last)) endings.set(last, path);
    }
  };
  record(start, []);

  while (frontier.length && states < LIMIT) {
    const nextFrontier: Node[] = [];
    for (const { st, path } of frontier) {
      if (st.ended) continue;
      const moves: [string, (rng: () => number) => GameState][] = [];
      if (st.current) {
        const c = getComponent(s, st.current)!;
        const buttons = buttonsOf(c);
        // A window without buttons still has Valkyrie's default "Ok", which just closes it.
        if (!buttons.length) moves.push([`${st.current}: Ок`, (rng) => choose(s, st, 1, rng)]);
        // Players can be knocked out while a window is open, too: the window is simply left behind.
        moves.push(['все сыщики выбыли', (rng) => eliminated(s, { ...st, current: null }, rng)]);
        for (const b of buttons) {
          if (buttonState(c, b.index, st.vars) !== 'ok') continue;
          moves.push([`${st.current}: кнопка ${b.index}`, (rng) => choose(s, st, b.index, rng)]);
        }
      } else {
        for (const n of st.visible) {
          const c = getComponent(s, n);
          // A UI element (the intro's "continue" for example) can be pressed when it leads somewhere.
          const pressable = c && (c.type === 'Token' || c.type === 'Door' || (c.type === 'UI' && buttonsOf(c).some((b) => b.targets.length)));
          if (c && pressable && isEventLike(c.type)) moves.push([`нажать ${n}`, (rng) => touch(s, st, n, rng)]);
        }
        if (st.phase === 'investigator') moves.push(['конец хода сыщиков', (rng) => endInvestigatorPhase(s, st, rng)]);
        if (st.phase === 'mythos' && st.round < MAX_ROUND) moves.push(['новый раунд', (rng) => newRound(s, st, rng)]);
        moves.push(['все сыщики выбыли', (rng) => eliminated(s, st, rng)]);
        st.monsters.forEach((m, i) => moves.push([`победить ${m.name}`, (rng) => defeat(s, st, i, rng)]));
      }
      for (const [label, run] of moves) {
        for (const rng of [rngLow, rngHigh]) {
          const after = run(rng);
          const k = key(after);
          if (seen.has(k)) continue;
          seen.add(k);
          states++;
          const p = [...path, label];
          record(after, p);
          nextFrontier.push({ st: after, path: p });
          if (states >= LIMIT) break;
        }
        if (states >= LIMIT) break;
      }
      if (states >= LIMIT) break;
    }
    frontier = nextFrontier;
  }
  if (frontier.length) complete = false;

  const everyEvent = s.components.filter((c) => isEventLike(c.type)).map((c) => c.name);
  const list = [...endings].map(([event, path]) => ({ event, path }));
  return {
    states,
    complete,
    endings: list,
    reached: [...reached],
    neverReached: everyEvent.filter((n) => !reached.has(n)),
    firstEnding: list.length ? list.reduce((a, b) => (a.path.length <= b.path.length ? a : b)).path : null,
  };
}
