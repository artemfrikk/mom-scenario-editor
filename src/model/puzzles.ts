// The four kinds of Puzzle windows, with Valkyrie's rules (unity/Assets/Scripts/Quest/Puzzle*.cs).
// Everything is pure; randomness is passed in. A puzzle is solved on the board, then its button is released.

import type { QComponent } from '../format/scenario';
import slideData from '../content/slidepuzzles.json';

export type Rng = () => number;
const roll = (n: number, rng: Rng) => Math.min(n - 1, Math.floor(rng() * n));

// --- slide: get the first block out of the box through the gap on the right --------------------

export interface Block {
  rot: boolean; // moves up and down
  xlen: number; // 0 based: a block one square wide has xlen 0
  ylen: number;
  x: number;
  y: number;
  target: boolean;
}

export interface SlideState {
  kind: 'slide';
  blocks: Block[];
  moves: number;
}

const blockAt = (b: Block, x: number, y: number) => x >= b.x && x <= b.x + b.xlen && y >= b.y && y <= b.y + b.ylen;

// The box is 6 by 6, with a gap in the third row that leads out to the right.
export function slideEmpty(blocks: Block[], x: number, y: number): boolean {
  if (x < 0 || y < 0 || y > 5) return false;
  if (x > 5 && y !== 2) return false;
  if (x > 7) return false;
  return !blocks.some((b) => blockAt(b, x, y));
}

// How far block i may travel: the lowest and highest position of its moving edge.
export function slideRange(blocks: Block[], i: number): { min: number; max: number } {
  const b = blocks[i];
  const others = blocks.filter((_, k) => k !== i);
  const at = (p: number) => ({ ...b, x: b.rot ? b.x : p, y: b.rot ? p : b.y });
  const free = (p: number) => {
    const t = at(p);
    for (let x = t.x; x <= t.x + t.xlen; x++) for (let y = t.y; y <= t.y + t.ylen; y++) if (!slideEmpty(others, x, y)) return false;
    return true;
  };
  const here = b.rot ? b.y : b.x;
  let min = here;
  let max = here;
  while (free(min - 1)) min--;
  while (free(max + 1)) max++;
  return { min, max };
}

export function slideMove(st: SlideState, i: number, pos: number): SlideState {
  const b = st.blocks[i];
  const { min, max } = slideRange(st.blocks, i);
  const p = Math.max(min, Math.min(max, pos));
  if (!b || p === (b.rot ? b.y : b.x)) return st;
  const blocks = st.blocks.map((x, k) => (k === i ? { ...x, x: x.rot ? x.x : p, y: x.rot ? p : x.y } : x));
  return { ...st, blocks, moves: st.moves + 1 };
}

export const slideSolved = (st: SlideState) => st.blocks[0].x === 6;

export function newSlide(level: number, rng: Rng): SlideState {
  let depth = Math.max(1, level);
  type Entry = { moves: number; blocks: number[][] };
  const all = slideData as Entry[];
  let options: Entry[] = [];
  while (!options.length && depth > 0) options = all.filter((p) => p.moves === depth--);
  const pick = options[roll(options.length, rng)] ?? all[0];
  const blocks = pick.blocks.map(([r, xl, yl, x, y, t]) => ({ rot: !!r, xlen: xl, ylen: yl, x, y, target: !!t }));
  return { kind: 'slide', blocks, moves: 0 };
}

// --- code: guess the combination ------------------------------------------------------------

export interface CodeState {
  kind: 'code';
  answer: number[];
  guesses: number[][];
  options: number; // how many different symbols there are
}

export function newCode(items: number, options: number, solution: string, rng: Rng): CodeState {
  const given = solution.split(/\s+/).map(Number).filter((n) => n > 0);
  const n = Math.max(1, items);
  const opts = Math.max(1, options);
  const answer = given.length ? given : Array.from({ length: n }, () => roll(opts, rng) + 1);
  return { kind: 'code', answer, guesses: [], options: given.length ? Math.max(opts, ...given) : opts };
}

// Right symbol in the right place, and right symbol in the wrong place (counted like Valkyrie does).
export function codeFeedback(answer: number[], guess: number[]): { spot: number; type: number } {
  let spot = 0;
  let type = 0;
  const used = new Array(answer.length).fill(false);
  for (let i = 0; i < answer.length; i++) if (answer[i] === guess[i]) spot++;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) continue;
    for (let j = 0; j < answer.length; j++) {
      if (i === j || used[j] || answer[j] === guess[j]) continue;
      if (answer[j] === guess[i]) {
        type++;
        used[j] = true;
        break;
      }
    }
  }
  return { spot, type };
}

export function codeGuess(st: CodeState, guess: number[]): CodeState {
  if (guess.length !== st.answer.length || guess.some((g) => g < 1)) return st;
  return { ...st, guesses: [...st.guesses, guess] };
}

export const codeSolved = (st: CodeState) => {
  const last = st.guesses[st.guesses.length - 1];
  return !!last && st.answer.every((a, i) => a === last[i]);
};

// --- image: swap the pieces back into place --------------------------------------------------

export interface ImageState {
  kind: 'image';
  cols: number;
  rows: number;
  // piece[i] is which picture piece lies in cell i (cells and pieces both count row by row)
  piece: number[];
  moves: number;
}

export function newImage(cols: number, rows: number, rng: Rng): ImageState {
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  const piece = Array.from({ length: c * r }, (_, i) => i);
  for (let i = piece.length - 1; i > 0; i--) {
    const j = roll(i + 1, rng);
    [piece[i], piece[j]] = [piece[j], piece[i]];
  }
  const st: ImageState = { kind: 'image', cols: c, rows: r, piece, moves: 0 };
  // A picture that came out already solved is shuffled once more.
  return imageSolved(st) && piece.length > 1 ? { ...st, piece: [...piece.slice(1), piece[0]] } : st;
}

export function imageSwap(st: ImageState, a: number, b: number): ImageState {
  if (a === b || a < 0 || b < 0 || a >= st.piece.length || b >= st.piece.length) return st;
  const piece = [...st.piece];
  [piece[a], piece[b]] = [piece[b], piece[a]];
  return { ...st, piece, moves: st.moves + 1 };
}

export const imageSolved = (st: ImageState) => st.piece.every((p, i) => p === i);

// --- tower: move the eight rings to one tower ------------------------------------------------

export const RINGS = 8;

export interface TowerState {
  kind: 'tower';
  towers: number[][];
  moves: number;
}

type Towers = number[][];

const sameTowers = (a: Towers, b: Towers) => a.every((t, i) => t.length === b[i].length && t.every((v, k) => v === b[i][k]));
const copyTowers = (t: Towers) => t.map((x) => [...x]);

function reverseOk(from: number, p: Towers): boolean {
  if (!p[from]?.length) return false;
  if (p[from].length === 1) return true;
  return p[from][p[from].length - 1] < p[from][p[from].length - 2];
}

// Every arrangement that is exactly `depth` moves away from the finished one.
function farStates(depth: number): Towers[] {
  const end: Towers = [Array.from({ length: RINGS }, (_, i) => RINGS - 1 - i), [], []];
  const levels: Towers[][] = [[end]];
  for (let level = 0; level < depth; level++) {
    const next: Towers[] = [];
    for (const state of levels[level]) {
      for (let i = 0; i < 3; i++) {
        if (!reverseOk(i, state)) continue;
        for (let j = 0; j < 3; j++) {
          if (j === i) continue;
          const t = copyTowers(state);
          t[j].push(t[i].pop()!);
          if (!levels.some((l) => l.some((o) => sameTowers(o, t))) && !next.some((o) => sameTowers(o, t))) next.push(t);
        }
      }
    }
    levels.push(next);
  }
  return levels[depth] ?? [];
}

export function newTower(depth: number, rng: Rng): TowerState {
  let d = Math.max(1, depth);
  let options = farStates(d);
  while (!options.length && d > 1) options = farStates(--d);
  const pick = copyTowers(options[roll(options.length, rng)] ?? farStates(1)[0]);
  // The towers are put in a random order.
  const towers: Towers = [];
  towers.push(pick.splice(roll(3, rng), 1)[0]);
  towers.push(pick.splice(roll(2, rng), 1)[0]);
  towers.push(pick[0]);
  return { kind: 'tower', towers, moves: 0 };
}

export function towerMoveOk(st: TowerState, from: number, to: number): boolean {
  const t = st.towers;
  if (from === to || !t[from]?.length || !t[to]) return false;
  if (!t[to].length) return true;
  return t[from][t[from].length - 1] < t[to][t[to].length - 1];
}

export function towerMove(st: TowerState, from: number, to: number): TowerState {
  if (!towerMoveOk(st, from, to)) return st;
  const towers = copyTowers(st.towers);
  towers[to].push(towers[from].pop()!);
  return { ...st, towers, moves: st.moves + 1 };
}

export function towerSolved(st: TowerState): boolean {
  return st.towers.every((t) => {
    if (t.length > 0 && t.length < RINGS) return false;
    return t.every((v, i) => i === 0 || v <= t[i - 1]);
  });
}

// --- all of them ------------------------------------------------------------------------------

export type PuzzleState = SlideState | CodeState | ImageState | TowerState;

export const puzzleClass = (c: QComponent) => c.data.class || 'slide';

const num = (v: string | undefined, d: number) => {
  const n = parseInt(v ?? '', 10);
  return Number.isNaN(n) ? d : n;
};

// A fresh puzzle for a Puzzle component, with Valkyrie's defaults (level 4, second level 3).
export function newPuzzle(c: QComponent, rng: Rng): PuzzleState {
  const level = num(c.data.puzzlelevel, 4);
  const alt = num(c.data.puzzlealtlevel, 3);
  switch (puzzleClass(c)) {
    case 'code':
      return newCode(level, alt, c.data.puzzlesolution ?? '', rng);
    case 'image':
      return newImage(level, alt, rng);
    case 'tower':
      return newTower(level, rng);
    default:
      return newSlide(level, rng);
  }
}

export function puzzleSolved(p: PuzzleState): boolean {
  switch (p.kind) {
    case 'slide':
      return slideSolved(p);
    case 'code':
      return codeSolved(p);
    case 'image':
      return imageSolved(p);
    case 'tower':
      return towerSolved(p);
  }
}

// Used by the author's "solve it" shortcut and the path checker.
export function solvePuzzle(p: PuzzleState): PuzzleState {
  switch (p.kind) {
    case 'slide':
      return { ...p, blocks: p.blocks.map((b, i) => (i === 0 ? { ...b, x: 6 } : b)), moves: p.moves + 1 };
    case 'code':
      return { ...p, guesses: [...p.guesses, p.answer] };
    case 'image':
      return { ...p, piece: p.piece.map((_, i) => i), moves: p.moves + 1 };
    case 'tower':
      return { ...p, towers: [Array.from({ length: RINGS }, (_, i) => RINGS - 1 - i), [], []], moves: p.moves + 1 };
  }
}

export const puzzleMoves = (p: PuzzleState) => (p.kind === 'code' ? p.guesses.length : p.moves);
