import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { readiness } from './readiness';
import { sampleScenario } from './sample';

describe('readiness', () => {
  it('a blank scenario is not ready', () => {
    const steps = readiness(newScenario('Russian'), 'Russian');
    expect(steps.filter((x) => x.done).length).toBeLessThan(steps.length);
    expect(steps.find((x) => x.id === 'win')!.done).toBe(false);
  });
  it('the sample is ready except for the path check, which is separate', () => {
    const { scenario } = sampleScenario('Russian');
    const steps = readiness(scenario, 'Russian', true);
    expect(steps.filter((x) => !x.done)).toEqual([]);
  });
});
