import { describe, expect, it } from 'vitest';
import catalog from '../content/catalog.json';
import { exampleScenario } from './examples';
import { helpPrompt, moodOf, MOODS, parseVariants } from './mood';

describe('atmosphere helper', () => {
  it('knows the kind of place and suggests real game sounds', () => {
    const audio = new Set(catalog.audio.map((a) => a.id));
    for (const m of MOODS) for (const s of [...m.sounds, m.music]) expect(audio.has(s), s).toBe(true);
    expect(moodOf('TileSideKitchen').id).toBe('kitchen');
    expect(moodOf('TileSideBurialChamber').id).toBe('crypt');
    expect(moodOf('TileSideRootCellar').id).toBe('cellar');
    expect(moodOf('TileSideLibrary').id).toBe('library');
    expect(moodOf('TileSideYard1').id).toBe('garden');
  });

  it('builds a request with the story and reads the answer back', () => {
    const p = exampleScenario();
    const text = helpPrompt(p, { kind: 'room', room: p.rooms[1].id }, '');
    expect(text).toContain('Тихий дом на Ривер-стрит');
    expect(text).toContain('Дворецкий');
    expect(parseVariants('Вот:\n1. Первый.\n2. Второй\nс переносом.\n3) Третий.')).toEqual(['Первый.', 'Второй\nс переносом.', 'Третий.']);
  });
});
