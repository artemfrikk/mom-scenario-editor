import { describe, expect, it } from 'vitest';
import { explore } from './explore';
import { sampleScenario } from './sample';
import { validate } from './validate';

describe('sample scenario', () => {
  const { scenario } = sampleScenario('Russian');
  it('has no errors', () => {
    expect(validate(scenario).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('can be won', () => {
    const r = explore(scenario);
    expect(r.endings.map((e) => e.event)).toContain('EventWin');
    expect(r.neverReached).toEqual([]);
  });
});
