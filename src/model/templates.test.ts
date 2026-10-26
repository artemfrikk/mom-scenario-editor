import { describe, expect, it } from 'vitest';
import { buildTemplate, TEMPLATES, WIZARD_DEFAULTS, wizardScenario } from './templates';
import { validate } from './validate';
import { applyFix } from './fixes';
import { startPlay, fire } from './play';
import { addComponent, updateData } from './ops';
import { newScenario } from '../format/scenario';

describe('wizard', () => {
  it('builds a scenario without errors', () => {
    const { scenario, notes } = wizardScenario({ ...WIZARD_DEFAULTS, title: 'Тест', goal: 'найти ключ' }, 'Russian');
    expect(validate(scenario).filter((i) => i.level === 'error')).toEqual([]);
    expect(notes).toContain('найти ключ');
    expect(scenario.texts.Russian['quest.name']).toBe('Тест');
  });
  it('can be played from start to win', () => {
    const { scenario } = wizardScenario({ ...WIZARD_DEFAULTS, title: 'Тест' }, 'Russian');
    let st = startPlay(scenario);
    expect(st.current).toBe('EventStart');
    expect(st.visible.some((n) => n.startsWith('Tile'))).toBe(true);
    st = fire(scenario, st, 'EventGoal');
    st = fire(scenario, st, 'EventWin');
    expect(st.ended).toBe(true);
  });
});

describe('templates', () => {
  it.each(TEMPLATES.map((t) => t.id))('%s adds no errors', (id) => {
    const base = wizardScenario({ ...WIZARD_DEFAULTS, title: 'T' }, 'Russian').scenario;
    const built = buildTemplate(base, 'Russian', id, { event: 'EventGoal', button: 1 });
    expect(built).not.toBeNull();
    expect(validate(built!.scenario).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('shows tokens from the chosen event', () => {
    const s = newScenario('Russian');
    const built = buildTemplate(s, 'Russian', 'search', { event: 'EventStart', button: 1 })!;
    expect(built.scenario.components.find((c) => c.name === 'EventStart')!.data.add).toContain('TokenSearch');
  });
});

describe('fixes', () => {
  it('shows a hidden piece at the start', () => {
    let s = newScenario('Russian');
    [s] = addComponent(s, 'Token', { type: 'TokenSearch', xposition: '0', yposition: '0' });
    expect(validate(s).some((i) => i.fix?.kind === 'showAtStart')).toBe(true);
    const fixed = applyFix(s, validate(s).find((i) => i.fix?.kind === 'showAtStart')!.fix!);
    expect(validate(fixed).some((i) => i.fix?.kind === 'showAtStart')).toBe(false);
  });
  it('drops a broken link', () => {
    const s = updateData(newScenario('Russian'), 'EventStart', { event1: 'EventGone' });
    const issue = validate(s).find((i) => i.fix?.kind === 'dropReference')!;
    const fixed = applyFix(s, issue.fix!);
    expect(validate(fixed).some((i) => i.fix?.kind === 'dropReference')).toBe(false);
  });
});
