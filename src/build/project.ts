// What the author made, in the author's own terms: rooms on the map, things in the rooms and what
// happens when the investigators touch them. The compiler (compile.ts) turns this into Valkyrie's
// events, tokens, spawns and variables; the author never has to see those.

import type { QComponent } from '../format/scenario';

export const PROJECT_FILE = 'editor.json';
export const PROJECT_FORMAT = 1;

export type PieceKind = 'start' | 'search' | 'explore' | 'interact' | 'npc' | 'monster' | 'sight' | 'mark';

export type Skill = 'strength' | 'agility' | 'observation' | 'lore' | 'influence' | 'will';

export type HarmKind = 'damage' | 'horror';

// What a failed test costs.
export interface Harm {
  kind: HarmKind;
  amount: number;
  who: 'one' | 'all'; // the investigator who tried, or every investigator in the room
}

// A skill test before the result: the players roll and press "Успех" or "Провал".
export interface SkillTest {
  skill: Skill;
  need: number; // successes needed
  pass: string; // text on success; the outcome's gifts come with it
  fail: string; // text on failure; the piece stays, so they can try again
  harm?: Harm;
}

export type PuzzleKind = 'slide' | 'code' | 'image' | 'tower';

// One of Valkyrie's puzzle windows before the result; solving it gives the outcome's gifts.
export interface PuzzleSpec {
  kind: PuzzleKind;
  skill: Skill; // the skill the investigator may use for help
  level: number; // slide, tower: how hard; code: symbols in the code; image: columns
  alt: number; // code: how many different symbols; image: rows
  image?: string; // image puzzle: a picture inside the package
  pass: string; // text once solved
}

// Closed until other pieces were used: a key found, a lever pulled, a monster defeated.
export interface Lock {
  needs: string[]; // ids of pieces whose outcome must have happened (all of them)
  text: string; // what the players read while it is still closed
}

// What happens when the investigators use a piece (for a monster: when it is defeated).
export interface Outcome {
  text: string; // with a test: what they read before rolling
  test?: SkillTest;
  puzzle?: PuzzleSpec;
  lock?: Lock;
  item?: string; // catalog item id the investigators receive
  clues?: number; // clues the investigators receive
  reveal?: string[]; // ids of rooms that appear on the map
  spawn?: string[]; // ids of monster pieces that come out ("when: event")
  win?: boolean; // the investigators win
  once: boolean; // the piece disappears after use
  sound?: string; // game sound id or a file inside the package
}

export interface Room {
  id: string;
  tile: string; // catalog tile side, TileSide...
  x: number; // Valkyrie position of the tile (its corner), world units, y up
  y: number;
  rot: number; // 0, 90, 180, 270
  enterText: string; // shown when the room appears on the map
}

export interface Piece {
  id: string;
  room: string; // room id it stands in
  kind: PieceKind;
  look: string; // token type (TokenSearch, TokenAgentCraven...) or monster id for monsters
  x: number;
  y: number;
  title: string; // the author's name for it: "Письменный стол", "Дворецкий"
  when?: 'room' | 'event'; // monsters: come out with the room, or when an outcome calls them
  outcome: Outcome;
}

export interface Prologue {
  text: string;
  image: string; // file inside the package, or ''
  music: string; // game music id or a file inside the package, or ''
}

// Things from a scenario made elsewhere that the constructor does not understand yet. They are written back unchanged.
export interface RawPart {
  components: QComponent[];
  texts: Record<string, Record<string, string>>;
  quest: Record<string, string>;
}

export interface Project {
  format: number;
  title: string;
  description: string;
  authors: string;
  minHero: number;
  maxHero: number;
  difficulty: number; // 0..1, as in Valkyrie
  lengthMin: number;
  lengthMax: number;
  cover: string; // file inside the package, or ''
  prologue: Prologue;
  goal: string;
  rooms: Room[];
  pieces: Piece[];
  winText: string;
  loseText: string;
  nextId: number;
  raw?: RawPart;
}

export type Assets = Record<string, Uint8Array>;

export const emptyOutcome = (): Outcome => ({ text: '', once: true });

export function newProject(): Project {
  return {
    format: PROJECT_FORMAT,
    title: '',
    description: '',
    authors: '',
    minHero: 1,
    maxHero: 5,
    difficulty: 0.5,
    lengthMin: 60,
    lengthMax: 120,
    cover: '',
    prologue: { text: '', image: '', music: '' },
    goal: '',
    rooms: [],
    pieces: [],
    winText: 'Вы справились. Тайна раскрыта, и кошмар отступает.',
    loseText: 'Сыщиков больше нет. Тьма поглощает дом.',
    nextId: 1,
  };
}

// A short id that stays readable inside the Valkyrie files (TileR3, TokenP7).
export function takeId(p: Project, prefix: 'R' | 'P'): [Project, string] {
  return [{ ...p, nextId: p.nextId + 1 }, prefix + p.nextId];
}

export const roomOf = (p: Project, id: string) => p.rooms.find((r) => r.id === id);
export const pieceOf = (p: Project, id: string) => p.pieces.find((x) => x.id === id);
export const piecesIn = (p: Project, room: string) => p.pieces.filter((x) => x.room === room);

// The room the investigators begin in: the one with the "investigators" marker, else the first one.
export function startRoom(p: Project): Room | undefined {
  const marker = p.pieces.find((x) => x.kind === 'start');
  return (marker && roomOf(p, marker.room)) ?? p.rooms[0];
}

export function updateRoom(p: Project, id: string, patch: Partial<Room>): Project {
  return { ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

export function updatePiece(p: Project, id: string, patch: Partial<Piece>): Project {
  return { ...p, pieces: p.pieces.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
}

export function updateOutcome(p: Project, id: string, patch: Partial<Outcome>): Project {
  return { ...p, pieces: p.pieces.map((x) => (x.id === id ? { ...x, outcome: { ...x.outcome, ...patch } } : x)) };
}

// Moving a room carries everything standing in it.
export function moveRoom(p: Project, id: string, x: number, y: number): Project {
  const r = roomOf(p, id);
  if (!r) return p;
  const dx = x - r.x;
  const dy = y - r.y;
  return {
    ...p,
    rooms: p.rooms.map((q) => (q.id === id ? { ...q, x, y } : q)),
    pieces: p.pieces.map((q) => (q.room === id ? { ...q, x: q.x + dx, y: q.y + dy } : q)),
  };
}

// Removing a room removes what stands in it and every mention of it.
export function deleteRoom(p: Project, id: string): Project {
  const gone = new Set(piecesIn(p, id).map((x) => x.id));
  return forget({ ...p, rooms: p.rooms.filter((r) => r.id !== id), pieces: p.pieces.filter((x) => !gone.has(x.id)) }, new Set([id]), gone);
}

export function deletePiece(p: Project, id: string): Project {
  return forget({ ...p, pieces: p.pieces.filter((x) => x.id !== id) }, new Set(), new Set([id]));
}

function forget(p: Project, rooms: Set<string>, pieces: Set<string>): Project {
  return {
    ...p,
    pieces: p.pieces.map((x) => {
      const o = x.outcome;
      const reveal = o.reveal?.filter((r) => !rooms.has(r));
      const spawn = o.spawn?.filter((m) => !pieces.has(m));
      const needs = o.lock?.needs.filter((m) => !pieces.has(m));
      if (reveal?.length === o.reveal?.length && spawn?.length === o.spawn?.length && needs?.length === o.lock?.needs.length) return x;
      return { ...x, outcome: { ...o, reveal, spawn, lock: o.lock && { ...o.lock, needs: needs ?? [] } } };
    }),
  };
}
