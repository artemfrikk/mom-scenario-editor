import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { buttonsOf, getComponent, getText } from './ops';
import { notesToStory, storyParagraphs } from './story';
import { validate } from './validate';

describe('notes to story', () => {
  it('splits paragraphs and skips headings', () => {
    expect(storyParagraphs('# Сюжет\n\nПервый абзац.\nЕщё строка.\n\n## Конец\n\n- Второй\n\n')).toEqual(['Первый абзац. Ещё строка.', 'Второй']);
  });
  it('chains events and hooks the first one to a button', () => {
    const s = newScenario('Russian');
    const r = notesToStory(s, 'Russian', ['Один', 'Два', 'Три'], { event: 'EventStart', button: 1 })!;
    expect(r.events).toHaveLength(3);
    expect(buttonsOf(getComponent(r.scenario, 'EventStart')!)[0].targets).toContain(r.first);
    expect(buttonsOf(getComponent(r.scenario, r.events[0])!)[0].targets).toEqual([r.events[1]]);
    expect(buttonsOf(getComponent(r.scenario, r.events[2])!)[0].targets).toEqual([]);
    expect(getText(r.scenario, 'Russian', r.events[1] + '.text')).toBe('Два');
    expect(validate(r.scenario).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('returns null for empty notes', () => {
    expect(notesToStory(newScenario('Russian'), 'Russian', [])).toBeNull();
  });
});
