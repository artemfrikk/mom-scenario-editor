// The "constructor": where a new block should hang, and what the author should do next.

import { isEventLike, type Scenario } from '../format/scenario';
import { endsGame } from './readiness';
import { buttonLabel, buttonsOf, getComponent } from './ops';
import type { Hook } from './templates';

export interface OpenEnd extends Hook {
  label: string; // text of the button
}

// Buttons that lead nowhere yet, in the order a player meets them (start of the story first).
export function openEnds(s: Scenario, lang: string): OpenEnd[] {
  const events = s.components.filter((c) => isEventLike(c.type));
  const start = events.find((c) => c.data.trigger === 'EventStart') ?? events[0];
  const order: string[] = [];
  const seen = new Set<string>();
  const queue = start ? [start.name] : [];
  const visit = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      queue.push(name);
    }
  };
  if (start) seen.add(start.name);
  while (queue.length) {
    const name = queue.shift()!;
    order.push(name);
    const c = getComponent(s, name);
    if (c) for (const b of buttonsOf(c)) b.targets.forEach(visit);
  }
  for (const c of events) if (!seen.has(c.name)) order.push(c.name); // events nobody leads to come last
  const out: OpenEnd[] = [];
  for (const name of order) {
    const c = getComponent(s, name);
    if (!c || c.type === 'Token' || c.type === 'Door' || endsGame(c.data.operations)) continue;
    for (const b of buttonsOf(c)) if (!b.targets.length) out.push({ event: name, button: b.index, label: buttonLabel(s, lang, b) });
  }
  return out;
}

// Where a block is hung when the author just clicks it: the chosen event's first free button,
// otherwise the first free button of the story.
export function defaultHook(s: Scenario, lang: string, selected: string | null): OpenEnd | undefined {
  const ends = openEnds(s, lang);
  return ends.find((e) => e.event === selected) ?? ends[0];
}

export interface NextStep {
  text: string;
  hook?: OpenEnd;
  select?: string;
}

// One plain sentence about what to do next.
export function nextStep(s: Scenario, lang: string, selected: string | null): NextStep {
  const hook = defaultHook(s, lang, selected);
  if (hook) {
    const where = hook.event === selected ? 'у выбранного события' : `у события «${hook.event}»`;
    return { text: `Следующий шаг: ${where} кнопка «${hook.label || 'Продолжить'}» пока никуда не ведёт. Выберите блок слева, и он подключится сюда.`, hook, select: hook.event };
  }
  const events = s.components.filter((c) => isEventLike(c.type));
  const ends = events.some((c) => endsGame(c.data.operations));
  if (!ends) return { text: 'Сюжет замкнут, но нет концовки. Добавьте блок «Победа» или «Поражение».' };
  return { text: 'Все кнопки куда-то ведут. Проверьте сюжет во вкладке «Играть».' };
}
