import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { adjustHp, buttonState, choose, defeat, endInvestigatorPhase, eliminated, adjustClues, newGame, next, queueEvent, puzzleClose, puzzleFinish, puzzleSet, puzzleSolve, newRound, nextPhase, randomItems, touch, windowText } from './game';
import { addComponent, setButtonTargets, setText, updateData } from './ops';
import { buildTemplate, WIZARD_DEFAULTS, wizardScenario } from './templates';

const rng = () => 0;
const heroes = ['Анна', 'Борис'];

describe('game', () => {
  it('plays the wizard scenario from intro to victory', () => {
    const s = wizardScenario({ ...WIZARD_DEFAULTS, title: 'T' }, 'Russian').scenario;
    let st = newGame(s, heroes, rng);
    expect(st.current).toBe('EventStart');
    expect(st.visible.some((n) => n.startsWith('Tile'))).toBe(true);
    st = choose(s, st, 1, rng);
    expect(st.current).toBe('EventGoal');
    st = choose(s, st, 1, rng);
    expect(st.current).toBe('EventWin');
    st = choose(s, st, 1, rng);
    expect(st.ended).toBe(true);
  });

  it('opens a locked door only after the key is found', () => {
    const built = buildTemplate(newScenario('Russian'), 'Russian', 'locked-door', { event: 'EventStart', button: 1 }, {})!;
    const s = built.scenario;
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng); // close the intro
    expect(st.visible).toContain(built.first);
    st = touch(s, st, built.first, rng);
    expect(buttonState(s.components.find((c) => c.name === built.first)!, 1, st.vars)).toBe('disabled');
    st = choose(s, st, 2, rng); // step away
    st = touch(s, st, 'TokenKey', rng);
    st = choose(s, st, 1, rng);
    st = touch(s, st, built.first, rng);
    expect(buttonState(s.components.find((c) => c.name === built.first)!, 1, st.vars)).toBe('ok');
    st = choose(s, st, 1, rng);
    expect(st.current).toBe('EventDoorOpen');
    st = choose(s, st, 1, rng);
    expect(st.visible).not.toContain(built.first);
  });

  it('brings a monster out of a Spawn and fires Defeated events', () => {
    let s = newScenario('Russian');
    const built = buildTemplate(s, 'Russian', 'ambush', { event: 'EventStart', button: 1 }, {})!;
    s = built.scenario;
    let w: string;
    [s, w] = addComponent(s, 'Event', { trigger: 'DefeatedSpawnAmbush' }, 'Cheer');
    s = setText(s, 'Russian', w + '.text', 'Победа над монстром');
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng); // intro -> ambush
    st = choose(s, st, 1, rng); // ambush -> spawn
    expect(st.monsters).toHaveLength(1);
    expect(st.monsters[0].maxHp).toBeGreaterThan(0);
    st = choose(s, st, 1, rng);
    st = adjustHp(st, 0, -1);
    st = defeat(s, st, 0, rng);
    expect(st.monsters).toHaveLength(0);
    expect(st.current).toBe(w);
  });

  it('runs rounds: mythos events, then end-of-round and start-of-round events', () => {
    let s = newScenario('Russian');
    let m: string, r: string;
    [s, m] = addComponent(s, 'Event', { trigger: 'Mythos', operations: 'mythos,+,1', display: 'false' }, 'M');
    [s, r] = addComponent(s, 'Event', { trigger: 'StartRound', operations: 'rounds,+,1', display: 'false' }, 'R');
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng);
    expect(st.vars.rounds).toBe(1);
    st = endInvestigatorPhase(s, st, rng);
    expect(st.vars.mythos).toBe(1);
    expect(st.phase).toBe('mythos');
    st = newRound(s, st, rng);
    expect(st.round).toBe(2);
    expect(st.vars['#round']).toBe(2);
    expect(st.vars.rounds).toBe(2);
    expect(st.phase).toBe('investigator');
    void m;
    void r;
  });

  it('skips events whose condition fails and picks the first enabled target', () => {
    let s = newScenario('Russian');
    let a: string, b: string;
    [s, a] = addComponent(s, 'Event', { vartests: 'VarOperation:flag,>,0' }, 'A');
    [s, b] = addComponent(s, 'Event', {}, 'B');
    s = setButtonTargets(s, 'EventStart', 1, [a, b]);
    for (const n of [a, b]) s = setText(s, 'Russian', n + '.text', 'Текст');
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng);
    expect(st.current).toBe(b);
    s = updateData(s, 'EventStart', { operations: 'flag,=,1' });
    st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng);
    expect(st.current).toBe(a);
  });

  it('ends on the Eliminated trigger', () => {
    const s = wizardScenario({ ...WIZARD_DEFAULTS }, 'Russian').scenario;
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng);
    st = choose(s, st, 1, rng);
    st = eliminated(s, { ...st, current: null }, rng);
    expect(st.current).toBe('EventLose');
  });
});

describe('window text', () => {
  it('names a spawn by its monster and never repeats its own text', () => {
    let s = newScenario('Russian');
    let sp: string;
    [s, sp] = addComponent(s, 'Spawn', { monster: 'MonsterDeepOne' }, 'DeepOne');
    s = setText(s, 'Russian', sp + '.text', `Появляется <color=Cyan>{c:${sp}}</color>.`);
    const st = newGame(s, ['A'], () => 0);
    expect(windowText(s, st, 'Russian', sp, () => 'Глубоководный')).toBe('Появляется <color=Cyan>Глубоководный</color>.');
    expect(windowText(s, st, 'Russian', sp)).toBe(`Появляется <color=Cyan>${sp}</color>.`);
  });

  it('walks the Valkyrie round: sleuths, mythos, monsters, horror, new round', () => {
    const s = newScenario('Russian');
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng);
    st = endInvestigatorPhase(s, st, rng);
    st = nextPhase(st);
    expect(st.phase).toBe('monsters');
    st = nextPhase(st);
    expect(st.phase).toBe('horror');
    st = newRound(s, st, rng);
    expect(st.phase).toBe('investigator');
    expect(st.round).toBe(2);
  });

  it('closes a cancelable window without going on', () => {
    let s = newScenario('Russian');
    let a: string;
    [s, a] = addComponent(s, 'Event', { trigger: 'StartRound', cancelable: 'true' }, 'A');
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng); // the intro
    expect(st.current).toBe(a);
    st = choose(s, st, 0, rng);
    expect(st.current).toBeNull();
  });

  it('starts with the chosen clues and items, at most six', () => {
    const s = newScenario('Russian');
    const st = newGame(s, heroes, rng, { clues: 9, items: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });
    expect(st.clues).toBe(6);
    expect(st.startItems).toHaveLength(6);
    expect(adjustClues(st, -10).clues).toBe(0);
  });

  it('draws distinct random items', () => {
    let n = 0;
    const items = randomItems(4, () => ((n += 7) % 100) / 100);
    expect(items).toHaveLength(4);
    expect(new Set(items).size).toBe(4);
    expect(randomItems(99)).toHaveLength(6);
  });

  it('a puzzle blocks the button until solved, can be put aside and picked up again', () => {
    let s = newScenario('Russian');
    let door: string, p: string, done: string;
    [s, done] = addComponent(s, 'Event', { operations: 'opened,=,1', display: 'false' }, 'Done');
    [s, p] = addComponent(s, 'Puzzle', { class: 'tower', puzzlelevel: '2', event1: done }, 'Lock');
    [s, door] = addComponent(s, 'Event', { trigger: 'StartRound', event1: p }, 'Go');
    s = setButtonTargets(s, door, 1, [p]);
    s = setText(s, 'Russian', door + '.text', 'Текст');
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng); // intro
    st = choose(s, st, 1, rng); // Go
    expect(st.current).toBe(p);
    expect(st.puzzle?.kind).toBe('tower');
    expect(puzzleFinish(s, st, rng).current).toBe(p); // not solved: nothing happens
    const first = st.puzzle!;
    st = puzzleClose(s, puzzleSet(st, { ...first, moves: 5 } as typeof first), rng);
    expect(st.current).toBeNull();
    expect(st.puzzles[p]).toBeTruthy();
    st = next(s, queueEvent(s, st, p), rng); // whatever leads to the puzzle is used again
    expect(st.puzzle && 'moves' in st.puzzle && st.puzzle.moves).toBe(5); // picked up where it was left
    st = puzzleFinish(s, puzzleSolve(st), rng);
    expect(st.vars.opened).toBe(1);
    expect(st.puzzles[p]).toBeUndefined();
  });

  it('an event that names a sound or music leaves a cue for the screen', () => {
    let s = newScenario('Russian');
    [s] = addComponent(s, 'Event', { trigger: 'StartRound', audio: 'door.ogg', music: 'theme.ogg', display: 'false' }, 'Sound');
    let st = newGame(s, heroes, rng);
    st = choose(s, st, 1, rng); // the intro, then the sound event runs
    expect(st.cue).toEqual({ id: 1, audio: 'door.ogg', music: 'theme.ogg' });
  });
});
