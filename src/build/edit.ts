// Changes the author makes on the map. Pure functions: a project in, a new project out.

import { reverseOf } from '../model/tiles';
import { junction, placeBeside, type Side } from '../model/geometry';
import { freeSpot, roomBox, snap, SNAP_PIECE, SNAP_TILE, tileSize, type Sizes } from './board';
import { KIND_TOKEN } from './compile';
import { pieceOf, roomOf, takeId, updateOutcome, type Piece, type PieceKind, type Project } from './project';

export function addRoom(p: Project, tile: string, at?: { x: number; y: number }, sizes: Sizes = {}): [Project, string] {
  let id: string;
  [p, id] = takeId(p, 'R');
  let x = 0;
  let y = 0;
  if (at) {
    x = snap(at.x, SNAP_TILE);
    y = snap(at.y, SNAP_TILE);
  } else if (p.rooms.length) {
    const [w, h] = sizes[tile] ?? tileSize(tile);
    const boxes = p.rooms.map((r) => roomBox(r, sizes));
    const spot = placeBeside(boxes[boxes.length - 1], w, h, 'right', boxes);
    x = spot?.x ?? 0;
    y = spot?.y ?? -10.5 * p.rooms.length;
  }
  return [{ ...p, rooms: [...p.rooms, { id, tile, x, y, rot: 0, enterText: '' }] }, id];
}

// Things are used up by default when that is what the board game does with them.
const ONCE: Record<PieceKind, boolean> = { start: false, search: true, explore: true, interact: false, sight: true, npc: false, monster: true, mark: false };

export function addPiece(p: Project, room: string, kind: PieceKind, look = '', at?: { x: number; y: number }, sizes: Sizes = {}): [Project, string] {
  const r = roomOf(p, room);
  if (!r) return [p, ''];
  let id: string;
  [p, id] = takeId(p, 'P');
  const spot = at ? { x: snap(at.x, SNAP_PIECE), y: snap(at.y, SNAP_PIECE) } : freeSpot(p, r, sizes);
  const piece: Piece = {
    id,
    room,
    kind,
    look: look || KIND_TOKEN[kind] || '',
    x: spot.x,
    y: spot.y,
    title: '',
    outcome: { text: '', once: ONCE[kind] },
    ...(kind === 'monster' ? { when: 'room' as const } : {}),
  };
  // only one starting place
  const pieces = kind === 'start' ? p.pieces.filter((x) => x.kind !== 'start') : p.pieces;
  return [{ ...p, pieces: [...pieces, piece] }, id];
}

// "Behind this door is a new room": the room is put against the door's room, and the door moves to the wall between them.
export function roomBehindDoor(p: Project, door: string, tile: string, sizes: Sizes = {}, wanted: Side = 'right'): [Project, string] {
  const d = pieceOf(p, door);
  const from = d && roomOf(p, d.room);
  if (!d || !from) return [p, ''];
  const [w, h] = sizes[tile] ?? tileSize(tile);
  const boxes = p.rooms.map((r) => roomBox(r, sizes));
  const spot = placeBeside(roomBox(from, sizes), w, h, wanted, boxes);
  let id: string;
  [p, id] = addRoom(p, tile, spot ?? undefined, sizes);
  const to = roomOf(p, id)!;
  const wall = junction(roomBox(from, sizes), roomBox(to, sizes));
  let next = updateOutcome(p, door, { reveal: [...(d.outcome.reveal ?? []), id] });
  if (wall) {
    // a little inside the door's own room, so it still belongs to it
    const fb = roomBox(from, sizes);
    const cx = (fb.minX + fb.maxX) / 2;
    const cy = (fb.minY + fb.maxY) / 2;
    const k = 0.7 / Math.max(0.01, Math.hypot(cx - wall.x, cy - wall.y));
    next = { ...next, pieces: next.pieces.map((x) => (x.id === door ? { ...x, x: wall.x + (cx - wall.x) * k, y: wall.y + (cy - wall.y) * k } : x)) };
  }
  return [next, id];
}

export function rotateRoom(p: Project, id: string): Project {
  const r = roomOf(p, id);
  if (!r) return p;
  const rot = (r.rot + 90) % 360;
  // turn around the middle, so the room stays where it is; its pieces turn with it
  const before = roomBox(r);
  const turned = { ...r, rot };
  const after = roomBox(turned);
  const cx = (before.minX + before.maxX) / 2;
  const cy = (before.minY + before.maxY) / 2;
  const dx = cx - (after.minX + after.maxX) / 2;
  const dy = cy - (after.minY + after.maxY) / 2;
  const x = snap(r.x + dx, SNAP_TILE / 2);
  const y = snap(r.y + dy, SNAP_TILE / 2);
  return {
    ...p,
    rooms: p.rooms.map((q) => (q.id === id ? { ...turned, x, y } : q)),
    // a quarter turn counter-clockwise about the middle
    pieces: p.pieces.map((q) => (q.room === id ? { ...q, x: cx - (q.y - cy), y: cy + (q.x - cx) } : q)),
  };
}

// Room cards are double-sided: turn the card over, the room stays where it is with its pieces.
export function flipRoom(p: Project, id: string): Project {
  const r = roomOf(p, id);
  const back = r && reverseOf(r.tile);
  if (!r || !back) return p;
  return { ...p, rooms: p.rooms.map((q) => (q.id === id ? { ...q, tile: back } : q)) };
}
