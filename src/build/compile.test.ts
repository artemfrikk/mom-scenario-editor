import { describe, expect, it } from 'vitest';
import { scenarioFromFiles, scenarioToFiles } from '../format/valkyrie';
import { choose, defeat, newGame, touch, type GameState } from '../model/game';
import { getComponent } from '../model/ops';
import type { Scenario } from '../format/scenario';
import { compile, tileName, tokenName, usedPacks } from './compile';
import { projectFromScenario } from './load';
import { newProject, type Piece, type Project } from './project';

const piece = (id: string, room: string, kind: Piece['kind'], look: string, outcome: Partial<Piece['outcome']> = {}, extra: Partial<Piece> = {}): Piece => ({
  id,
  room,
  kind,
  look,
  x: 1,
  y: -1,
  title: '',
  outcome: { text: '', once: true, ...outcome },
  ...extra,
});

// Hall (start) -> a desk with a key and a door to the Study -> a cultist in the Study -> defeating it wins.
function sample(): Project {
  return {
    ...newProject(),
    title: 'Тест',
    prologue: { text: 'Вы входите в особняк.', image: '', music: 'AudioAtmosphere2' },
    goal: 'Найдите профессора.',
    rooms: [
      { id: 'R1', tile: 'TileSideHall1', x: 0, y: 0, rot: 0, enterText: '' },
      { id: 'R2', tile: 'TileSideStudy', x: 7, y: 0, rot: 0, enterText: 'Пыльный кабинет.' },
    ],
    pieces: [
      piece('P1', 'R1', 'start', 'TokenInvestigators'),
      piece('P2', 'R1', 'search', 'TokenSearch', { text: 'В столе ключ.', item: 'ItemCommonKnife', clues: 1 }),
      piece('P3', 'R1', 'explore', 'TokenExplore', { text: 'Дверь открыта.', reveal: ['R2'] }),
      piece('P4', 'R2', 'monster', 'MonsterCultist', { text: 'Культист повержен.', win: true }),
    ],
    nextId: 5,
  };
}

const play = (s: Scenario) => {
  let st = newGame(s, ['A', 'B'], () => 0);
  // prologue -> goal -> the board
  while (st.current) st = choose(s, st, 1, () => 0);
  return st;
};
const closeAll = (s: Scenario, st: GameState) => {
  while (st.current) st = choose(s, st, 1, () => 0);
  return st;
};

describe('compile', () => {
  it('starts with the start room and its pieces on the board', () => {
    const s = compile(sample());
    const st = play(s);
    expect(st.visible).toContain(tileName(sample().rooms[0]));
    expect(st.visible).toContain('TokenP2');
    expect(st.visible).toContain('TokenP3');
    expect(st.visible).not.toContain('TileR2');
    expect(getComponent(s, 'EventStart')?.data.music).toBe('AudioAtmosphere2');
  });

  it('a search gives the item and a clue and then disappears', () => {
    const s = compile(sample());
    let st = play(s);
    st = touch(s, st, 'TokenP2', () => 0);
    expect(st.current).toBe('EventP2');
    st = closeAll(s, st);
    expect(st.items).toContain('QItemP2');
    expect(st.clues).toBe(1);
    expect(st.visible).not.toContain('TokenP2');
  });

  it('a door opens the next room once, with its text and its monster', () => {
    const s = compile(sample());
    let st = play(s);
    st = touch(s, st, 'TokenP3', () => 0);
    st = choose(s, st, 1, () => 0); // "Дверь открыта."
    expect(st.current).toBe('EventOpenR2');
    st = closeAll(s, st);
    expect(st.visible).toContain('TileR2');
    expect(st.monsters.map((m) => m.spawn)).toEqual(['SpawnP4']);
  });

  it('defeating the monster wins the game', () => {
    const s = compile(sample());
    let st = play(s);
    st = closeAll(s, touch(s, st, 'TokenP3', () => 0));
    st = defeat(s, st, 0, () => 0);
    expect(st.current).toBe('EventDefeatedP4');
    st = choose(s, st, 1, () => 0);
    expect(st.current).toBe('EventWin');
    st = choose(s, st, 1, () => 0);
    expect(st.ended).toBe(true);
  });

  it('a skill test gives the gifts only on success and keeps the token after a failure', () => {
    const p = sample();
    p.pieces[1].outcome.test = { skill: 'lore', need: 2, pass: 'Замок поддался.', fail: 'Не выходит.' };
    p.pieces[1].outcome.text = 'Стол заперт.';
    const s = compile(p);
    expect(s.texts.Russian['EventP2.text']).toBe('Стол заперт.\n\n<b>Проверка {lore}</b>, нужно 2 {success}');
    expect(s.texts.Russian['EventP2.button2']).toBe('Провал');
    let st = play(s);
    st = touch(s, st, 'TokenP2', () => 0);
    st = choose(s, st, 2, () => 0); // Провал
    expect(st.current).toBe('EventFailP2');
    st = closeAll(s, st);
    expect(st.items).not.toContain('QItemP2');
    expect(st.visible).toContain('TokenP2');
    st = touch(s, st, 'TokenP2', () => 0);
    st = choose(s, st, 1, () => 0); // Успех
    expect(st.current).toBe('EventPassP2');
    st = closeAll(s, st);
    expect(st.items).toContain('QItemP2');
    expect(st.clues).toBe(1);
    expect(st.visible).not.toContain('TokenP2');
  });

  it('two doors to the same room open it only once', () => {
    const p = sample();
    p.pieces.push(piece('P5', 'R1', 'explore', 'TokenExplore', { reveal: ['R2'] }));
    const s = compile(p);
    let st = play(s);
    st = closeAll(s, touch(s, st, 'TokenP3', () => 0));
    st = closeAll(s, touch(s, st, 'TokenP5', () => 0));
    expect(st.monsters).toHaveLength(1);
  });

  it('a monster waiting for an event comes out only when called', () => {
    const p = sample();
    p.pieces[3] = { ...p.pieces[3], room: 'R1', when: 'event' };
    p.pieces[1] = { ...p.pieces[1], outcome: { ...p.pieces[1].outcome, spawn: ['P4'] } };
    const s = compile(p);
    let st = play(s);
    expect(st.monsters).toHaveLength(0);
    st = closeAll(s, touch(s, st, 'TokenP2', () => 0));
    expect(st.monsters).toHaveLength(1);
  });

  it('lists the boxes the scenario needs', () => {
    const p = sample();
    p.rooms[1] = { ...p.rooms[1], tile: 'TileSideAlley1' };
    expect(usedPacks(p)).toEqual([]);
    const withPots = { ...p, pieces: [...p.pieces, piece('P9', 'R1', 'monster', 'MonsterFeatheredSerpent')] };
    expect(usedPacks(withPots)).toEqual(['PotS']);
    expect(compile(withPots).quest.packs).toBe('PotS');
  });

  it('a prologue picture uses the opening screen', () => {
    const p = sample();
    p.prologue.image = 'cover.png';
    const s = compile(p, { 'cover.png': new Uint8Array([1]) });
    expect(getComponent(s, 'UIIntroductionImage')?.data.image).toBe('cover.png');
    const st = newGame(s, ['A'], () => 0);
    expect(st.visible).toContain('UIIntroductionImage');
  });

  it('survives saving and opening again', () => {
    const p = sample();
    const s = compile(p, { 'cover.png': new Uint8Array([1, 2]) });
    const back = scenarioFromFiles(scenarioToFiles(s));
    const { project, assets, foreign } = projectFromScenario(back);
    expect(foreign).toBe(false);
    expect(project).toEqual(p);
    expect(assets['cover.png']).toEqual(new Uint8Array([1, 2]));
    expect(Object.keys(assets)).not.toContain('editor.json');
  });

  it('keeps what it does not understand in a scenario made elsewhere', () => {
    const p = sample();
    const s = compile(p);
    // forget the project file: now it looks like a scenario from another editor
    const foreignFile: Scenario = { ...s, assets: {} };
    const { project, foreign } = projectFromScenario(foreignFile);
    expect(foreign).toBe(true);
    expect(project.rooms.map((r) => r.id)).toEqual(['R1', 'R2']);
    expect(project.title).toBe('Тест');
    const again = compile(project);
    for (const name of ['EventP2', 'SpawnP4', 'TokenP3', 'EventOpenR2']) expect(getComponent(again, name)).toBeTruthy();
    expect(again.components.filter((c) => c.data.trigger === 'EventStart')).toHaveLength(1);
    expect(again.texts.Russian['EventP2.text']).toBe('В столе ключ.\n\n<i>Сыщик получает улику.</i>');
    expect(tokenName(p.pieces[3])).toBe('SpawnP4');
  });
});
