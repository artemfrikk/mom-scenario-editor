import catalog from '../content/catalog.json';
import { defaultLanguage, isEventLike, type Scenario } from '../format/scenario';
import { firstEvent, startEvent, type Fix } from './fixes';
import { BOARD_TYPES, buttonsOf, getText } from './ops';

export interface Issue {
  level: 'error' | 'warning';
  component?: string;
  message: string;
  fix?: Fix; // a repair the person can apply with one click
}

export const BUILTIN_TRIGGERS = ['EventStart', 'NoMorale', 'Eliminated', 'EndRound', 'StartRound', 'Mythos', 'EndInvestigatorTurn', 'BeforeMonsterActivation', 'StartFinalRound'];
const tileIds = new Set(catalog.tiles.map((t) => t.id));
const monsterIds = new Set(catalog.monsters.map((m) => m.id));

export function validate(s: Scenario): Issue[] {
  const issues: Issue[] = [];
  const lang = defaultLanguage(s);
  const names = new Set(s.components.map((c) => c.name));
  const referenced = new Set<string>();

  if (!getText(s, lang, 'quest.name').trim()) issues.push({ level: 'warning', message: 'У сценария нет названия.' });
  if (!s.components.some((c) => c.data.trigger === 'EventStart')) {
    const first = firstEvent(s);
    issues.push({
      level: 'error',
      message: 'Нет события, которое запускается в начале игры (запуск: «Начало сценария»).',
      fix: first ? { kind: 'makeStart', target: first } : undefined,
    });
  }

  for (const c of s.components) {
    for (const key of ['add', 'remove']) {
      for (const ref of (c.data[key] ?? '').split(/\s+/).filter(Boolean)) {
        referenced.add(ref);
        if (!names.has(ref)) issues.push({ level: 'error', component: c.name, message: `${c.name}: ${key === 'add' ? 'показывает' : 'убирает'} несуществующий объект «${ref}».`, fix: { kind: 'dropReference', ref } });
      }
    }
    if (isEventLike(c.type)) {
      for (const b of buttonsOf(c)) {
        for (const t of b.targets) {
          referenced.add(t);
          if (!names.has(t)) issues.push({ level: 'error', component: c.name, message: `${c.name}: кнопка ${b.index} ведёт к несуществующему событию «${t}».`, fix: { kind: 'dropReference', ref: t } });
        }
      }
      const shown = c.data.display !== 'false';
      if (shown && (c.type === 'Event' || c.type === 'Token' || c.type === 'Door') && !getText(s, lang, c.name + '.text').trim()) {
        issues.push({ level: 'warning', component: c.name, message: `${c.name}: показывается игрокам, но текст пустой.` });
      }
    }
    if (c.type === 'Tile' && c.data.side && !tileIds.has(c.data.side) && !c.data.customImage) {
      issues.push({ level: 'warning', component: c.name, message: `${c.name}: неизвестный тайл «${c.data.side}».` });
    }
    if (c.type === 'Tile' && !c.data.side) issues.push({ level: 'error', component: c.name, message: `${c.name}: не выбран тайл.` });
    if (c.type === 'Spawn') {
      const monsters = (c.data.monster ?? '').split(/\s+/).filter(Boolean);
      if (!monsters.length && !c.data.traits) issues.push({ level: 'error', component: c.name, message: `${c.name}: не выбран монстр.` });
      for (const m of monsters) if (!monsterIds.has(m) && !names.has(m)) issues.push({ level: 'warning', component: c.name, message: `${c.name}: неизвестный монстр «${m}».` });
    }
  }

  const added = new Set(s.components.flatMap((c) => (c.data.add ?? '').split(/\s+/).filter(Boolean)));
  for (const c of s.components) {
    // MPlace only marks where a monster stands; nothing has to show it.
    if (BOARD_TYPES.includes(c.type) && c.type !== 'MPlace' && !added.has(c.name)) {
      issues.push({ level: 'warning', component: c.name, message: `${c.name}: ни одно событие не показывает его на карте, игроки его не увидят.`, fix: startEvent(s) ? { kind: 'showAtStart', target: c.name } : undefined });
    }
  }

  // Events nobody can reach: no trigger, no button leads to them, and they are not on the board.
  for (const c of s.components) {
    if (c.type !== 'Event') continue;
    if (referenced.has(c.name) || c.data.trigger) continue;
    issues.push({ level: 'warning', component: c.name, message: `${c.name}: к этому событию нельзя попасть (ни одна кнопка не ведёт сюда и нет запуска).`, fix: { kind: 'deleteEvent', target: c.name } });
  }

  for (const c of s.components) {
    const t = c.data.trigger;
    if (!t || BUILTIN_TRIGGERS.includes(t) || /^EndRound\d+$/.test(t) || /^Defeated/.test(t) || t.startsWith('Var')) continue;
    // Custom triggers are allowed but commonly mistyped.
    if (!names.has(t)) issues.push({ level: 'warning', component: c.name, message: `${c.name}: необычный запуск «${t}».` });
  }
  return issues;
}
