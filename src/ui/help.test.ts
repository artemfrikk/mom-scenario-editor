import { describe, expect, it } from 'vitest';
import { imageKey } from '../images';
import { newScenario } from '../format/scenario';
import { describeComponent, triggerHelp } from './help';

describe('imageKey', () => {
  it('ignores folders, extension and case', () => {
    expect(imageKey('img/Tile_Alley_1_MAD20')).toBe('tile_alley_1_mad20');
    expect(imageKey('C:\\x\\img\\Tile_Alley_1_MAD20.PNG')).toBe('tile_alley_1_mad20');
    expect(imageKey(undefined)).toBe('');
  });
});

describe('help texts', () => {
  it('explains the start event and what it leads to', () => {
    const s = newScenario('Russian');
    const text = describeComponent(s, 'Russian', 'EventStart');
    expect(text).toContain('Начало сценария');
    expect(text).toContain('Вступление к вашему сценарию');
  });
  it('knows every built-in trigger', () => {
    expect(triggerHelp('EventStart')).toContain('начале');
    expect(triggerHelp('DefeatedMonsterCultist')).toContain('побеждён');
  });
});
