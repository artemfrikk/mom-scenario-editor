import type { ComponentType, Scenario } from '../format/scenario';
import { buttonsOf, getText } from '../model/ops';
import { plainText } from './options';
import { TRIGGER_LABEL, TYPE_LABEL } from './labels';

// What each kind of object is, for people who have never opened Valkyrie.
export const TYPE_EXPLAIN: Record<ComponentType, string> = {
  Event:
    'Шаг сценария. Игроки видят окно с текстом и кнопками. Нажатие кнопки ведёт к следующему событию. Кроме текста событие может показать или убрать объекты на карте.',
  Token:
    'Жетон на карте (поиск, улика, взаимодействие). Игроки нажимают на него, и срабатывает событие жетона: оно показывает текст и кнопки.',
  Door: 'Дверь между комнатами. Пока она на карте, игроки могут нажать на неё, и сработает её событие.',
  Tile: 'Комната или участок улицы. Появляется на карте, когда какое-нибудь событие его показывает.',
  Spawn: 'Появление монстра на поле. Срабатывает, когда его вызывает событие или жетон.',
  UI: 'Картинка или надпись поверх экрана игры, например карта города или заметка.',
  MPlace: 'Точка на карте, куда игра ставит монстра, когда он появляется.',
  QItem: 'Предмет, который сыщики получают в сценарии.',
  Puzzle: 'Головоломка: слайдер, код, картинка или башня.',
  CustomMonster: 'Монстр с собственными параметрами, не из базовой игры.',
  Activation: 'Свои действия монстра в фазе мифа.',
};

export const TRIGGER_HELP: Record<string, string> = {
  '': 'Событие не срабатывает само. Оно запускается только кнопкой другого события, жетоном или дверью.',
  EventStart:
    'Срабатывает один раз в самом начале сценария. Здесь обычно показывают вступление и первую комнату. В сценарии должно быть ровно одно такое событие.',
  StartRound: 'Срабатывает в начале каждого раунда, до хода сыщиков.',
  EndRound: 'Срабатывает в конце каждого раунда.',
  Mythos: 'Срабатывает в фазе мифа, когда игра раскрывает карту мифа.',
  EndInvestigatorTurn: 'Срабатывает, когда сыщик заканчивает свой ход.',
  BeforeMonsterActivation: 'Срабатывает перед тем, как монстры начнут действовать.',
  StartFinalRound: 'Срабатывает в начале последнего раунда сценария.',
  NoMorale: 'Срабатывает, когда у отряда заканчивается мораль. Подходит для проигрыша.',
  Eliminated: 'Срабатывает, когда все сыщики выбыли. Подходит для проигрыша.',
};

export function triggerHelp(value: string): string {
  if (value in TRIGGER_HELP) return TRIGGER_HELP[value];
  if (value.startsWith('DefeatedUnique')) return 'Срабатывает, когда побеждён этот уникальный монстр.';
  if (value.startsWith('Defeated')) return 'Срабатывает, когда побеждён такой монстр (любой из них).';
  if (/^EndRound\d+$/.test(value)) return 'Срабатывает в конце указанного раунда.';
  return 'Собственный запуск. Событие сработает, когда игра подаст этот сигнал.';
}

// One short paragraph about a concrete component, shown next to it in pickers.
export function describeComponent(s: Scenario, lang: string, name: string): string {
  const c = s.components.find((x) => x.name === name);
  if (!c) return '';
  const lines: string[] = [TYPE_EXPLAIN[c.type]];
  const trigger = c.data.trigger;
  if (trigger) lines.push(`Срабатывает само: ${TRIGGER_LABEL[trigger] ?? trigger}. ${triggerHelp(trigger)}`);
  const text = plainText(getText(s, lang, c.name + '.text'), 90);
  if (text) lines.push(`Текст: «${text}»`);
  const adds = (c.data.add ?? '').split(/\s+/).filter(Boolean);
  if (adds.length) lines.push(`Показывает на карте: ${adds.join(', ')}.`);
  const next = buttonsOf(c).flatMap((b) => b.targets);
  if (next.length) lines.push(`Ведёт дальше: ${next.join(', ')}.`);
  return lines.join('\n');
}

export const TYPE_TITLE = TYPE_LABEL;
