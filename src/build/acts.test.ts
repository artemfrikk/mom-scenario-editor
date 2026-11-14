import { describe, expect, it } from 'vitest';
import { paceOf } from './acts';
import { exampleScenario } from './examples';

describe('acts and pace', () => {
  it('splits the example house into three acts by when the rooms open', () => {
    const p = exampleScenario();
    const pace = paceOf(p);
    expect(pace.acts.map((a) => a.rooms.length)).toEqual([1, 1, 1]);
    expect(pace.acts[0].clues).toBe(1); // the brass key
    expect(pace.acts[2].win).toBe(true);
    expect(pace.acts[2].monsters).toBe(1);
    expect(pace.hints.some((h) => h.includes('слишком рано'))).toBe(false);
  });

  it('warns when victory comes before the last act', () => {
    const p = exampleScenario();
    const desk = p.pieces.find((x) => x.title === 'Секретер')!;
    const early = { ...p, pieces: p.pieces.map((x) => (x.id === desk.id ? { ...x, outcome: { ...x.outcome, win: true } } : x)) };
    expect(paceOf(early).hints.some((h) => h.includes('слишком рано'))).toBe(true);
  });

  it('warns about an act without danger', () => {
    const p = exampleScenario();
    const pace = paceOf(p);
    // the library has a butler and a puzzle, but nothing that hurts
    expect(pace.hints).toContain('В акте II ещё нет опасности: ни монстра, ни проверки с уроном или ужасом.');
  });
});
