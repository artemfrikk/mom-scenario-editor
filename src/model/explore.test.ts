import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { explore } from './explore';
import { buildTemplate, WIZARD_DEFAULTS, wizardScenario } from './templates';
import { setButtonTargets, updateData } from './ops';

describe('explore', () => {
  it('finds both endings of the wizard scenario', () => {
    const s = wizardScenario({ ...WIZARD_DEFAULTS, title: 'T' }, 'Russian').scenario;
    const r = explore(s);
    expect(r.complete).toBe(true);
    expect(r.endings.map((e) => e.event).sort()).toEqual(['EventLose', 'EventWin']);
    expect(r.neverReached).toEqual([]);
    expect(r.firstEnding).not.toBeNull();
  });

  it('works through a locked door', () => {
    const base = wizardScenario({ ...WIZARD_DEFAULTS }, 'Russian').scenario;
    // The start window ends the story at once, so let it close and leave the board to the players.
    const open = setButtonTargets(base, 'EventStart', 1, []);
    const s = buildTemplate(open, 'Russian', 'locked-door', { event: 'EventStart', button: 1 }, {})!.scenario;
    const r = explore(s);
    expect(r.reached).toContain('EventDoorOpen');
  });

  it('reports a scenario that cannot end', () => {
    let s = newScenario('Russian');
    s = setButtonTargets(s, 'EventStart', 1, []);
    const r = explore(s);
    expect(r.endings).toEqual([]);
    expect(r.firstEnding).toBeNull();
  });

  it('does not reach an event behind a condition nobody satisfies', () => {
    let s = wizardScenario({ ...WIZARD_DEFAULTS }, 'Russian').scenario;
    s = updateData(s, 'EventWin', { vartests: 'VarOperation:never,>,0' });
    const r = explore(s);
    expect(r.neverReached).toContain('EventWin');
  });
});
