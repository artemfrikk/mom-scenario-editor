// Plot templates: a story already cut into three acts, with a goal, the endings and the links between rooms.
// The places marked "todo" are blanks the author fills: "здесь нужна комната с уликой". Everything is from the base game.

import { Draft } from './examples';
import type { Project } from './project';

const T = (what: string) => `Заготовка: ${what}`;

// I. Someone is gone; the trail leads from room to room to where they are held.
function missing(): Project {
  const d = new Draft({
    title: 'Пропавший человек',
    authors: '',
    description: 'Заготовка сюжета «Пропавший человек»: три акта, цель и финалы уже есть. Замените тексты и тайлы на свои.',
    prologue: { text: 'Три дня назад пропал [кто]. Последним его видели в [где]. Полиция разводит руками, и семья обратилась к вам.', image: '', music: 'AudioAtmosphere1' },
    goal: 'Найдите [кого] и узнайте, что с ним случилось.',
    winText: 'Вы находите [его] живым, но он уже не тот, что прежде. [Что он успел увидеть?]',
    loseText: 'След обрывается. [Пропавший] так и не вернётся домой.',
    mythos: { level: 0, rises: [{ round: 4, level: 1 }, { round: 8, level: 2 }] },
  });
  // Act I: the last place they were seen
  const hall = d.room('TileSideEntryHall', 'Здесь [пропавшего] видели в последний раз.', T('акт I. Место, где человека видели последним. Опишите, что здесь не так.'));
  d.piece(hall, 'start', 'TokenInvestigators', '', {});
  const trace = d.piece(hall, 'search', 'TokenSearch', 'Первая улика', { text: '[Что сыщики находят: письмо, обрывок одежды, следы.]', clues: 1 }, { todo: T('улика, которая говорит, куда он пошёл.') });
  d.piece(hall, 'npc', 'TokenGreyWoman', 'Свидетель', { text: '«[Что видел свидетель?]»', once: false }, { todo: T('свидетель: что он видел той ночью.') });
  // Act II: where the trail leads
  const [, study] = d.door(hall, 'Дверь, куда ведёт след', 'TileSideStudy', { text: 'Улика приводит вас сюда.', lock: { needs: [trace], text: 'Вы пока не знаете, куда идти дальше.' } }, '[Что видят сыщики.]', T('акт II. Комната, где он побывал. Нужна улика, где его держат.'));
  const proof = d.piece(study, 'search', 'TokenSearch', 'Главная улика', { text: '[Где его держат и кто.]', clues: 1 }, { todo: T('главная улика: где он сейчас.') });
  d.piece(study, 'search', 'TokenSearch', 'Опасная находка', { text: '[Что-то, что хочется взять.]', test: { skill: 'agility', need: 1, pass: '[Успех.]', fail: '[Провал: ранение.]', harm: { kind: 'damage', amount: 1, who: 'one' } }, item: 'ItemCommonKeroseneLantern' }, { todo: T('опасность акта II: ловушка или проверка.') });
  // Act III: where they are held
  const [, cellar] = d.door(study, 'Путь в логово', 'TileSideBasement', { text: '[Как сыщики находят вход.]', lock: { needs: [proof], text: '[Пока не ясно, где искать.]' } }, '[Описание логова.]', T('акт III. Место, где держат пропавшего.'));
  const guard = d.piece(cellar, 'monster', 'MonsterCultist', 'Похититель', { text: '[Похититель повержен.]' }, { when: 'room', todo: T('похититель: кто он на самом деле.') });
  d.piece(cellar, 'npc', 'TokenGreyMan', 'Пропавший', { text: '[Вы освобождаете пропавшего.]', win: true, lock: { needs: [guard], text: '[Похититель стоит между вами и пленником.]' } }, { todo: T('финал: встреча с пропавшим.') });
  return d.p;
}

// II. A ritual is under way; the clock runs out at midnight.
function midnight(): Project {
  const d = new Draft({
    title: 'Ритуал до полуночи',
    authors: '',
    description: 'Заготовка сюжета «Ритуал до полуночи»: культ готовит обряд, у сыщиков 10 раундов.',
    prologue: { text: 'Сегодня полнолуние. [Кто-то] предупредил вас: в полночь в [месте] совершат обряд. Часы уже бьют девять.', image: '', music: 'AudioAtmosphere2' },
    goal: 'Помешайте ритуалу до полуночи.',
    winText: 'Пламя свечей гаснет, и ритуал рушится. [Что стало с культом?]',
    loseText: 'Часы бьют полночь. [Что пришло в этот мир?]',
    mythos: { level: 1, rises: [{ round: 4, level: 2 }, { round: 8, level: 3 }] },
  });
  const lobby = d.room('TileSideLobby', '[Где начинают сыщики.]', T('акт I. Место, откуда начинаются поиски культа.'));
  d.piece(lobby, 'start', 'TokenInvestigators', '', {});
  const plan = d.piece(lobby, 'search', 'TokenSearch', 'Записи культа', { text: '[Записи о ритуале: где и когда.]', clues: 1 }, { todo: T('улика: где пройдёт ритуал.') });
  const [, library] = d.door(lobby, 'Дверь в библиотеку', 'TileSideLibrary', { text: '' }, '[Библиотека.]', T('акт II. Где узнать, как остановить ритуал.'));
  const book = d.piece(library, 'interact', 'TokenInteract', 'Старая книга', {
    text: '[Книга о ритуале.]',
    puzzle: { kind: 'slide', skill: 'lore', level: 2, alt: 0, pass: '[Вы понимаете, как разорвать круг.]' },
  }, { todo: T('головоломка: тайна ритуала.') });
  d.piece(library, 'monster', 'MonsterCultist', 'Дозорный культа', { text: '[Дозорный повержен.]' }, { when: 'room' });
  const [, cellar] = d.door(library, 'Спуск к алтарю', 'TileSideRootCellar', { text: '[Вы находите вход к алтарю.]', lock: { needs: [plan], text: '[Вы ещё не знаете, где алтарь.]' } }, '[Алтарь, свечи, пение.]', T('акт III. Место ритуала.'));
  d.piece(cellar, 'monster', 'MonsterCultist', 'Верховный жрец', { text: '[Жрец повержен.]' }, { when: 'room', todo: T('главарь культа.') });
  d.piece(cellar, 'interact', 'TokenInteract', 'Ритуальный круг', { text: '[Вы разрываете круг.]', win: true, lock: { needs: [book], text: '[Вы не знаете, как остановить обряд.]' } }, { todo: T('финал: как сыщики прерывают ритуал.') });
  d.p = {
    ...d.p,
    timeline: [
      { id: 'T90', round: 6, every: false, outcome: { text: '[Часы бьют одиннадцать. Пение становится громче.]', once: false } },
      { id: 'T91', round: 10, every: false, lose: true, outcome: { text: '[Полночь.]', once: false } },
    ],
  };
  return d.p;
}

// III. The investigators are trapped inside and must find the way out.
function escape(): Project {
  const d = new Draft({
    title: 'Побег из дома',
    authors: '',
    description: 'Заготовка сюжета «Побег из дома»: сыщики заперты, и что-то идёт за ними.',
    prologue: { text: 'Вы приходите в себя в [комнате]. Дверь заперта снаружи. Где-то в доме [кто-то] ходит по коридорам.', image: '', music: 'AudioAtmosphere3' },
    goal: 'Выберитесь из дома.',
    winText: 'Вы вырываетесь на улицу, и дверь захлопывается за вашей спиной. [Что осталось в доме?]',
    loseText: '[Преследователь] настигает вас в темноте.',
    mythos: { level: 1, rises: [{ round: 5, level: 2 }] },
  });
  const bedroom = d.room('TileSideBedroom1', '[Где очнулись сыщики.]', T('акт I. Комната-ловушка, откуда надо выйти.'));
  d.piece(bedroom, 'start', 'TokenInvestigators', '', {});
  const key = d.piece(bedroom, 'search', 'TokenSearch', 'Тайник с ключом', { text: '[Вы находите ключ.]', item: 'ItemUniqueBrassKey' }, { todo: T('как выбраться из первой комнаты.') });
  const [, hall] = d.door(bedroom, 'Запертая дверь', 'TileSideHall1', { text: 'Ключ поворачивается.', lock: { needs: [key], text: 'Дверь заперта снаружи.' } }, '[Тёмный коридор.]', T('акт II. Коридор, где сыщиков ждёт опасность.'));
  d.piece(hall, 'monster', 'MonsterGhost', 'Обитатель дома', { text: '[Он отступает в стену.]' }, { when: 'room', todo: T('кто бродит по дому.') });
  const lever = d.piece(hall, 'interact', 'TokenInteract', 'Механизм', { text: '[Механизм входной двери.]', puzzle: { kind: 'slide', skill: 'lore', level: 2, alt: 0, pass: '[Где-то внизу щёлкает замок.]' } }, { todo: T('как открыть выход.') });
  const [, exit] = d.door(hall, 'Лестница вниз', 'TileSideEntryHall', { text: '' }, '[Холл и входная дверь.]', T('акт III. Последний рывок к выходу.'));
  d.piece(exit, 'interact', 'TokenInteract', 'Входная дверь', { text: '[Вы выбегаете наружу.]', win: true, lock: { needs: [lever], text: '[Входная дверь не поддаётся.]' } }, { todo: T('финал: побег.') });
  const chaser = d.piece(exit, 'monster', 'MonsterGhost', 'Преследователь', { text: '[Он рассеивается.]' }, { when: 'event' });
  d.p = { ...d.p, timeline: [{ id: 'T90', round: 4, every: false, outcome: { text: '[Шаги за спиной. Он вас нашёл.]', spawn: [chaser], once: false } }, { id: 'T91', round: 12, every: false, lose: true, outcome: { text: '[Время вышло.]', once: false } }] };
  return d.p;
}

// IV. A beast is loose; the investigators learn its weakness, call it out and kill it.
function hunt(): Project {
  const d = new Draft({
    title: 'Охота на чудовище',
    authors: '',
    description: 'Заготовка сюжета «Охота на чудовище»: узнать слабость твари, выманить её и уничтожить.',
    prologue: { text: 'В [городе] находят растерзанных людей. Местные шепчут о [твари]. Вы приехали положить этому конец.', image: '', music: 'AudioAtmosphere4' },
    goal: 'Узнайте, что за тварь охотится здесь, и уничтожьте её.',
    winText: 'Тварь падает. [Что вы нашли на месте её логова?]',
    loseText: '[Тварь] продолжит охоту. Следующими будут жители.',
    mythos: { level: 1, rises: [{ round: 5, level: 2 }] },
  });
  const square = d.room('TileSideTownSquare', '[Место последнего нападения.]', T('акт I. Место нападения. Что говорят следы?'));
  d.piece(square, 'start', 'TokenInvestigators', '', {});
  const tracks = d.piece(square, 'sight', 'TokenSight', 'Следы', { text: '[Что за следы оставила тварь.]', test: { skill: 'observation', need: 1, pass: '[Вы понимаете, куда она ушла.]', fail: '[Следы путаются.]' }, clues: 1 }, { todo: T('следы твари.') });
  d.piece(square, 'npc', 'TokenGreyMan', 'Выживший', { text: '«[Что он видел?]»', once: false }, { todo: T('выживший: как выглядела тварь.') });
  const [, shop] = d.door(square, 'Лавка знахаря', 'TileSideStorefront', { text: '', lock: { needs: [tracks], text: '[Сначала нужно понять, с чем вы имеете дело.]' } }, '[Лавка.]', T('акт II. Где узнать слабость твари.'));
  const weak = d.piece(shop, 'search', 'TokenSearch', 'Записи знахаря', { text: '[Слабость твари.]', clues: 1 }, { todo: T('слабость твари.') });
  const bait = d.piece(shop, 'interact', 'TokenInteract', 'Приманка', { text: '[Вы готовите приманку.]', lock: { needs: [weak], text: '[Вы не знаете, чем её выманить.]' } }, { todo: T('чем выманить тварь.') });
  const [, lair] = d.door(shop, 'Путь к логову', 'TileSideWarehouse', { text: '', lock: { needs: [bait], text: '[Без приманки её не найти.]' } }, '[Логово.]', T('акт III. Логово твари.'));
  const beast = d.piece(lair, 'monster', 'MonsterHuntingHorror', 'Тварь', { text: '[Тварь падает замертво.]', win: true }, { when: 'event', todo: T('тварь: как она выглядит и умирает.') });
  d.piece(lair, 'interact', 'TokenInteract', 'Поставить приманку', { text: '[Тварь выходит на запах.]', spawn: [beast] }, { todo: T('момент, когда тварь появляется.') });
  return d.p;
}

// V. Someone was killed; clues in three rooms, then the investigators name the killer.
function murder(): Project {
  const d = new Draft({
    title: 'Убийство в особняке',
    authors: '',
    description: 'Заготовка сюжета «Убийство в особняке»: три улики, подозреваемые и обвинение в конце.',
    prologue: { text: 'Хозяин особняка найден мёртвым в [где]. Гости заперты в доме до утра. Один из них убийца.', image: '', music: 'AudioAtmosphere1' },
    goal: 'Найдите улики и назовите убийцу.',
    winText: 'Убийца разоблачён. [Каким был его мотив?]',
    loseText: 'Убийца ускользает в ночь.',
    mythos: { level: 0, rises: [{ round: 4, level: 1 }] },
  });
  const hall = d.room('TileSideEntryHall', '[Гости собрались в холле.]', T('акт I. Место, где собраны подозреваемые.'));
  d.piece(hall, 'start', 'TokenInvestigators', '', {});
  d.piece(hall, 'npc', 'TokenGreyWoman', 'Подозреваемая 1', { text: '«[Её алиби.]»', once: false }, { todo: T('первый подозреваемый и его алиби.') });
  d.piece(hall, 'npc', 'TokenGreyMan', 'Подозреваемый 2', { text: '«[Его алиби.]»', once: false }, { todo: T('второй подозреваемый.') });
  const [, scene] = d.door(hall, 'Место убийства', 'TileSideStudy', { text: '' }, '[Тело хозяина.]', T('акт II. Место преступления.'));
  const c1 = d.piece(scene, 'search', 'TokenSearch', 'Улика 1', { text: '[Орудие убийства?]', clues: 1 }, { todo: T('первая улика.') });
  const c2 = d.piece(scene, 'sight', 'TokenSight', 'Улика 2', { text: '[Что не так в комнате?]', test: { skill: 'observation', need: 2, pass: '[Вы замечаете деталь.]', fail: '[Ничего.]' }, clues: 1 }, { todo: T('вторая улика с проверкой.') });
  const [, salon] = d.door(scene, 'Дверь в гостиную', 'TileSideLounge', { text: '' }, '[Гостиная.]', T('акт III. Где решается, кто убийца.'));
  const c3 = d.piece(salon, 'search', 'TokenSearch', 'Улика 3', { text: '[Мотив.]', clues: 1 }, { todo: T('третья улика: мотив.') });
  d.piece(salon, 'monster', 'MonsterCultist', 'Сообщник', { text: '[Сообщник повержен.]' }, { when: 'room', todo: T('опасность в финале: сообщник убийцы.') });
  d.piece(salon, 'npc', 'TokenGreyMan', 'Обвинение', {
    text: 'Все улики у вас. Пора назвать убийцу.',
    once: false,
    lock: { needs: [c1, c2, c3], text: 'Улик пока мало. Обвинить можно, только когда найдены все три.' },
    choices: [
      { id: 'c1', label: 'Подозреваемая 1', outcome: { text: '[Неверно: у неё алиби. Убийца пользуется паузой.]', once: false } },
      { id: 'c2', label: 'Подозреваемый 2', outcome: { text: '[Верно. Он во всём признаётся.]', win: true, once: false } },
    ],
  }, { todo: T('обвинение: кто убийца и почему.') });
  return d.p;
}

export const PLOTS: { id: string; icon: string; title: string; text: string; make: () => Project }[] = [
  { id: 'missing', icon: '🕯', title: 'Пропавший человек', text: 'След от места исчезновения к логову похитителя.', make: missing },
  { id: 'midnight', icon: '🌕', title: 'Ритуал до полуночи', text: 'Культ, книга с тайной обряда и часы: 10 раундов.', make: midnight },
  { id: 'escape', icon: '🚪', title: 'Побег из дома', text: 'Ключ, механизм выхода и преследователь за спиной.', make: escape },
  { id: 'hunt', icon: '🐾', title: 'Охота на чудовище', text: 'Следы, слабость твари, приманка и схватка.', make: hunt },
  { id: 'murder', icon: '🔪', title: 'Убийство в особняке', text: 'Три улики и обвинение: верный ответ побеждает.', make: murder },
];
