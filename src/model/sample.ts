// A small finished story that the beginner can open, play and take apart.

import type { Scenario } from '../format/scenario';
import { buildTemplate, WIZARD_DEFAULTS, wizardScenario } from './templates';
import { setButtonTargets, setText } from './ops';

export interface Sample {
  scenario: Scenario;
  notes: string;
  facts: Record<string, string>;
}

export function sampleScenario(lang: string): Sample {
  const base = wizardScenario(
    {
      ...WIZARD_DEFAULTS,
      title: 'Тайна старого маяка',
      intro: 'Шторм прибил вас к скалистому берегу. На утёсе горит огонь маяка, хотя смотритель пропал много лет назад.',
      goal: 'найти ключ, открыть дверь в подвал маяка и выбраться из башни.',
      winText: 'Вы вырываетесь на воздух. Огонь маяка гаснет, и шторм стихает.',
      loseText: 'Шторм и тьма забирают последних сыщиков.',
    },
    lang,
  );
  let s = base.scenario;
  // The goal window just closes, so the players can walk around the board.
  s = setButtonTargets(s, 'EventGoal', 1, []);
  s = setText(s, lang, 'EventGoal.button1', 'К делу');

  const facts: Record<string, string> = {};
  const door = buildTemplate(s, lang, 'locked-door', { event: 'EventStart', button: 1 })!;
  s = door.scenario;
  Object.assign(facts, door.facts);
  s = setText(s, lang, 'DoorLocked.text', 'Тяжёлая дверь в подвал заперта. Нужен ключ.');
  s = setText(s, lang, 'TokenKey.text', 'В ящике стола лежит ржавый ключ с биркой «Подвал».');
  s = setText(s, lang, 'EventDoorOpen.text', 'Ключ скрежещет в замке. За дверью слышно, как кто-то поднимается по лестнице.');

  const search = buildTemplate(s, lang, 'search', { event: 'EventStart', button: 1 })!;
  s = search.scenario;
  s = setText(s, lang, 'TokenSearch.text', 'Вы осматриваете журнал смотрителя. Последняя страница вырвана.');
  s = setText(s, lang, 'EventFound.text', 'Между страниц спрятана записка: «Он ждёт внизу. Не пускайте его наверх».');

  const ambush = buildTemplate(s, lang, 'ambush', { event: 'EventDoorOpen', button: 1 })!;
  s = ambush.scenario;
  s = setText(s, lang, 'EventAmbush.text', 'Из подвала на вас бросается чудовище!');
  // After the fight the way out is open.
  s = setButtonTargets(s, 'SpawnAmbush', 1, ['EventWin']);

  const notes = [
    '# Тайна старого маяка',
    '',
    '## Завязка',
    'Шторм, маяк, пропавший смотритель.',
    '',
    '## Как играть',
    'Найдите ключ (жетон на карте), откройте дверь, переживите засаду.',
    '',
  ].join('\n');
  return { scenario: s, notes, facts };
}
