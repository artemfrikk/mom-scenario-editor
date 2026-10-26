// A readable, printable outline of the story for people who test or proofread the scenario.

import { isEventLike, type Scenario } from '../format/scenario';
import { describeCond, factLabel, opKind, parseOps, parseTests } from './facts';
import { buttonLabel, buttonsOf, getText, resolveText } from './ops';

export interface SheetButton {
  label: string;
  targets: string[];
  condition: string; // plain sentence, empty when the button is always there
  whenFalse: string; // "серая" or "скрыта"
}

export interface SheetEvent {
  name: string;
  when: string; // plain sentence about how it starts, empty for button-only events
  text: string;
  hidden: boolean; // runs without a window
  buttons: SheetButton[];
  adds: string[];
  removes: string[];
  remembers: string[];
  onlyIf: string;
}

const OP_WORD = { true: 'становится известным', false: 'снова неизвестно', inc: 'число растёт на 1', dec: 'число уменьшается на 1', set: 'записывается число' } as const;

function conds(raw: string | undefined, labels: Record<string, string>): string {
  const p = parseTests(raw);
  if (!p.conds.length) return '';
  if (!p.simple) return raw ?? '';
  return p.conds.map((c) => describeCond(c, labels)).join(p.join === 'OR' ? ' или ' : ' и ');
}

// Events in the order a player meets them: from the start by buttons, then everything that is left.
export function buildSheet(s: Scenario, lang: string, labels: Record<string, string>, triggerLabel: (t: string) => string): SheetEvent[] {
  const events = s.components.filter((c) => isEventLike(c.type));
  const byName = new Map(events.map((c) => [c.name, c]));
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (start: string) => {
    const queue = [start];
    while (queue.length) {
      const n = queue.shift()!;
      if (seen.has(n) || !byName.has(n)) continue;
      seen.add(n);
      order.push(n);
      for (const b of buttonsOf(byName.get(n)!)) queue.push(...b.targets);
    }
  };
  for (const c of events.filter((x) => x.data.trigger === 'EventStart')) visit(c.name);
  for (const c of events) visit(c.name);

  return order.map((name) => {
    const c = byName.get(name)!;
    const hidden = c.data.display === 'false';
    const list = (k: string) => (c.data[k] ?? '').split(/\s+/).filter(Boolean);
    return {
      name,
      when: c.data.trigger ? `Срабатывает само: ${triggerLabel(c.data.trigger)}` : '',
      text: hidden ? '' : resolveText(s, lang, getText(s, lang, name + '.text')).replace(/<[^>]+>/g, '').replace(/\\n/g, '\n'),
      hidden,
      buttons: buttonsOf(c).map((b) => ({
        label: hidden ? '' : buttonLabel(s, lang, b).replace(/<[^>]+>/g, ''),
        targets: b.targets,
        condition: conds(b.condition, labels),
        whenFalse: c.data[`event${b.index}ConditionAction`] === 'hide' ? 'кнопки не видно' : 'кнопка серая',
      })),
      adds: list('add'),
      removes: list('remove'),
      remembers: parseOps(c.data.operations).map((o) => {
        if ('raw' in o) return o.raw;
        const k = opKind(o);
        return k ? `«${factLabel(labels, o.name)}»: ${OP_WORD[k]}${k === 'set' ? ' ' + o.value : ''}` : `${o.name} ${o.op} ${o.value}`;
      }),
      onlyIf: conds(c.data.vartests, labels),
    };
  });
}
