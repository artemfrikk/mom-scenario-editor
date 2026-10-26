import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { defaultHook, nextStep, openEnds } from './builder';
import { buildTemplate, TEMPLATES } from './templates';

describe('constructor', () => {
  it('starts on the first free button', () => {
    const s = newScenario('Russian');
    const hook = defaultHook(s, 'Russian', null);
    expect(hook?.event).toBe('EventStart');
  });
  it('chains blocks one after another', () => {
    let s = newScenario('Russian');
    for (const id of ['scene', 'check', 'win']) {
      const h = defaultHook(s, 'Russian', null)!;
      s = buildTemplate(s, 'Russian', id, { event: h.event, button: h.button })!.scenario;
    }
    // the start leads to the scene, the scene to the check; the check's two outcomes are still open
    const ends = openEnds(s, 'Russian');
    expect(ends.length).toBeGreaterThan(0);
    expect(ends.some((e) => e.event === 'EventStart')).toBe(false);
  });
  it('prefers the selected event', () => {
    let s = newScenario('Russian');
    const h = defaultHook(s, 'Russian', null)!;
    s = buildTemplate(s, 'Russian', 'choice', { event: h.event, button: h.button })!.scenario;
    const second = openEnds(s, 'Russian')[1];
    expect(defaultHook(s, 'Russian', second.event)?.event).toBe(second.event);
  });
  it('asks for an ending when everything is linked but nothing ends', () => {
    expect(nextStep(newScenario('Russian'), 'Russian', null).hook).toBeTruthy();
    expect(TEMPLATES.some((t) => t.id === 'scene')).toBe(true);
  });
});
