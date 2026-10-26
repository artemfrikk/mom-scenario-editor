// The scenario's opening screen: a picture on the left, the story on the right and a "Continue" button,
// built from the same screen elements Valkyrie scenarios use (see SmugglersPoint).

import type { Scenario } from '../format/scenario';
import { buttonsOf, getComponent, getText, setButtonTargets, setText, updateData } from './ops';

const list = (v: string | undefined) => (v ?? '').split(/\s+/).filter(Boolean);

export const INTRO = {
  display: 'EventStartIntroductionDisplay',
  cleanup: 'EventStartIntroductionCleanup',
  text: 'UIIntroductionText',
  image: 'UIIntroductionImage',
  button: 'UIIntroductionContinueText',
  frame: 'UIIntroductionContinueFrame',
  wall: 'UIBackgroundWallpaper',
  bar: 'UITextTopBar',
} as const;

const SCREEN: string[] = [INTRO.wall, INTRO.bar, INTRO.image, INTRO.text, INTRO.frame, INTRO.button];

export interface Intro {
  text: string;
  button: string;
  image: string; // file name of the picture inside the package, or ''
}

export const startEvent = (s: Scenario) => s.components.find((c) => c.type === 'Event' && c.data.trigger === 'EventStart');

export const hasIntro = (s: Scenario) => !!getComponent(s, INTRO.text);

export function readIntro(s: Scenario, lang: string): Intro {
  return {
    text: getText(s, lang, INTRO.text + '.uitext'),
    button: getText(s, lang, INTRO.button + '.uitext'),
    image: getComponent(s, INTRO.image)?.data.image ?? '',
  };
}

const ui = (data: Record<string, string>) => ({ display: 'false', buttons: '0', vunits: 'True', ...data });

// Creates the opening screen, or changes the one that is there. The story that began at the start event
// now begins after the players press "Continue".
export function setIntro(s: Scenario, lang: string, intro: Intro): Scenario {
  let out = s;
  if (!hasIntro(out)) {
    const start = startEvent(out);
    if (!start) return s;
    const oldTargets = buttonsOf(start)[0]?.targets ?? [];
    const shown = start.data.add;
    const put = (name: string, data: Record<string, string>) => {
      out = { ...out, components: [...out.components, { name, type: 'UI', source: 'ui.ini', data: ui(data) }] };
    };
    put(INTRO.wall, { xposition: '0', yposition: '0', image: 'ImageGreenBG', size: '1' });
    put(INTRO.bar, { xposition: '0.355', yposition: '-0.412', image: 'ImageCutsceneTextTopper', size: '0.045' });
    put(INTRO.text, { xposition: '0.357', yposition: '-0.03', size: '0.74', textsize: '0.9', textaspect: '0.95' });
    put(INTRO.frame, { xposition: '0.355', yposition: '0.38', buttons: '1', image: 'ImageInvestigatorSelectTitle', size: '0.081' });
    put(INTRO.button, { xposition: '0.355', yposition: '0.373', buttons: '1', size: '0.04', textcolor: 'black', textaspect: '9' });
    const event = (name: string, data: Record<string, string>) => {
      out = { ...out, components: [...out.components, { name, type: 'Event', source: 'events.ini', data: { buttons: '1', event1: '', ...data } }] };
    };
    event(INTRO.display, { display: 'false' });
    event(INTRO.cleanup, { display: 'false', ...(shown ? { add: shown } : {}) });
    out = setButtonTargets(out, INTRO.display, 1, []);
    out = setButtonTargets(out, INTRO.cleanup, 1, oldTargets);
    for (const n of [INTRO.frame, INTRO.button]) out = setButtonTargets(out, n, 1, [INTRO.cleanup]);
    out = setButtonTargets(out, start.name, 1, [INTRO.display]);
    out = updateData(out, start.name, { display: 'false', add: undefined });
  }
  out = setText(out, lang, INTRO.text + '.uitext', intro.text);
  out = setText(out, lang, INTRO.button + '.uitext', intro.button || 'Продолжить');
  const has = !!getComponent(out, INTRO.image);
  if (intro.image && !has) {
    out = { ...out, components: [...out.components, { name: INTRO.image, type: 'UI', source: 'ui.ini', data: ui({ xposition: '-0.355', yposition: '0', size: '0.5', image: intro.image }) }] };
  } else if (intro.image) {
    out = updateData(out, INTRO.image, { image: intro.image });
  } else if (has) {
    out = { ...out, components: out.components.filter((c) => c.name !== INTRO.image) };
  }
  // The screen is put up by the display event and taken down by the cleanup event; the picture comes and goes with the text.
  const screen = SCREEN.filter((n) => n !== INTRO.image || intro.image);
  const keep = (v: string | undefined) => list(v).filter((n) => !SCREEN.includes(n));
  out = updateData(out, INTRO.display, { add: [...keep(getComponent(out, INTRO.display)?.data.add), ...screen].join(' ') });
  out = updateData(out, INTRO.cleanup, { remove: screen.join(' ') });
  for (const n of [INTRO.frame, INTRO.button]) out = updateData(out, n, { remove: screen.join(' ') });
  return out;
}

export function removeIntro(s: Scenario): Scenario {
  const cleanup = getComponent(s, INTRO.cleanup);
  const start = startEvent(s);
  if (!cleanup || !start) return s;
  let out = setButtonTargets(s, start.name, 1, buttonsOf(cleanup)[0]?.targets ?? []);
  out = updateData(out, start.name, { display: undefined, add: cleanup.data.add });
  const gone = new Set<string>([...SCREEN, INTRO.display, INTRO.cleanup]);
  return { ...out, components: out.components.filter((c) => !gone.has(c.name)) };
}
