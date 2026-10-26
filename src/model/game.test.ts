import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { adjustHp, buttonState, choose, defeat, endInvestigatorPhase, eliminated, newGame, newRound, touch } from './game';
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
