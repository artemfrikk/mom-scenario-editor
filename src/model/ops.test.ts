import { describe, expect, it } from 'vitest';
import { newScenario, type Scenario } from '../format/scenario';
import {
  addButton,
  addComponent,
  addedBy,
  buttonsOf,
  deleteComponent,
  getComponent,
  removeButton,
  renameComponent,
  setAddedBy,
  setButtonTargets,
  setText,
} from './ops';
import { validate } from './validate';

function sample(): Scenario {
  let s = newScenario('Russian');
  let a: string, t: string;
  [s, a] = addComponent(s, 'Event', {}, 'Hall');
  [s, t] = addComponent(s, 'Tile', { side: 'TileSideAlley1', xposition: '0', yposition: '0' });
  s = setButtonTargets(s, 'EventStart', 1, [a]);
  s = setAddedBy(s, t, ['EventStart']);
  s = setText(s, 'Russian', a + '.text', 'Холл');
  s = setText(s, 'Russian', a + '.button1', 'Дальше');
  return s;
}

describe('ops', () => {
  it('creates unique names', () => {
    const s = sample();
    expect(s.components.map((c) => c.name)).toEqual(['EventStart', 'EventHall', 'Tile1']);
    expect(addComponent(s, 'Event', {}, 'Hall')[1]).toBe('EventHall1');
  });

  it('renames a component everywhere', () => {
    const s = renameComponent(sample(), 'EventHall', 'EventFoyer');
    expect(buttonsOf(getComponent(s, 'EventStart')!)[0].targets).toEqual(['EventFoyer']);
    expect(s.texts.Russian['EventFoyer.text']).toBe('Холл');
    expect(s.texts.Russian['EventHall.text']).toBeUndefined();

    const t = renameComponent(s, 'Tile1', 'TileEntry');
    expect(getComponent(t, 'EventStart')!.data.add).toBe('TileEntry');
  });

  it('deletes a component and its references', () => {
    const s = deleteComponent(sample(), 'EventHall');
    expect(getComponent(s, 'EventHall')).toBeUndefined();
    expect(getComponent(s, 'EventStart')!.data.event1).toBe('');
    expect(s.texts.Russian['EventHall.text']).toBeUndefined();
  });

  it('adds and removes buttons, shifting the ones after', () => {
    let s = sample();
    s = addButton(s, 'EventStart', 'Второй', 'Russian');
    s = addButton(s, 'EventStart', 'Третий', 'Russian');
    s = setButtonTargets(s, 'EventStart', 3, ['EventHall']);
    s = removeButton(s, 'EventStart', 2);
    const c = getComponent(s, 'EventStart')!;
    expect(c.data.buttons).toBe('2');
    expect(c.data.event2).toBe('EventHall');
    expect(c.data.event3).toBeUndefined();
    expect(s.texts.Russian['EventStart.button2']).toBe('Третий');
    expect(s.texts.Russian['EventStart.button3']).toBeUndefined();
  });

  it('tracks which events show a board component', () => {
    let s = sample();
    expect(addedBy(s, 'Tile1')).toEqual(['EventStart']);
    s = setAddedBy(s, 'Tile1', ['EventHall']);
    expect(addedBy(s, 'Tile1')).toEqual(['EventHall']);
    expect(getComponent(s, 'EventStart')!.data.add).toBeUndefined();
  });
});

describe('validate', () => {
  it('finds broken links and hidden board pieces', () => {
    let s = sample();
    expect(validate(s).filter((i) => i.level === 'error')).toEqual([]);
    s = setButtonTargets(s, 'EventHall', 1, ['EventMissing']);
    s = setAddedBy(s, 'Tile1', []);
    const messages = validate(s).map((i) => i.message).join('\n');
    expect(messages).toContain('EventMissing');
    expect(messages).toContain('Tile1: ни одно событие');
  });
});
