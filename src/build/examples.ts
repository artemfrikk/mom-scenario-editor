// Ready-made scenarios to start from: small, playable, and using one of each thing the constructor can do.
// Built with the same functions as the map, so rooms and doors stand where the editor would put them.
// Only the base game is used, so everyone who owns the game can play them.

import { addPiece, addRoom, roomBehindDoor } from './edit';
import { newProject, type Outcome, type PieceKind, type Piece, type Project } from './project';

class Draft {
  p: Project;
  constructor(base: Partial<Project>) {
    this.p = { ...newProject(), authors: 'Пример из конструктора', ...base };
  }
  room(tile: string, enterText = ''): string {
    const [p, id] = addRoom(this.p, tile);
    this.p = { ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, enterText } : r)) };
    return id;
  }
  piece(room: string, kind: PieceKind, look: string, title: string, outcome: Partial<Outcome>, extra: Partial<Piece> = {}): string {
    const [p, id] = addPiece(this.p, room, kind, look);
    this.p = { ...p, pieces: p.pieces.map((x) => (x.id === id ? { ...x, title, ...extra, outcome: { ...x.outcome, ...outcome } } : x)) };
    return id;
  }
  // a door and the room behind it
  door(room: string, title: string, tile: string, outcome: Partial<Outcome>, enterText = ''): [string, string] {
    const d = this.piece(room, 'explore', '', title, outcome);
    const [p, id] = roomBehindDoor(this.p, d, tile);
    this.p = { ...p, rooms: p.rooms.map((r) => (r.id === id ? { ...r, enterText } : r)) };
    return [d, id];
  }
  outcome(id: string, patch: Partial<Outcome>) {
    this.p = { ...this.p, pieces: this.p.pieces.map((x) => (x.id === id ? { ...x, outcome: { ...x.outcome, ...patch } } : x)) };
  }
}

// One evening in one house: a search with a test, a locked door, a conversation, a puzzle, a monster and a clock.
export function exampleScenario(): Project {
  const d = new Draft({
    title: 'Тихий дом на Ривер-стрит',
    description: 'Профессор Армитедж не выходит на связь третий день. Его дом стоит тёмный, но в кабинете кто-то жжёт свечи. Пример из конструктора: поменяйте в нём всё, что захотите.',
    minHero: 1,
    maxHero: 4,
    lengthMin: 45,
    lengthMax: 90,
    difficulty: 0.4,
    prologue: {
      text: 'Дождь стучит по крыше старого дома на Ривер-стрит. Профессор Армитедж не отвечал на письма три дня, и вы решили проверить сами.\n\nДверь не заперта. Изнутри тянет воском и чем-то сладковато-гнилым.',
      image: '',
      music: 'AudioAtmosphere2',
    },
    goal: 'Найдите профессора и узнайте, что происходит в доме.',
    winText: 'Культист падает, и свечи гаснут разом. В углу кабинета, связанный, но живой, сидит профессор. «Вы успели», шепчет он. «Ещё час, и было бы поздно».',
    loseText: 'Шёпот в стенах становится громче, пока не заглушает ваши мысли. Дом на Ривер-стрит забирает ещё нескольких гостей.',
    mythos: { level: 0, rises: [{ round: 3, level: 1 }, { round: 7, level: 2 }] },
  });

  const hall = d.room('TileSideEntryHall', 'Прихожая. На вешалке промокшее пальто профессора: он никуда не уходил.');
  d.piece(hall, 'start', 'TokenInvestigators', '', {});
  const desk = d.piece(hall, 'search', 'TokenSearch', 'Секретер', {
    text: 'Ящик секретера заперт, но замок старый.',
    test: { skill: 'observation', need: 1, pass: 'Вы замечаете ключ, приклеенный снизу к столешнице.', fail: 'Вы ничего не находите, только режете палец о щепку.', harm: { kind: 'damage', amount: 1, who: 'one' } },
    item: 'ItemUniqueBrassKey',
  });
  const [libDoor, library] = d.door(hall, 'Дверь в библиотеку', 'TileSideLibrary', { text: 'Латунный ключ подходит. Дверь открывается со скрипом.' }, 'Библиотека. На полу разбросаны книги, будто кто-то искал одну, нужную.');
  d.outcome(libDoor, { lock: { needs: [desk], text: 'Дверь в библиотеку заперта. Ключ должен быть где-то рядом.' } });

  const butler = d.piece(library, 'npc', 'TokenGreyMan', 'Дворецкий', {
    text: 'Пожилой дворецкий сидит в кресле и смотрит в одну точку. «Хозяин заперся в кабинете. Велел никого не пускать».',
    once: false,
    choices: [
      { id: 'c1', label: 'Успокоить его', outcome: { text: '«Там с ним кто-то есть. Я слышал второй голос. Он поёт». Дворецкий отдаёт вам фонарь.', item: 'ItemCommonKeroseneLantern', once: false } },
      { id: 'c2', label: 'Потребовать ответа', outcome: { text: 'Дворецкий вжимается в кресло и больше не говорит ни слова.', once: false } },
    ],
  });
  const shelf = d.piece(library, 'interact', 'TokenInteract', 'Книжный шкаф', {
    text: 'Один из томов стоит не так, как остальные. Шкаф похож на механизм.',
    puzzle: { kind: 'slide', skill: 'lore', level: 2, alt: 0, pass: 'Шкаф отъезжает в сторону. За ним узкий проход в кабинет.' },
  });
  const [, study] = d.door(library, 'Потайной ход', 'TileSideStudy', { text: '' }, 'Кабинет. Пентаграмма мелом на полу, десятки свечей. В центре кто-то в капюшоне.');
  const passage = d.p.pieces.find((x) => x.kind === 'explore' && x.room === library)!.id;
  d.outcome(passage, { text: 'Вы протискиваетесь в узкий проход.', lock: { needs: [shelf], text: 'Здесь только стена с книгами.' } });
  d.piece(study, 'monster', 'MonsterCultist', 'Культист в капюшоне', {
    text: 'Культист падает. Ритуал прерван.',
    win: true,
    // the conversation with the butler changes the last words
    ifs: [{ id: 'i1', needs: [butler + '.c1'], text: 'Культист падает. В дверях появляется дворецкий с фонарём: «Я не мог оставить хозяина». Ритуал прерван.' }],
  }, {
    voice: {
      attack: 'Культист выкрикивает слово на мёртвом языке, и свечи вспыхивают у вашего лица. Сыщик проходит проверку {will} и получает 2 ужаса минус число {success}.',
      hit: '«Ты опоздал», смеётся культист, не пытаясь защищаться. Пройдите проверку навыка вашего оружия и нанесите столько урона, сколько получили {success}.',
      horror: 'Под капюшоном нет лица, только темнота, в которой мерцают свечи. Проверка {will}: получите 2 ужаса минус число {success}.',
    },
  });
  const late = d.piece(hall, 'monster', 'MonsterCultist', 'Второй культист', { text: 'Второй культист повержен.' }, { when: 'event' });

  d.p = {
    ...d.p,
    timeline: [
      { id: 'T90', round: 5, every: false, outcome: { text: 'Входная дверь хлопает. В прихожей кто-то в мокром плаще, и он не рад гостям.', spawn: [late], once: false } },
      { id: 'T91', round: 12, every: false, lose: true, outcome: { text: 'Часы бьют полночь. Пение за стеной обрывается, и дом погружается в тишину. Вы опоздали.', once: false } },
    ],
  };
  return d.p;
}

// Two chapters: what the investigators promise in the first one opens a door in the second.
export function exampleCampaign(): Project {
  const one = new Draft({
    title: 'Наследство Уэйтли',
    chapter: 'ch1',
    chapterTitle: 'Письмо',
    description: 'Кампания из двух глав. Решение в первой главе меняет вторую. Пример из конструктора.',
    minHero: 1,
    maxHero: 4,
    lengthMin: 60,
    lengthMax: 120,
    prologue: { text: 'Нотариус из Данвича прислал вам письмо: умер дальний родственник, и вы упомянуты в завещании. В доме вас ждёт старая служанка.', image: '', music: 'AudioAtmosphere1' },
    goal: 'Найдите завещание.',
    winText: 'В завещании одна строчка: «Ключ в подвале. Не открывайте дверь, если не знаете слова». Служанка крестится и уходит в ночь. Пора спускаться.',
    loseText: 'Вы бежите из дома, так и не узнав, что от вас скрывали.',
    next: { win: 'ch2' },
    mythos: { level: 0, rises: [{ round: 4, level: 1 }] },
  });
  const hall = one.room('TileSideHall1', 'Пыльный коридор. Портреты Уэйтли смотрят вам вслед.');
  one.piece(hall, 'start', 'TokenInvestigators', '', {});
  const markId = `ch1m${one.p.nextId}`;
  one.p = { ...one.p, nextId: one.p.nextId + 1, marks: [{ id: markId, label: 'Служанка сказала слово' }] };
  one.piece(hall, 'npc', 'TokenGreyWoman', 'Служанка', {
    text: '«Хозяин перед смертью шептал одно слово. Сказать его вам?»',
    once: false,
    choices: [
      { id: 'c1', label: 'Выслушать', outcome: { text: 'Она наклоняется к вам и шепчет: «Йог-Сотот». Вас бросает в дрожь.', remember: [markId], once: false } },
      { id: 'c2', label: 'Не надо', outcome: { text: '«Как знаете», говорит она и отворачивается.', once: false } },
    ],
  });
  const [, bedroom] = one.door(hall, 'Дверь в спальню', 'TileSideBedroom1', { text: 'Дверь поддаётся.' }, 'Спальня покойного. Кровать не застелена.');
  one.piece(bedroom, 'search', 'TokenSearch', 'Шкатулка', { text: 'В шкатулке под бельём лежит завещание.', clues: 1, win: true });

  const two = new Draft({
    title: 'Наследство Уэйтли',
    chapter: 'ch2',
    chapterTitle: 'Подвал',
    prologue: { text: 'Подвал дома Уэйтли глубже, чем должен быть. Ступени уходят вниз, и снизу тянет холодом.', image: '', music: 'AudioAtmosphere3' },
    goal: 'Откройте дверь в глубине подвала.',
    winText: 'Дверь закрывается за вашей спиной, и шёпот стихает. Наследство Уэйтли останется там, где ему место. Конец кампании.',
    loseText: 'Подвал забирает вас.',
    mythos: { level: 1, rises: [{ round: 4, level: 2 }] },
  });
  const cellar = two.room('TileSideBasement', 'Сырой подвал. По стенам вырезаны знаки, которых вы не знаете.');
  two.piece(cellar, 'start', 'TokenInvestigators', '', {});
  const word = two.piece(cellar, 'interact', 'TokenInteract', 'Дверь со знаками', {
    text: 'Вы произносите слово, и знаки на двери гаснут один за другим.',
    win: true,
    lock: { needs: ['%' + markId], text: 'На двери знаки, и они ждут слова. Вы его не знаете.' },
  });
  const crowbar = two.piece(cellar, 'search', 'TokenSearch', 'Ящик с инструментами', {
    text: 'Вы находите ломик и выламываете дверь силой. Знаки вспыхивают и обжигают вас.',
    test: { skill: 'strength', need: 2, pass: 'Дверь трещит и подаётся.', fail: 'Дверь не поддаётся, а знаки жгут руки.', harm: { kind: 'horror', amount: 1, who: 'one' } },
    win: true,
  });
  two.piece(cellar, 'monster', 'MonsterGhost', 'Призрак Уэйтли', { text: 'Призрак рассеивается с долгим стоном.' }, { when: 'event' });
  const ghost = two.p.pieces[two.p.pieces.length - 1].id;
  two.p = { ...two.p, timeline: [{ id: 'T90', round: 3, every: false, outcome: { text: 'Свечи гаснут. Из стены выходит бледная фигура старого Уэйтли.', spawn: [ghost], once: false } }] };
  void word;
  void crowbar;

  return { ...one.p, campaign: [two.p] };
}

export const EXAMPLES: { id: string; icon: string; title: string; text: string; make: () => Project }[] = [
  { id: 'house', icon: '🏚', title: 'Тихий дом на Ривер-стрит', text: 'Один вечер, три комнаты: проверка навыка, ключ и замок, разговор, головоломка, монстр со своими текстами и часы.', make: exampleScenario },
  { id: 'whateley', icon: '📜', title: 'Наследство Уэйтли', text: 'Кампания из двух глав: ответ в первой главе открывает дверь во второй.', make: exampleCampaign },
];
