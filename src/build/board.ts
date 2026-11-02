// Sizes and places on the board, in Valkyrie units (one room space is 3.5, y points up).

import catalog from '../content/catalog.json';
import { tileBox, type Box } from '../model/geometry';
import type { Piece, Project, Room } from './project';

export const SQUARE = 3.5;
export const SNAP_TILE = 1.75;
export const SNAP_PIECE = 0.875;

const TRAITS = new Map(catalog.tiles.map((t) => [t.id, t.traits]));

// The size of a tile card before it is turned; the real picture, when there is one, may be a little different.
export function tileSize(side: string): [number, number] {
  const traits = TRAITS.get(side) ?? [];
  if (traits.includes('big')) return [3 * SQUARE, 2 * SQUARE];
  if (traits.includes('medium')) return [2 * SQUARE, 2 * SQUARE];
  return [2 * SQUARE, SQUARE];
}

export type Sizes = Record<string, [number, number]>; // tile side -> measured size of its picture

export function roomBox(r: Room, sizes: Sizes = {}): Box {
  const [w, h] = sizes[r.tile] ?? tileSize(r.tile);
  return tileBox(r.x, r.y, w, h, r.rot);
}

export const inside = (b: Box, x: number, y: number) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;

// The room under a point of the board; the newest room wins where tiles overlap.
export function roomAt(p: Project, x: number, y: number, sizes: Sizes = {}): Room | undefined {
  for (let i = p.rooms.length - 1; i >= 0; i--) if (inside(roomBox(p.rooms[i], sizes), x, y)) return p.rooms[i];
  return undefined;
}

export const snap = (v: number, step: number) => Math.round(v / step) * step;

// A free spot for a new piece in a room: the middle, moved along until nothing else stands there.
export function freeSpot(p: Project, room: Room, sizes: Sizes = {}): { x: number; y: number } {
  const b = roomBox(room, sizes);
  const taken = (x: number, y: number) => p.pieces.some((q: Piece) => Math.abs(q.x - x) < 0.6 && Math.abs(q.y - y) < 0.6);
  const cx = snap((b.minX + b.maxX) / 2, SNAP_PIECE);
  const cy = snap((b.minY + b.maxY) / 2, SNAP_PIECE);
  for (let ring = 0; ring < 6; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = cx + dx * SNAP_PIECE;
        const y = cy + dy * SNAP_PIECE;
        if (inside(b, x, y) && !taken(x, y)) return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}
