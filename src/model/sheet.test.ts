import { describe, expect, it } from 'vitest';
import { buildSheet } from './sheet';
import { buildTemplate, WIZARD_DEFAULTS, wizardScenario } from './templates';

describe('sheet', () => {
  it('lists events in story order with plain sentences', () => {
    const base = wizardScenario({ ...WIZARD_DEFAULTS, title: 'T' }, 'Russian').scenario;
    const built = buildTemplate(base, 'Russian', 'locked-door', { event: 'EventStart', button: 1 }, {})!;
    const sheet = buildSheet(built.scenario, 'Russian', built.facts, (t) => t);
    expect(sheet.map((e) => e.name).slice(0, 3)).toEqual(['EventStart', 'EventGoal', 'EventWin']);
    const door = sheet.find((e) => e.name === built.first)!;
    expect(door.buttons[0].condition).toBe('«Есть ключ»: уже известно');
    expect(sheet.find((e) => e.name === 'TokenKey')!.remembers[0]).toBe('«Есть ключ»: становится известным');
  });
});
