// Turns the author's plain notes into a chain of events: one paragraph, one event.

import type { Scenario } from '../format/scenario';
import { addComponent, buttonsOf, getComponent, setButtonTargets, setText } from './ops';
import type { Hook } from './templates';

// Paragraphs of the notes that can become story: headings and empty lines are skipped.
export function storyParagraphs(notes: string): string[] {
  return notes
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split('\n')
        .filter((l) => !/^\s*#/.test(l))
        .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter((p) => p.length > 0);
}

export interface StoryBuilt {
  scenario: Scenario;
  first: string;
  events: string[];
}

export function notesToStory(s: Scenario, lang: string, paragraphs: string[], hook?: Hook): StoryBuilt | null {
  if (!paragraphs.length) return null;
  let out = s;
  const names: string[] = [];
  paragraphs.forEach((p, i) => {
    let name: string;
    [out, name] = addComponent(out, 'Event', {}, 'Story' + (i + 1));
    out = setText(out, lang, name + '.text', p);
    out = setText(out, lang, name + '.button1', i === paragraphs.length - 1 ? 'Продолжить' : 'Дальше');
    names.push(name);
  });
  names.forEach((n, i) => {
    if (i < names.length - 1) out = setButtonTargets(out, n, 1, [names[i + 1]]);
  });
  const host = hook && getComponent(out, hook.event);
  const b = host && buttonsOf(host).find((x) => x.index === hook.button);
  if (host && b) out = setButtonTargets(out, host.name, b.index, [...b.targets, names[0]]);
  return { scenario: out, first: names[0], events: names };
}
