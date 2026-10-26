import { describe, expect, it } from 'vitest';
import { applyAction } from './actions';
import { newScenario } from '../format/scenario';
import { validate } from './validate';
import { overlaps, tileBox } from './geometry';
import { position } from './ops';

describe('actions', () => {
  const base = newScenario('Russian');
  it('adds rooms side by side without overlap', () => {
    let s = applyAction(base, 'Russian', 'EventStart', 'tile', 'TileSideAlley1')!.scenario;
    s = applyAction(s, 'Russian', 'EventStart', 'tile', 'TileSideAlley2')!.scenario;
    const tiles = s.components.filter((c) => c.type === 'Tile');
    expect(tiles).toHaveLength(2);
    const [a, b] = tiles.map((t) => tileBox(position(t)!.x, position(t)!.y, 7, 3.5, 0));
    expect(overlaps(a, b)).toBe(false);
    expect(s.components[0].data.add).toContain(tiles[1].name);
    expect(validate(s).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('gives monsters and items, remembers and ends', () => {
    let r = applyAction(base, 'Russian', 'EventStart', 'monster', 'MonsterCultist')!;
    r = applyAction(r.scenario, 'Russian', 'EventStart', 'item', 'ItemCommon18Derringer')!;
    r = applyAction(r.scenario, 'Russian', 'EventStart', 'remember')!;
    expect(r.facts).toEqual({ novyy_fakt: 'Новый факт' });
    r = applyAction(r.scenario, 'Russian', 'EventStart', 'end')!;
    r = applyAction(r.scenario, 'Russian', 'EventStart', 'end')!;
    expect(r.scenario.components[0].data.operations).toBe('novyy_fakt,=,1 $end,=,1');
    expect(r.scenario.components.filter((c) => c.type === 'Spawn' || c.type === 'QItem')).toHaveLength(2);
    const spawn = r.scenario.components.find((c) => c.type === 'Spawn')!;
    expect(r.scenario.components[0].data.event1).toBe(spawn.name);
  });
  it('needs a choice for catalog actions', () => {
    expect(applyAction(base, 'Russian', 'EventStart', 'tile')).toBeNull();
  });
});
