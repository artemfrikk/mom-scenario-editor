import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { newGame, choose, touch } from './game';
import { addComponent, getComponent } from './ops';
import { addDoorOn, addSearchOn, doorModeOf, foundOf, placeInvestigators, roomText, setDoorMode, setFound, setRoomText, startsHere } from './objects';

const rng = () => 0;
const L = 'Russian';

function withTile() {
  const [s, tile] = addComponent(newScenario(L), 'Tile', { side: 'TileSideHall', xposition: '0', yposition: '0' }, 'Hall');
  return { s, tile };
}

describe('map constructor', () => {
  it('writes the room text and places the investigators, creating the start of the story', () => {
    const { s, tile } = withTile();
    let out = setRoomText(s, L, tile, 'Вы в холле.');
    expect(roomText(out, L, tile)).toBe('Вы в холле.');
    out = placeInvestigators(out, L, tile);
    expect(startsHere(out, tile)).toBe(true);
    const st = newGameStarted(out);
    expect(st.visible).toContain(tile);
    expect(st.visible.some((n) => getComponent(out, n)?.data.type === 'TokenInvestigators')).toBe(true);
  });

  it('moves the investigators to another room', () => {
    let { s, tile } = withTile();
    let b: string;
    [s, b] = addComponent(s, 'Tile', { side: 'TileSideHall', xposition: '7', yposition: '0' }, 'Cellar');
    s = placeInvestigators(placeInvestigators(s, L, tile), L, b);
    expect(startsHere(s, b)).toBe(true);
    expect(startsHere(s, tile)).toBe(false);
    expect(s.components.filter((c) => c.data.type === 'TokenInvestigators')).toHaveLength(1);
  });

  it('a search token gives a clue, a weapon or an item', () => {
    const { s, tile } = withTile();
    const r = addSearchOn(placeInvestigators(s, L, tile), L, tile);
    let out = setFound(r.scenario, L, r.name, 'clue');
    expect(foundOf(out, r.name).kind).toBe('clue');
    let st = newGameStarted(out);
    st = touch(out, st, r.name, rng);
    st = choose(out, st, 1, rng); // close the token text
    st = choose(out, st, 1, rng); // take what was found
    expect(st.clues).toBe(1);
    out = setFound(out, L, r.name, 'weapon');
    expect(foundOf(out, r.name).kind).toBe('weapon');
    expect(out.components.filter((c) => c.type === 'QItem')).toHaveLength(1);
    out = setFound(out, L, r.name, 'item', 'ItemCommonDynamite');
    expect(foundOf(out, r.name)).toEqual({ kind: 'item', item: 'ItemCommonDynamite' });
    expect(out.components.filter((c) => c.type === 'QItem')).toHaveLength(1);
    out = setFound(out, L, r.name, 'nothing');
    expect(out.components.filter((c) => c.type === 'QItem')).toHaveLength(0);
  });

  it('doors: open, key, skill check, monster behind', () => {
    const { s, tile } = withTile();
    const r = addDoorOn(placeInvestigators(s, L, tile), L, tile);
    const door = r.name;
    expect(doorModeOf(r.scenario, door)).toBe('open');
    let st = touch(r.scenario, newGameStarted(r.scenario), door, rng);
    st = choose(r.scenario, st, 1, rng); // press the door
    expect(st.visible).not.toContain(door);

    const k = setDoorMode(r.scenario, L, door, 'key');
    expect(doorModeOf(k.scenario, door)).toBe('key');
    expect(Object.keys(k.facts)).toHaveLength(1);
    expect(k.scenario.components.filter((c) => c.type === 'Door')).toHaveLength(1);

    const sk = setDoorMode(k.scenario, L, door, 'skill');
    expect(doorModeOf(sk.scenario, door)).toBe('skill');
    expect(sk.scenario.components.some((c) => c.data.event1Condition)).toBe(false);
    expect(sk.scenario.components.filter((c) => c.type === 'Token' && c.data.type === 'TokenSearch')).toHaveLength(0);

    const m = setDoorMode(sk.scenario, L, door, 'monster');
    expect(doorModeOf(m.scenario, door)).toBe('monster');
    let ms = touch(m.scenario, newGameStarted(m.scenario), door, rng);
    ms = choose(m.scenario, ms, 1, rng); // press the door
    ms = choose(m.scenario, ms, 1, rng); // the open window
    expect(ms.monsters).toHaveLength(1);
  });
});

// Start a game and press through every opening window.
function newGameStarted(sc: ReturnType<typeof newScenario>) {
  let st = newGame(sc, ['А'], rng);
  while (st.current) st = choose(sc, st, 1, rng);
  return st;
}
