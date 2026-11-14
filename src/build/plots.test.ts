import { describe, expect, it } from 'vitest';
import { paceOf } from './acts';
import { compile } from './compile';
import { PLOTS } from './plots';
import { solve } from './solver';

describe('plot templates', () => {
  for (const plot of PLOTS) {
    it(`${plot.title}: three acts, can be won, blanks are marked`, async () => {
      const p = plot.make();
      const pace = paceOf(p);
      expect(pace.acts.length).toBe(3);
      expect(pace.acts[2].win).toBe(true);
      expect(pace.hints.filter((h) => h.includes('слишком рано') || h.includes('никогда'))).toEqual([]);
      const v = await solve(p, compile(p), (x) => x.title || x.id);
      expect(v.win).toBe(true);
      expect(v.traps).toEqual([]);
      expect(v.unreached).toEqual([]);
      expect(p.rooms.every((r) => r.todo)).toBe(true);
      expect(p.pieces.some((x) => x.todo)).toBe(true);
    });
  }
});
