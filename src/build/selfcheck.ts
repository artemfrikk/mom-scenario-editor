// "Проверка всех функций": a small campaign that uses everything the constructor can do,
// made to be played once in the real Valkyrie with a checklist next to it.

import { Draft } from './examples';
import { placeScene, SCENES } from './scenes';
import type { Project } from './project';

export function selfCheck(): Project {
  const one = new Draft({
    title: 'Проверка всех функций',
    authors: 'Конструктор сценариев',
    chapter: 'ch1',
    chapterTitle: 'Глава 1',
    description: 'Служебный сценарий: проверяет в Valkyrie всё, что умеет конструктор. Играйте с листком проверки.',
    minHero: 1,
    maxHero: 5,
    prologue: { text: '[1] Вступление. Должна играть музыка Atmosphere 1.', image: '', music: 'AudioAtmosphere1' },
    goal: '[2] Цель на отдельном экране.',
    winText: '[W] Победа в главе 1. Кнопка «Следующая глава» откроет главу 2.',
    loseText: '[L] Поражение.',
    next: { win: 'ch2' },
    mythos: {
      level: 0,
      rises: [{ round: 3, level: 1 }],
      adapt: true,
      mode: 'mix',
      own: [{ id: 'Y1', from: 2, once: true, outcome: { text: '[M] Своё событие мифов: появляется не раньше раунда 2 и только один раз.', once: true } }],
    },
    moreMonsters: true,
    startItems: [
      { id: '1', item: 'ItemCommonKeroseneLantern' },
      { id: '2', kind: 'weapon' },
    ],
    endSound: { win: 'AudioFinale1', lose: 'AudioGameOver' },
  });
  const hall = one.room('TileSideEntryHall', '[3] Стартовая комната. Звук часов (Clock) при начале игры.');
  one.p = { ...one.p, rooms: one.p.rooms.map((r) => (r.id === hall ? { ...r, sound: 'AudioClock' } : r)) };
  one.piece(hall, 'start', 'TokenInvestigators', '', {});
  const desk = one.piece(hall, 'search', 'TokenSearch', 'Секретер', {
    text: '[4] Проверка Наблюдения. Нажмите «Провал»: должен быть 1 урон, жетон остаётся. Потом «Успех».',
    test: { skill: 'observation', need: 1, pass: '[5] Успех: латунный ключ. Звук ящика.', fail: '[4a] Провал.', harm: { kind: 'damage', amount: 1, who: 'one' } },
    item: 'ItemUniqueBrassKey',
    sound: 'AudioDrawer1',
  });
  const [door, library] = one.door(hall, 'Дверь', 'TileSideLibrary', { text: '[7] Ключ подошёл. Скрип двери.', sound: 'AudioDoorCreak1' }, '[8] Библиотека открылась: звук бумаг и музыка Atmosphere 2.');
  one.outcome(door, { lock: { needs: [desk], text: '[6] Заперто: сначала обыщите секретер.' } });
  one.p = { ...one.p, rooms: one.p.rooms.map((r) => (r.id === library ? { ...r, sound: 'AudioPapers1', music: 'AudioAtmosphere2' } : r)) };
  const markId = `ch1m${one.p.nextId}`;
  one.p = { ...one.p, nextId: one.p.nextId + 1, marks: [{ id: markId, label: 'Дворецкому помогли' }] };
  const butler = one.piece(library, 'npc', 'TokenGreyMan', 'Дворецкий', {
    text: '[9] Решение: две кнопки.',
    once: true,
    choices: [
      { id: 'c1', label: 'Помочь', outcome: { text: '[10] Вы помогли. Это запомнится и в главе 2.', remember: [markId], once: false } },
      { id: 'c2', label: 'Уйти', outcome: { text: '[10b] Вы ушли.', once: false } },
    ],
  });
  one.piece(library, 'sight', 'TokenSight', 'Портрет', {
    text: '[11] Обычный текст: вы НЕ помогли дворецкому (или ещё не говорили с ним).',
    once: false,
    ifs: [{ id: 'i1', needs: [butler + '.c1'], text: '[11] Другой текст: вы помогли дворецкому.' }],
  });
  one.piece(library, 'interact', 'TokenInteract', 'Сейф', {
    text: '[12] Головоломка-код.',
    puzzle: { kind: 'code', skill: 'lore', level: 3, alt: 3, pass: '[13] Сейф открыт: револьвер.' },
    item: 'ItemCommon38Revolver',
  });
  // a ready scene: a candle that calls a monster
  const [p1] = placeScene(one.p, SCENES.find((s) => s.id === 'summon')!, library, library);
  one.p = p1;
  const [, study] = one.door(library, 'Дверь в кабинет', 'TileSideStudy', { text: '' }, '[15] Кабинет. Монстр выходит со своим звуком.');
  one.piece(study, 'monster', 'MonsterCultist', 'Культист-проверка', { text: '[17] Культист побеждён: победа в главе.', win: true }, {
    appear: 'AudioSpawnFirstMonster',
    voice: {
      attack: '[16a] Свой текст атаки монстра.',
      move: '[16m] Свой текст движения.',
      hit: '[16b] Свой текст, когда сыщик атакует.',
      horror: '[16c] Своя проверка ужаса.',
    },
  });
  one.p = {
    ...one.p,
    timeline: [
      { id: 'T90', round: 2, every: false, outcome: { text: '[R] Событие раунда 2 (с 1 сыщиком придёт на раунде 4, с 2 на раунде 3: адаптивный таймер).', once: false } },
      { id: 'T91', round: 15, every: false, lose: true, outcome: { text: '[L] Время вышло.', once: false } },
    ],
  };

  const two = new Draft({
    title: 'Проверка всех функций',
    chapter: 'ch2',
    chapterTitle: 'Глава 2',
    prologue: { text: '[C1] Глава 2 открылась.', image: '', music: 'AudioAtmosphere3' },
    goal: '[C2] Проверьте следы из главы 1.',
    winText: '[END] Конец проверки. Спасибо!',
    loseText: '[L2] Поражение.',
    mythos: { level: 0, rises: [] },
  });
  const cellar = two.room('TileSideBasement', '[C3] Подвал.');
  two.piece(cellar, 'start', 'TokenInvestigators', '', {});
  two.piece(cellar, 'npc', 'TokenGreyMan', 'Дворецкий', {
    text: '[C4] Обычный текст: в главе 1 вы ушли от дворецкого.',
    once: false,
    ifs: [{ id: 'i1', needs: ['%' + markId], text: '[C4] След из главы 1: вы помогли дворецкому, он вас узнаёт.' }],
  });
  two.piece(cellar, 'interact', 'TokenInteract', 'Дверь для помогавших', { text: '[C5] Открыто, потому что в главе 1 вы помогли.', win: true, lock: { needs: ['%' + markId], text: '[C5b] Заперто: в главе 1 вы не помогли дворецкому.' } });
  two.piece(cellar, 'search', 'TokenSearch', 'Запасной выход', { text: '[C6] Запасной путь к победе.', win: true });

  return { ...one.p, campaign: [two.p] };
}
