import { describe, expect, it } from 'vitest';
import { choose, newGame, touch } from '../model/game';
import { compile } from './compile';
import { newProject, type Project } from './project';

// The butler can be saved or left; the professor later says different words.
function sample(): Project {
  return {
    ...newProject(),
    title: 'Решение',
    rooms: [{ id: 'R1', tile: 'TileSideHall1', x: 0, y: 0, rot: 0, enterText: '' }],
    pieces: [
      { id: 'P1', room: 'R1', kind: 'start', look: 'TokenInvestigators', x: 1, y: -1, title: '', outcome: { text: '', once: true } },
      {
        id: 'P2',
        room: 'R1',
        kind: 'npc',
        look: 'TokenGreyMan',
        x: 2,
        y: -1,
        title: 'Дворецкий',
        outcome: {
          text: 'Дворецкий ранен.',
          once: true,
          choices: [
            { id: 'c1', label: 'Помочь', outcome: { text: 'Вы перевязываете рану.', once: false } },
            { id: 'c2', label: 'Бросить', outcome: { text: 'Вы уходите.', once: false } },
          ],
        },
      },
      {
        id: 'P3',
        room: 'R1',
        kind: 'npc',
        look: 'TokenGreyWoman',
        x: 3,
        y: -1,
        title: 'Профессор',
        outcome: { text: '«Где мой слуга?»', clues: 1, once: true, win: true, ifs: [{ id: 'i1', needs: ['P2.c1'], text: '«Спасибо, что спасли его».' }] },
      },
    ],
    nextId: 10,
  };
}

describe('texts that depend on what happened', () => {
  it('reads the other text when the answer was chosen', () => {
    const s = compile(sample());
    let st = newGame(s, ['A'], () => 0);
    while (st.current) st = choose(s, st, 1, () => 0);
    st = touch(s, st, 'TokenP2', () => 0);
    st = choose(s, st, 1, () => 0); // Помочь
    while (st.current) st = choose(s, st, 1, () => 0);
    st = touch(s, st, 'TokenP3', () => 0);
    expect(st.current).toBe('EventP3Ifi1');
    expect(st.clues).toBe(1);
  });

  it('reads the usual text otherwise', () => {
    const s = compile(sample());
    let st = newGame(s, ['A'], () => 0);
    while (st.current) st = choose(s, st, 1, () => 0);
    st = touch(s, st, 'TokenP2', () => 0);
    st = choose(s, st, 2, () => 0); // Бросить
    while (st.current) st = choose(s, st, 1, () => 0);
    st = touch(s, st, 'TokenP3', () => 0);
    expect(st.current).toBe('EventP3Else');
  });
});
