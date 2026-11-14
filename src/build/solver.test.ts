import { describe, expect, it } from 'vitest';
import { compile } from './compile';
import { exampleScenario } from './examples';
import { newProject, type Piece, type Project } from './project';
import { solve } from './solver';

const name = (x: Piece) => `${x.kind}:${x.title || x.id}`;

describe('can the investigators win', () => {
  it('finds a way through the example house', async () => {
    const p = exampleScenario();
    const v = await solve(p, compile(p), name);
    expect(v.win).toBe(true);
    expect(v.complete).toBe(true);
    expect(v.path.length).toBeGreaterThan(3);
    expect(v.traps).toEqual([]);
  });

  it('finds the answer after which victory is gone, and what nobody reaches', async () => {
    const p: Project = {
      ...newProject(),
      title: 'Тупик',
      rooms: [
        { id: 'R1', tile: 'TileSideHall1', x: 0, y: 0, rot: 0, enterText: '' },
        { id: 'R2', tile: 'TileSideStudy', x: 7, y: 0, rot: 0, enterText: '' },
      ],
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
            text: 'Он ранен.',
            once: true,
            choices: [
              { id: 'c1', label: 'Помочь', outcome: { text: 'Он отдаёт ключ.', once: false } },
              { id: 'c2', label: 'Бросить', outcome: { text: 'Вы уходите.', once: false } },
            ],
          },
        },
        { id: 'P3', room: 'R1', kind: 'explore', look: 'TokenExplore', x: 3, y: -1, title: 'Дверь', outcome: { text: 'Открыто.', once: true, reveal: ['R2'], lock: { needs: ['P2.c1'], text: 'Заперто.' } } },
        { id: 'P4', room: 'R2', kind: 'search', look: 'TokenSearch', x: 8, y: -1, title: 'Сейф', outcome: { text: 'Победа.', once: true, win: true } },
        { id: 'P5', room: 'R1', kind: 'search', look: 'TokenSearch', x: 4, y: -1, title: 'Тайник', outcome: { text: 'Ничего.', once: true, lock: { needs: ['P6'], text: 'Нет.' } } },
        { id: 'P6', room: 'R2', kind: 'monster', look: 'MonsterCultist', x: 9, y: -1, title: 'Культист', when: 'event', outcome: { text: '', once: true } },
      ],
      nextId: 10,
    };
    const v = await solve(p, compile(p), name);
    expect(v.win).toBe(true);
    expect(v.traps.map((t) => t.move)).toEqual(['npc:Дворецкий: «Бросить»']);
    expect(v.unreached).toContain('monster:Культист');
  });
});
