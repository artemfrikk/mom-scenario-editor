import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { readiness } from './readiness';

describe('readiness', () => {
  it('a blank scenario is not ready', () => {
    const steps = readiness(newScenario('Russian'), 'Russian');
    expect(steps.filter((x) => x.done).length).toBeLessThan(steps.length);
    expect(steps.find((x) => x.id === 'win')!.done).toBe(false);
  });
});
