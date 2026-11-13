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

// One answer in a conversation: the button the players press and what follows from it.
export interface Choice {
  id: string; // c1, c2... inside its piece
  label: string;
  outcome: Outcome; // its own text and gifts; once, test, puzzle and lock are not used
}

// Closed until other pieces were used: a key found, a lever pulled, a monster defeated.
export interface Lock {
  needs: string[]; // ids of pieces whose outcome must have happened (all of them); "P5.c2" is one answer of a conversation, "%ch1m4" a campaign mark
  text: string; // what the players read while it is still closed
}

// What happens when the investigators use a piece (for a monster: when it is defeated).
export interface Outcome {
  text: string; // with a test: what they read before rolling
  test?: SkillTest;
  puzzle?: PuzzleSpec;
  choices?: Choice[]; // the players choose an answer instead of reading one result
  remember?: string[]; // campaign marks set by this result, read in later chapters
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
  voice?: MonsterVoice; // monsters: the author's own texts instead of the game's
  outcome: Outcome;
}

// A monster's own words in the game windows. Left empty, Valkyrie shows its usual texts for this monster.
export interface MonsterVoice {
  attack?: string; // the monster attacks (monster phase): what happens to the investigator
  move?: string; // the monster phase, before the attack: how it moves
  hit?: string; // an investigator attacks it: what to roll and what happens
  horror?: string; // the horror check against it
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

// How hard Valkyrie's own mythos events hit: 0 only atmosphere, 1 weak, 2 medium, 3 strong.
export type MythosLevel = 0 | 1 | 2 | 3;

// The threat over time: the level at the start and the rounds where it grows.
export interface Mythos {
  level: MythosLevel;
  rises: { round: number; level: MythosLevel }[];
}

// Something that happens in the mythos phase of a round, by itself.
export interface TimedEvent {
  id: string;
  round: number; // from this round
  every: boolean; // again in every round after it, not only once
  outcome: Outcome; // text and gifts; once is not used
  lose?: boolean; // time is up: the investigators lose
}

// A campaign mark: something the next chapters remember ("Дворецкий спасён").
export interface Mark {
  id: string; // the chapter's id, "m" and a number: ch1m4
  label: string;
}

// Where the campaign goes after a chapter ends: another chapter's id, or nothing for the end.
export interface Next {
  win?: string;
  lose?: string;
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
  mythos?: Mythos; // left out: Valkyrie decides (scenarios made elsewhere)
  chapter?: string; // chapter id inside a campaign: ch1 is the main scenario
  chapterTitle?: string;
  next?: Next;
  marks?: Mark[]; // marks this chapter sets; later chapters can read them
  campaign?: Project[]; // the other chapters, only in the saved file (editor.json)
  timeline?: TimedEvent[];
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
    mythos: { level: 1, rises: [{ round: 4, level: 2 }, { round: 8, level: 3 }] },
    timeline: [],
    nextId: 1,
  };
}

// A short id that stays readable inside the Valkyrie files (TileR3, TokenP7).
export function takeId(p: Project, prefix: 'R' | 'P' | 'T'): [Project, string] {
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
  const clean = (o: Outcome): Outcome => ({
    ...o,
    reveal: o.reveal?.filter((r) => !rooms.has(r)),
    spawn: o.spawn?.filter((m) => !pieces.has(m)),
    choices: o.choices?.map((c) => ({ ...c, outcome: clean(c.outcome) })),
    lock: o.lock && { ...o.lock, needs: o.lock.needs.filter((n) => !pieces.has(n.split('.')[0])) },
  });
  return {
    ...p,
    timeline: p.timeline?.map((t) => ({ ...t, outcome: clean(t.outcome) })),
    pieces: p.pieces.map((x) => ({ ...x, outcome: clean(x.outcome) })),
  };
}

// Every result in the scenario: the pieces', their answers' and the rounds'.
export function allOutcomes(p: Project): Outcome[] {
  const out: Outcome[] = [];
  for (const x of p.pieces) out.push(x.outcome, ...(x.outcome.choices ?? []).map((c) => c.outcome));
  for (const t of p.timeline ?? []) out.push(t.outcome);
  return out;
}

// The variable that remembers a piece was used ("P5") or an answer was chosen ("P5.c2").
export const doneVar = (need: string) => (need.startsWith('%') ? markVar(need.slice(1)) : 'done_' + need.replace('.', '_'));

// Variables starting with % survive the move to the next chapter (Valkyrie's VarManager.TrimQuest).
export const markVar = (mark: string) => '%mark_' + mark;

// Where a chapter's quest.ini lies inside the package; Valkyrie looks for it from the package's folder.
export const chapterPath = (id: string) => (id === 'ch1' ? 'quest.ini' : `${id}/quest.ini`);
