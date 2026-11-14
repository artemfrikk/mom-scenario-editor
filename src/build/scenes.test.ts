import { describe, expect, it } from 'vitest';
import catalog from '../content/catalog.json';
import { compile } from './compile';
import { addPiece, addRoom } from './edit';
import { newProject } from './project';
import { placeScene, SCENES } from './scenes';

const base = () => {
  let p = { ...newProject(), title: 'Сцены' };
  let hall: string, study: string;
  [p, hall] = addRoom(p, 'TileSideHall1');
  [p, study] = addRoom(p, 'TileSideStudy');
  [p] = addPiece(p, hall, 'start');
  return { p, hall, study };
};

describe('ready scenes', () => {
  it('every scene puts linked pieces from the base game and compiles', () => {
    const known = new Set([...catalog.items, ...catalog.monsters, ...catalog.tokens].filter((x) => x.pack === 'MoMBase').map((x) => x.id));
    for (const sc of SCENES) {
      const { p, hall, study } = base();
      const [q, focus, added] = placeScene(p, sc, study, hall);
      expect(added).toContain(focus);
      for (const id of added) {
        const x = q.pieces.find((y) => y.id === id)!;
        if (x.look) expect(known.has(x.look), `${sc.id}: ${x.look}`).toBe(true);
        if (x.outcome.item) expect(known.has(x.outcome.item), `${sc.id}: ${x.outcome.item}`).toBe(true);
        for (const n of x.outcome.lock?.needs ?? []) expect(q.pieces.some((y) => y.id === n.split('.')[0])).toBe(true);
      }
      if (sc.elsewhere) expect(added.some((id) => q.pieces.find((y) => y.id === id)!.room === hall)).toBe(true);
      expect(() => compile(q)).not.toThrow();
    }
  });
});
