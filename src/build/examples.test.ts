import { describe, expect, it } from 'vitest';
import { choose, newGame, touch, type GameState } from '../model/game';
import type { Scenario } from '../format/scenario';
import { chaptersOf, compileCampaign } from './campaign';
import { checkCampaign, checkProject } from './check';
import { compile } from './compile';
import { exampleCampaign, exampleScenario } from './examples';

const closeAll = (s: Scenario, st: GameState) => {
  while (st.current) st = choose(s, st, 1, () => 0);
  return st;
};

describe('examples', () => {
  it('the scenario has nothing to fix', () => {
    expect(checkProject(exampleScenario())).toEqual([]);
  });

  it('every chapter of the campaign has nothing to fix', () => {
    const chapters = chaptersOf(exampleCampaign());
    expect(chapters).toHaveLength(2);
    chapters.forEach((c, i) => expect([...checkProject(c), ...checkCampaign(chapters, i)]).toEqual([]));
    expect(Object.keys(compileCampaign(chapters, {}).assets)).toContain('ch2/quest.ini');
  });

  it('the house can be played to the end', () => {
    const p = exampleScenario();
    const s = compile(p);
    let st = closeAll(s, newGame(s, ['A'], () => 0));
    const id = (title: string) => 'Token' + p.pieces.find((x) => x.title === title)!.id;
    st = touch(s, st, id('Дверь в библиотеку'), () => 0);
    expect(st.current).toMatch(/^EventLocked/);
    st = closeAll(s, st);
    st = closeAll(s, touch(s, st, id('Секретер'), () => 0)); // the test: button 1 is a pass
    st = closeAll(s, touch(s, st, id('Дверь в библиотеку'), () => 0));
    expect(st.visible).toContain(id('Дворецкий'));
  });

  it('the answer in chapter 1 is remembered for chapter 2', () => {
    const [one] = chaptersOf(exampleCampaign());
    const s = compile(one);
    let st = closeAll(s, newGame(s, ['A'], () => 0));
    st = touch(s, st, 'Token' + one.pieces.find((x) => x.title === 'Служанка')!.id, () => 0);
    st = closeAll(s, choose(s, st, 1, () => 0));
    expect(Object.entries(st.vars).some(([k, v]) => k.startsWith('%mark_') && v === 1)).toBe(true);
  });
});
