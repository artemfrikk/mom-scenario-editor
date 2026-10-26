// Room-based view: for every room, what shows it and what lies inside it.

import type { Scenario } from '../format/scenario';
import { isEventLike } from '../format/scenario';
import { tileSize } from './actions';
import { tileBox } from './geometry';
import { position } from './ops';

export interface Room {
  tile: string;
  side: string;
  shownBy: string[]; // events that put the room on the map
  inside: string[]; // tokens, doors and other pieces standing in the room
  events: string[]; // events that those pieces run
}

export function roomsOf(s: Scenario): Room[] {
  const pieces = s.components.filter((c) => ['Token', 'Door', 'MPlace', 'UI'].includes(c.type));
  return s.components
    .filter((c) => c.type === 'Tile')
    .map((t) => {
      const p = position(t) ?? { x: 0, y: 0 };
      const [w, h] = tileSize(t.data.side ?? '');
      const box = tileBox(p.x, p.y, w, h, Number(t.data.rotation ?? 0) || 0);
      const inside = pieces.filter((c) => {
        const q = position(c);
        return q && q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY;
      });
      const events = new Set<string>();
      for (const c of inside) {
        if (isEventLike(c.type)) events.add(c.name);
        for (const k of Object.keys(c.data)) if (/^event\d+$/.test(k)) for (const e of (c.data[k] ?? '').split(/\s+/).filter(Boolean)) events.add(e);
      }
      return {
        tile: t.name,
        side: t.data.side ?? '',
        shownBy: s.components.filter((c) => isEventLike(c.type) && (c.data.add ?? '').split(/\s+/).includes(t.name)).map((c) => c.name),
        inside: inside.map((c) => c.name),
        events: [...events],
      };
    });
}
