import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { addComponent } from './ops';
import { reverseOf, takenSides } from './tiles';

describe('tiles', () => {
  it('knows both directions of a double-sided card', () => {
    expect(reverseOf('TileSideAlley1')).toBe('TileSideBedroom1');
    expect(reverseOf('TileSideBedroom1')).toBe('TileSideAlley1');
  });
  it('blocks a used side and its back, except for the tile being edited', () => {
    const [s, name] = addComponent(newScenario('Russian'), 'Tile', { side: 'TileSideAlley1', xposition: '0', yposition: '0' }, 'Alley1');
    const taken = takenSides(s);
    expect(taken.get('TileSideAlley1')).toBe('used');
    expect(taken.get('TileSideBedroom1')).toBe('back');
    expect(takenSides(s, name).size).toBe(0);
  });
});
