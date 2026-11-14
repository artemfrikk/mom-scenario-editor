// "Можно ли победить?": the investigators' every choice is tried on the game engine, one state after another,
// before anyone sits down at the table. A test is tried both ways, a decision every way, a puzzle is taken as solved.
// From the explored states it tells: a shortest way to victory, the moves after which victory is gone for good,
// and the pieces nobody ever reaches.

import type { Scenario } from '../format/scenario';
import { buttonState, choose, defeat, endInvestigatorPhase, newGame, newRound, nextPhase, puzzleFinish, puzzleSolve, touch, type GameState } from '../model/game';
import { buttonsOf, getComponent, getText } from '../model/ops';
import type { Piece, Project } from './project';

export interface Move {
  kind: 'touch' | 'button' | 'puzzle' | 'defeat' | 'round';
  target: string; // component name, monster index or ''
  index: number; // the button
  label: string; // in words, for the author
}

export interface Trap {
  move: string; // the move after which victory is gone, in words
  path: string[]; // how to get there from the start
}

export interface Verdict {
  win: boolean;
  path: string[]; // a shortest way to victory, in words
  rounds: number; // rounds the shortest way takes
  traps: Trap[];
  unreached: string[]; // pieces never used in any explored game, in words
  states: number;
  complete: boolean; // every state was explored; otherwise the answers are "as far as I looked"
}

const MAX_STATES = 20000;
const WIN = 'EventWin';
const rng = () => 0;

interface Node {
  st: GameState;
  won: boolean;
  from: number; // the node it was first reached from
  move: string; // the move that reached it
  next: number[];
  open: boolean; // not expanded: the search stopped before it
}

const keyOf = (n: { st: GameState; won: boolean }) => {
  const st = n.st;
  return JSON.stringify([
    n.won,
    st.ended,
    st.current,
    st.stack,
    st.phase,
    st.round,
    Object.keys(st.vars)
      .sort()
      .map((k) => [k, st.vars[k]]),
    [...st.visible].sort(),
    [...st.items].sort(),
    st.clues,
    st.monsters.map((m) => m.spawn).sort(),
    st.puzzle ? 1 : 0,
  ]);
};

// What the investigators can do now.
function movesOf(s: Scenario, st: GameState, lang: string, name: (component: string) => string): Move[] {
  if (st.ended) return [];
  if (st.current) {
    if (st.puzzle) return [{ kind: 'puzzle', target: st.current, index: 1, label: 'Решить головоломку' }];
    const c = getComponent(s, st.current);
    if (!c) return [];
    const buttons = buttonsOf(c).filter((b) => buttonState(c, b.index, st.vars) === 'ok');
    const many = buttons.length > 1;
    return buttons.map((b) => {
      const text = getText(s, lang, b.labelKey).trim() || b.labelRaw || `кнопка ${b.index}`;
      return { kind: 'button', target: st.current!, index: b.index, label: many ? `${name(st.current!)}: «${text}»` : '' };
    });
  }
  if (st.phase !== 'investigator') return [{ kind: 'round', target: '', index: 0, label: '' }];
  const out: Move[] = [];
  for (const v of st.visible) {
    const c = getComponent(s, v);
    if (!c || (c.type !== 'Token' && c.type !== 'Door') || !(parseInt(c.data.buttons ?? '0', 10) > 0)) continue;
    out.push({ kind: 'touch', target: v, index: 0, label: name(v) });
  }
  st.monsters.forEach((m, i) => out.push({ kind: 'defeat', target: String(i), index: 0, label: `Победить: ${m.title || m.name}` }));
  out.push({ kind: 'round', target: '', index: 0, label: 'Закончить раунд' });
  return out;
}

function play(s: Scenario, st: GameState, m: Move): GameState {
  switch (m.kind) {
    case 'touch':
      return touch(s, st, m.target, rng);
    case 'button':
      return choose(s, st, m.index, rng);
    case 'puzzle':
      return puzzleFinish(s, puzzleSolve(st), rng);
    case 'defeat':
      return defeat(s, st, Number(m.target), rng);
    case 'round': {
      // the mythos phase with its windows is played as moves too; once it is quiet the round ends
      if (st.phase === 'investigator') return endInvestigatorPhase(s, st, rng);
      let out = nextPhase(nextPhase(st));
      out = newRound(s, out, rng);
      return out;
    }
  }
}

// Words for a component: the piece it was made from, as the author knows it.
function namer(p: Project, pieceName: (x: Piece) => string) {
  return (component: string) => {
    const id = component.replace(/^(Token|Spawn|EventAnswer|EventPass|EventFail|Event)/, '').replace(/(c\d+|If\w+|Else)$/, '');
    const x = p.pieces.find((q) => q.id === id);
    return x ? pieceName(x) : component;
  };
}

export async function solve(p: Project, s: Scenario, pieceName: (x: Piece) => string, onProgress?: (states: number) => void): Promise<Verdict> {
  const lang = Object.keys(s.texts)[0] ?? '';
  const name = namer(p, pieceName);
  const loseRound = Math.min(20, ...(p.timeline ?? []).filter((t) => t.lose).map((t) => t.round + 1));
  const nodes: Node[] = [];
  const index = new Map<string, number>();
  const add = (st: GameState, won: boolean, from: number, move: string): number => {
    const k = keyOf({ st, won });
    const had = index.get(k);
    if (had !== undefined) return had;
    nodes.push({ st, won, from, move, next: [], open: true });
    index.set(k, nodes.length - 1);
    return nodes.length - 1;
  };
  const first = newGame(s, ['A', 'B'], rng);
  add(first, first.log.includes(WIN) || first.current === WIN, -1, '');
  const used = new Set<string>();
  let complete = true;
  // breadth first, so the first victory found is a shortest one
  for (let i = 0; i < nodes.length; i++) {
    if (nodes.length > MAX_STATES) {
      complete = false;
      break;
    }
    const n = nodes[i];
    if (n.won || n.st.ended || n.st.round > loseRound) {
      n.open = false;
      continue;
    }
    for (const m of movesOf(s, n.st, lang, name)) {
      if (m.kind === 'touch') used.add(m.target);
      if (m.kind === 'defeat') used.add(n.st.monsters[Number(m.target)]?.spawn ?? '');
      const st = play(s, { ...n.st, log: [] }, m);
      const won = n.won || st.log.includes(WIN) || st.current === WIN;
      const j = add({ ...st, log: [] }, won, i, m.label);
      if (j !== i && !n.next.includes(j)) n.next.push(j);
    }
    n.open = false;
    if (i % 400 === 0) {
      onProgress?.(nodes.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Which states can still reach victory: walk back from the won ones (and from the ones not looked at, to be fair).
  const back: number[][] = nodes.map(() => []);
  nodes.forEach((n, i) => n.next.forEach((j) => back[j].push(i)));
  const good = new Set<number>();
  const queue: number[] = [];
  nodes.forEach((n, i) => {
    if (n.won || (n.open && !n.st.ended && n.st.round <= loseRound)) {
      good.add(i);
      queue.push(i);
    }
  });
  while (queue.length) {
    const j = queue.pop()!;
    for (const i of back[j]) if (!good.has(i)) {
        good.add(i);
        queue.push(i);
      }
  }

  const pathTo = (i: number) => {
    const out: string[] = [];
    let rounds = 1;
    for (let k = i; k > 0 && nodes[k].from >= 0; k = nodes[k].from) {
      if (nodes[k].move) out.push(nodes[k].move);
    }
    for (let k = i; k >= 0; k = nodes[k].from) rounds = Math.max(rounds, nodes[k].st.round);
    // "Закончить раунд" twice in a row is one round ending in words
    return { path: out.reverse().filter((m, j, a) => !(m === 'Закончить раунд' && a[j - 1] === m)), rounds };
  };

  const wonAt = nodes.findIndex((n) => n.won);
  const traps: Trap[] = [];
  const seen = new Set<string>();
  if (good.has(0)) {
    for (let i = 0; i < nodes.length && traps.length < 5; i++) {
      const n = nodes[i];
      if (good.has(i) || n.from < 0 || !good.has(n.from) || !n.move || n.move === 'Закончить раунд') continue;
      if (n.st.ended) continue; // a lost game is not a trap: the author meant it
      if (seen.has(n.move)) continue;
      seen.add(n.move);
      traps.push({ move: n.move, path: pathTo(n.from).path });
    }
  }

  const unreached: string[] = [];
  for (const x of p.pieces) {
    if (x.kind === 'start' || x.kind === 'mark') continue;
    const comp = (x.kind === 'monster' ? 'Spawn' : 'Token') + x.id;
    if (!getComponent(s, comp) || used.has(comp)) continue;
    unreached.push(name(comp));
  }

  const way = wonAt >= 0 ? pathTo(wonAt) : { path: [], rounds: 0 };
  return { win: wonAt >= 0, path: way.path, rounds: way.rounds, traps, unreached, states: nodes.length, complete };
}
