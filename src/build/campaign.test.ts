import { describe, expect, it } from 'vitest';
import { scenarioFromFiles, scenarioToFiles } from '../format/valkyrie';
import { parseIni } from '../format/ini';
import { chaptersOf, compileCampaign, newChapter } from './campaign';
import { checkCampaign } from './check';
import { projectFromScenario } from './load';
import { newProject, type Project } from './project';

function two(): Project[] {
  const first: Project = {
    ...newProject(),
    title: 'Кампания',
    chapter: 'ch1',
    next: { win: 'ch2' },
    marks: [{ id: 'ch1m9', label: 'Дворецкий спасён' }],
    rooms: [{ id: 'R1', tile: 'TileSideHall1', x: 0, y: 0, rot: 0, enterText: '' }],
    pieces: [
      { id: 'P1', room: 'R1', kind: 'start', look: 'TokenInvestigators', x: 1, y: -1, title: '', outcome: { text: '', once: true } },
      { id: 'P2', room: 'R1', kind: 'npc', look: 'TokenGreyMan', x: 2, y: -1, title: '', outcome: { text: 'Спасибо!', once: true, remember: ['ch1m9'], win: true } },
    ],
    nextId: 10,
  };
  const second: Project = {
    ...newChapter([first]),
    rooms: [{ id: 'R1', tile: 'TileSideHall1', x: 0, y: 0, rot: 0, enterText: '' }],
    pieces: [
      { id: 'P1', room: 'R1', kind: 'start', look: 'TokenInvestigators', x: 1, y: -1, title: '', outcome: { text: '', once: true } },
      { id: 'P2', room: 'R1', kind: 'explore', look: 'TokenExplore', x: 2, y: -1, title: '', outcome: { text: 'Дворецкий открывает дверь.', once: true, win: true, lock: { needs: ['%ch1m9'], text: 'Заперто.' } } },
    ],
  };
  return [first, second];
}

describe('campaign', () => {
  it('packs the next chapter into its own folder and moves there after the win', () => {
    const s = compileCampaign(two(), {});
    const files = scenarioToFiles(s);
    expect(Object.keys(files)).toContain('ch2/quest.ini');
    expect(Object.keys(files).some((k) => k.startsWith('ch2/editor.json'))).toBe(false);
    const win = s.components.find((c) => c.name === 'EventWin')!;
    expect(win.data.event1).toBe('ch2/quest.ini');
    expect(win.data.operations ?? '').not.toContain('$end');
    expect(s.quest.hidden).toBe('False');
    const ch2 = parseIni(new TextDecoder().decode(files['ch2/quest.ini']));
    expect(ch2.sections.get('Quest')?.hidden).toBe('True');
  });

  it('a mark set in one chapter is a % variable the next chapter checks', () => {
    const s = compileCampaign(two(), {});
    expect(s.components.find((c) => c.name === 'EventP2')!.data.operations).toContain('%mark_ch1m9,=,1');
    const files = scenarioToFiles(s);
    const events = new TextDecoder().decode(files['ch2/events.ini']) + new TextDecoder().decode(files['ch2/tokens.ini'] ?? new Uint8Array());
    expect(events).toContain('VarOperation:%mark_ch1m9,==,1');
  });

  it('opens again as the same chapters', () => {
    const s = scenarioFromFiles(scenarioToFiles(compileCampaign(two(), {})));
    const { project, assets } = projectFromScenario(s);
    expect(Object.keys(assets).some((k) => k.startsWith('ch2/'))).toBe(false);
    const chapters = chaptersOf(project);
    expect(chapters.map((c) => c.chapter)).toEqual(['ch1', 'ch2']);
    expect(chapters[1].pieces[1].outcome.lock?.needs).toEqual(['%ch1m9']);
    expect(chapters[0].campaign).toBeUndefined();
  });

  it('a single scenario stays as it was', () => {
    const s = compileCampaign([{ ...newProject(), title: 'Один' }], {});
    expect(s.components.find((c) => c.name === 'EventWin')!.data.operations).toBe('$end,=,1');
    expect(Object.keys(scenarioToFiles(s)).some((k) => k.startsWith('ch'))).toBe(false);
  });

  it('warns about a chapter nobody reaches and a mark nobody sets', () => {
    const [a, b] = two();
    expect(checkCampaign([a, b], 1)).toEqual([]);
    const lost = checkCampaign([{ ...a, next: undefined, pieces: a.pieces.map((x) => ({ ...x, outcome: { ...x.outcome, remember: [] } })) }, b], 1).map((x) => x.text);
    expect(lost.some((t) => t.includes('не ведёт'))).toBe(true);
    expect(lost.some((t) => t.includes('отметку'))).toBe(true);
  });
});

describe('campaign in the play-through', () => {
  it('the button to the next chapter ends the trial game with a note', async () => {
    const { compile } = await import('./compile');
    const { choose, newGame, touch } = await import('../model/game');
    const s = compile(two()[0]);
    let st = newGame(s, ['A'], () => 0);
    while (st.current) st = choose(s, st, 1, () => 0);
    st = touch(s, st, 'TokenP2', () => 0);
    while (st.current) st = choose(s, st, 1, () => 0);
    expect(st.ended).toBe(true);
    expect(st.vars['%mark_ch1m9']).toBe(1);
    expect(st.log.join('\n')).toContain('следующую главу');
  });
});
