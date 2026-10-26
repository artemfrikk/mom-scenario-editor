// Room cards in the game are double-sided: a card lying on the table shows one side, so neither
// the same side again nor the picture on its back can be used in the same scenario.

import catalog from '../content/catalog.json';
import type { Scenario } from '../format/scenario';

const BACK = new Map<string, string>();
for (const t of catalog.tiles) {
  if (!t.reverse) continue;
  BACK.set(t.id, t.reverse);
  if (!BACK.has(t.reverse)) BACK.set(t.reverse, t.id);
}

export const reverseOf = (side: string): string | undefined => BACK.get(side);

export type Taken = 'used' | 'back';

// Sides that can no longer be chosen. `except` is a tile being edited: its own card stays available to it.
export function takenSides(s: Scenario, except?: string): Map<string, Taken> {
  const out = new Map<string, Taken>();
  for (const c of s.components) {
    if (c.type !== 'Tile' || c.name === except || !c.data.side) continue;
    out.set(c.data.side, 'used');
    const back = reverseOf(c.data.side);
    if (back && !out.has(back)) out.set(back, 'back');
  }
  return out;
}
