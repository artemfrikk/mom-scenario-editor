import { describe, expect, it } from 'vitest';
import { choose, endInvestigatorPhase, newGame, newRound, nextPhase, touch, type GameState } from '../model/game';
import { getComponent } from '../model/ops';
import type { Scenario } from '../format/scenario';
import { compile } from './compile';
import { newProject, type Piece, type Project } from './project';

const piece = (id: string, room: string, kind: Piece['kind'], look: string, outcome: Partial<Piece['outcome']> = {}): Piece => ({
  id,
  room,
  kind,
  look,
  x: 1,
  y: -1,
  title: '',
  outcome: { text: '', once: true, ...outcome },
});

function base(): Project {
  return {
    ...newProject(),
    title: 'Баланс',
    rooms: [{ id: 'R1', tile: 'TileSideHall1', x: 0, y: 0, rot: 0, enterText: '' }],
    pieces: [piece('P1', 'R1', 'start', 'TokenInvestigators'), piece('P2', 'R1', 'search', 'TokenSearch', { text: 'Ключ.', win: true })],
    nextId: 5,
  };
}

const closeAll = (s: Scenario, st: GameState) => {
  while (st.current) st = choose(s, st, 1, () => 0);
  return st;
};
const start = (s: Scenario, heroes: number) => closeAll(s, newGame(s, Array.from({ length: heroes }, (_, i) => 'H' + i), () => 0));
// play rounds until the mythos phase of round `upTo`, returning the window it opens (or null)
function mythosOf(s: Scenario, st: GameState, upTo: number): [GameState, string | null] {
  for (;;) {
    st = endInvestigatorPhase(s, st, () => 0);
    if (st.round === upTo) return [st, st.current];
    st = closeAll(s, st);
    st = closeAll(s, newRound(s, nextPhase(nextPhase(st)), () => 0));
  }
}

describe('balance by the number of investigators', () => {
  it('time runs out later for one investigator and earlier for five', () => {
    const p = base();
    p.mythos = { level: 1, rises: [], adapt: true };
    p.timeline = [{ id: 'T3', round: 4, every: false, lose: true, outcome: { text: 'Поздно.', once: false } }];
    const s = compile(p);
    expect(getComponent(s, 'EventTimeT3')!.data.vartests).toBe('VarOperation:#round,==,due_T3');
    expect(mythosOf(s, start(s, 3), 4)[1]).toBe('EventTimeT3');
    expect(mythosOf(s, start(s, 1), 4)[1]).toBeNull();
    expect(mythosOf(s, start(s, 1), 6)[1]).toBe('EventTimeT3');
    expect(mythosOf(s, start(s, 5), 3)[1]).toBe('EventTimeT3');
  });

  it('without the box ticked the rounds stay as they are', () => {
    const p = base();
    p.timeline = [{ id: 'T3', round: 4, every: false, lose: true, outcome: { text: 'Поздно.', once: false } }];
    const s = compile(p);
    expect(getComponent(s, 'EventTimeT3')!.data.vartests).toBe('VarOperation:#round,==,4');
    expect(s.components.some((c) => c.name.startsWith('EventPace'))).toBe(false);
  });

  it('with four investigators an ordinary monster comes with a twin, the boss does not', () => {
    const p = base();
    p.moreMonsters = true;
    p.pieces.push(piece('P3', 'R1', 'monster', 'MonsterCultist'), piece('P4', 'R1', 'monster', 'MonsterGhost', { win: true }));
    p.pieces[1] = { ...p.pieces[1], outcome: { ...p.pieces[1].outcome, win: undefined } };
    const s = compile(p);
    expect(getComponent(s, 'SpawnP3Twin')).toBeDefined();
    expect(getComponent(s, 'SpawnP4Twin')).toBeUndefined();
    expect(start(s, 4).monsters.map((m) => m.spawn).sort()).toEqual(['SpawnP3', 'SpawnP3Twin', 'SpawnP4']);
    expect(start(s, 2).monsters.map((m) => m.spawn).sort()).toEqual(['SpawnP3', 'SpawnP4']);
  });
});

describe('own mythos events', () => {
  it('a pool in the mythos phase picks one of them; "only" silences the game\'s events', () => {
    const p = base();
    p.mythos = {
      level: 2,
      rises: [],
      mode: 'only',
      own: [{ id: 'Y7', from: 1, once: true, outcome: { text: 'Шёпот.', once: false, test: { skill: 'will', need: 1, pass: 'Ок.', fail: 'Страшно.', harm: { kind: 'horror', amount: 1, who: 'one' } } } }],
    };
    const s = compile(p);
    expect(getComponent(s, 'EventMythosOwn')!.data).toMatchObject({ trigger: 'Mythos', randomevents: 'true', event1: 'EventY7' });
    expect(getComponent(s, 'EventStart')!.data.operations).toContain('$mythosMinor,=,0');
    expect(getComponent(s, 'EventStart')!.data.operations).toContain('$mythosMajor,=,0');
    let [st, shown] = mythosOf(s, start(s, 2), 1);
    expect(shown).toBe('EventY7');
    st = choose(s, st, 2, () => 0); // failed
    expect(st.current).toBe('EventFailY7');
    st = closeAll(s, st);
    // once: not again
    st = closeAll(s, newRound(s, nextPhase(nextPhase(st)), () => 0));
    expect(mythosOf(s, st, 2)[1]).toBeNull();
    // the token on the map still works
    expect(touch(s, start(s, 2), 'TokenP2', () => 0).current).toBe('EventP2');
  });

  it('"together" mode adds quiet draws and keeps the game\'s flags', () => {
    const p = base();
    p.mythos = { level: 1, rises: [], own: [{ id: 'Y7', from: 3, once: false, outcome: { text: 'Шёпот.', once: false } }] };
    const s = compile(p);
    expect(getComponent(s, 'EventMythosOwn')!.data.event1).toBe('EventY7 EventMythosQuiet1');
    expect(getComponent(s, 'EventY7')!.data.vartests).toBe('VarOperation:#round,>=,3');
    expect(getComponent(s, 'EventStart')!.data.operations).toContain('$mythosMinor,=,1');
  });
});
