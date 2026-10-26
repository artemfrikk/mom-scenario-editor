// One-click repairs for problems found by validate().

import { isEventLike, type Scenario } from '../format/scenario';
import { deleteComponent, getComponent, setAddedBy, addedBy, updateData } from './ops';

export type Fix =
  | { kind: 'makeStart'; target: string }
  | { kind: 'showAtStart'; target: string }
  | { kind: 'dropReference'; ref: string }
  | { kind: 'deleteEvent'; target: string };

export function fixLabel(f: Fix): string {
  switch (f.kind) {
    case 'makeStart':
      return 'Сделать стартовым';
    case 'showAtStart':
      return 'Показывать в начале игры';
    case 'dropReference':
      return 'Убрать ссылку';
    case 'deleteEvent':
      return 'Удалить событие';
  }
}

export function startEvent(s: Scenario): string | undefined {
  return s.components.find((c) => c.data.trigger === 'EventStart')?.name;
}

export function applyFix(s: Scenario, f: Fix): Scenario {
  switch (f.kind) {
    case 'makeStart':
      return updateData(s, f.target, { trigger: 'EventStart' });
    case 'showAtStart': {
      const start = startEvent(s);
      return start ? setAddedBy(s, f.target, [...addedBy(s, f.target), start]) : s;
    }
    // deleteComponent strips every reference to the name, which is what we want for a name that no longer exists
    case 'dropReference':
      return deleteComponent(s, f.ref);
    case 'deleteEvent':
      return getComponent(s, f.target) ? deleteComponent(s, f.target) : s;
  }
}

// The first plain event, a sensible choice for "make this the start".
export function firstEvent(s: Scenario): string | undefined {
  return s.components.find((c) => c.type === 'Event' && isEventLike(c.type))?.name;
}
