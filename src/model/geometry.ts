// Where tiles sit on the board, and how they touch. World coordinates, y pointing up.
// A tile is drawn from its position as a w x h rectangle going right and down, turned by `rot` degrees counter-clockwise.

export interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export type Side = 'right' | 'left' | 'up' | 'down';

export function tileBox(x: number, y: number, w: number, h: number, rot: number): Box {
  const a = (-rot * Math.PI) / 180; // SVG rotate(-rot)
  const corners = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ].map(([cx, cy]) => [cx * Math.cos(a) - cy * Math.sin(a), cx * Math.sin(a) + cy * Math.cos(a)]);
  const xs = corners.map((c) => x + c[0]);
  const ys = corners.map((c) => -(-y + c[1])); // svg y -> world y
  const r = (v: number) => Math.round(v * 1e6) / 1e6 + 0; // no float dust, no negative zero
  return { minX: r(Math.min(...xs)), maxX: r(Math.max(...xs)), minY: r(Math.min(...ys)), maxY: r(Math.max(...ys)) };
}

export function overlaps(a: Box, b: Box, eps = 0.05): boolean {
  return a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minY < b.maxY - eps && a.maxY > b.minY + eps;
}

const ORDER: Side[] = ['right', 'down', 'left', 'up'];

// Position for a new w x h tile (not rotated) placed against `target`, on the wanted side if it is free,
// otherwise on the next free side. Returns null when all four sides are taken.
export function placeBeside(target: Box, w: number, h: number, wanted: Side, others: Box[]): { x: number; y: number; side: Side } | null {
  const tries: Side[] = [wanted, ...ORDER.filter((s) => s !== wanted)];
  for (const side of tries) {
    let x: number, y: number; // y is the top edge of the new tile in world coordinates
    if (side === 'right') {
      x = target.maxX;
      y = target.maxY;
    } else if (side === 'left') {
      x = target.minX - w;
      y = target.maxY;
    } else if (side === 'down') {
      x = target.minX;
      y = target.minY;
    } else {
      x = target.minX;
      y = target.maxY + h;
    }
    const box = tileBox(x, y, w, h, 0);
    if (!others.some((o) => overlaps(box, o))) return { x, y, side };
  }
  return null;
}

// The middle of the wall two tiles share, with the door rotation that lies along it (0 = vertical wall).
export function junction(a: Box, b: Box, eps = 0.15): { x: number; y: number; rot: number } | null {
  const mid = (lo: number, hi: number) => (lo + hi) / 2;
  const yLo = Math.max(a.minY, b.minY);
  const yHi = Math.min(a.maxY, b.maxY);
  const xLo = Math.max(a.minX, b.minX);
  const xHi = Math.min(a.maxX, b.maxX);
  if (yHi - yLo > 0.5) {
    if (Math.abs(a.maxX - b.minX) < eps) return { x: a.maxX, y: mid(yLo, yHi), rot: 0 };
    if (Math.abs(b.maxX - a.minX) < eps) return { x: a.minX, y: mid(yLo, yHi), rot: 0 };
  }
  if (xHi - xLo > 0.5) {
    if (Math.abs(a.minY - b.maxY) < eps) return { x: mid(xLo, xHi), y: a.minY, rot: 90 };
    if (Math.abs(b.minY - a.maxY) < eps) return { x: mid(xLo, xHi), y: a.maxY, rot: 90 };
  }
  return null;
}
