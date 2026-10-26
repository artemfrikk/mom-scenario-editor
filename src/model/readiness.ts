// "How ready is my scenario?": a plain checklist for the first page.

import type { Scenario } from '../format/scenario';
import { parseOps } from './facts';
import { getText } from './ops';
import { validate } from './validate';

export interface Step {
  id: string;
  label: string;
  done: boolean;
  hint: string; // what to do when it is not done
  go?: 'quest' | 'story' | 'map' | 'check';
}

export function endsGame(operations: string | undefined): boolean {
  return parseOps(operations).some((o) => !('raw' in o) && o.name === '$end' && o.op === '=' && o.value !== '0');
}

// `canEnd` is the result of the path check when it has run: true / false, or null when it has not.
export function readiness(s: Scenario, lang: string, canEnd: boolean | null = null): Step[] {
  const start = s.components.find((c) => c.type === 'Event' && c.data.trigger === 'EventStart');
  const startText = start ? getText(s, lang, start.name + '.text').trim() : '';
  const errors = validate(s).filter((i) => i.level === 'error').length;
  return [
    { id: 'title', label: 'Есть название', done: !!getText(s, lang, 'quest.name').trim(), hint: 'Впишите название ниже.', go: 'quest' },
    { id: 'intro', label: 'Есть вступление', done: !!getText(s, lang, 'quest.description').trim(), hint: 'Опишите завязку для игроков.', go: 'quest' },
    { id: 'start', label: 'Первое событие с текстом', done: !!startText, hint: 'Откройте стартовое событие в «Сюжете» и напишите текст.', go: 'story' },
    { id: 'tile', label: 'На карте есть хотя бы одна комната', done: s.components.some((c) => c.type === 'Tile'), hint: 'Добавьте комнату на вкладке «Карта».', go: 'map' },
    { id: 'win', label: 'Есть победа', done: s.components.some((c) => c.type === 'Event' && endsGame(c.data.operations) && c.data.trigger !== 'Eliminated'), hint: 'Добавьте событие «Победа» (шаблон или «Игра закончится»).', go: 'story' },
    { id: 'lose', label: 'Есть поражение', done: s.components.some((c) => c.type === 'Event' && c.data.trigger === 'Eliminated'), hint: 'Добавьте событие «Поражение» (запуск: «Все сыщики выбыли»).', go: 'story' },
    { id: 'errors', label: 'Нет ошибок в проверке', done: errors === 0, hint: `Ошибок: ${errors}. Откройте «Проверку».`, go: 'check' },
    { id: 'path', label: 'До концовки можно дойти', done: canEnd === true, hint: canEnd === false ? 'Автопроверка не нашла путь к концовке.' : 'Нажмите «Проверить все пути» на странице «Проверка».', go: 'check' },
  ];
}
