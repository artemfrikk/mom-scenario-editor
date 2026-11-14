// The atmosphere helper: what kind of place a tile is, the game's sounds that suit it, and first lines to start from.
// And a request for a chat assistant (ChatGPT, Claude): the author copies it there and pastes the answer back. No keys, no server.

import { roomLabelOf } from './check';
import type { Piece, Project } from './project';

export interface Mood {
  id: string;
  name: string; // "кухня", "склеп"
  match: RegExp; // on the tile id
  sounds: string[]; // game sounds for the moment the room opens
  music: string;
  drafts: string[]; // first lines for "what the investigators see"
}

export const MOODS: Mood[] = [
  {
    id: 'kitchen',
    name: 'кухня или столовая',
    match: /Kitchen|Dining|Diner|Cafe|Speakeasy/,
    sounds: ['AudioPotsPans1', 'AudioDinnerBell', 'AudioGlassBreak1'],
    music: 'AudioAtmosphere1',
    drafts: [
      'На столе остывший ужин на несколько персон. Никто к нему не притронулся.',
      'Пахнет прогорклым жиром и чем-то сладковатым. В раковине гора грязной посуды, над ней жужжат мухи.',
      'Стулья опрокинуты, будто все вскочили разом. Нож для мяса воткнут в столешницу.',
    ],
  },
  {
    id: 'library',
    name: 'библиотека или кабинет',
    match: /Library|Study|Office|Archives|Classroom|PrintingPress|Lab|Studio|Medical/,
    sounds: ['AudioPapers1', 'AudioCurio', 'AudioClock'],
    music: 'AudioAtmosphere2',
    drafts: [
      'Книги сброшены с полок, будто кто-то искал одну, нужную. На столе догорает свеча.',
      'Пахнет пылью и старой бумагой. Тиканье часов кажется слишком громким.',
      'На письменном столе раскрыт дневник. Последняя запись обрывается на полуслове.',
    ],
  },
  {
    id: 'bedroom',
    name: 'спальня',
    match: /Bedroom|BedChamber|Cabin|Sleeper|Bathroom|Spa|Crew/,
    sounds: ['AudioDrawer1', 'AudioMableGhost1', 'AudioClock'],
    music: 'AudioAtmosphere3',
    drafts: [
      'Постель смята, подушка разорвана. На полу перья и следы босых ног.',
      'Зеркало завешено тканью. Из-под ткани сочится слабый свет.',
      'Шкаф приоткрыт. Вам кажется, что внутри кто-то стоит.',
    ],
  },
  {
    id: 'cellar',
    name: 'подвал или подземелье',
    match: /Basement|Cellar|Storage|Vault|Tunnel|Sewer|Dungeon|Pit|Hold/,
    sounds: ['AudioCreatureMoves', 'AudioThud1', 'AudioMove2'],
    music: 'AudioAtmosphere5',
    drafts: [
      'Сырость пробирает до костей. С потолка капает, и каждый звук отдаётся эхом.',
      'Ступени уходят вниз дальше, чем должны. Снизу тянет холодом и гнилью.',
      'В темноте что-то шуршит. Свет фонаря выхватывает следы когтей на стене.',
    ],
  },
  {
    id: 'attic',
    name: 'чердак или башня',
    match: /Attic|BellTower|Tower/,
    sounds: ['AudioCrows', 'AudioWoodDestroy1', 'AudioThud2'],
    music: 'AudioAtmosphere3',
    drafts: [
      'Половицы стонут под ногами. Между балками висят старые простыни, как силуэты.',
      'Пыль лежит толстым слоем, но на ней свежие следы. Кто-то был здесь недавно.',
      'Под крышей гнездятся вороны. Когда вы входите, они замолкают разом.',
    ],
  },
  {
    id: 'crypt',
    name: 'склеп или святилище',
    match: /Burial|Crypt|Altar|Shrine|Temple|Sanctum|Chapel|Ceremony|Throne|Statue|Mosaic|Ruin|Cracked|Sunlit|Verdant|Pool|Chamber/,
    sounds: ['AudioRitualCircle1', 'AudioStoneOpen1', 'AudioGong'],
    music: 'AudioAtmosphere6',
    drafts: [
      'Каменные плиты исписаны знаками, которые больно читать. Воздух густой, как перед грозой.',
      'В нишах стоят урны с прахом. Одна из них разбита, и прах рассыпан дорожкой к алтарю.',
      'Огни свечей горят ровно, хотя здесь гуляет сквозняк. Кто-то зажёг их совсем недавно.',
    ],
  },
  {
    id: 'garden',
    name: 'двор, сад или лес',
    match: /Yard|Park|Pond|Conservatory|Grove|Clearing|Path|Campsite|Jungle|Ravine|Overgrown/,
    sounds: ['AudioCrows', 'AudioDog', 'AudioCreatureWarning'],
    music: 'AudioAtmosphere4',
    drafts: [
      'Туман стелется по земле. Ветви деревьев сплетаются над головой, как пальцы.',
      'Где-то лает собака и вдруг обрывается на полувое.',
      'Цветы в оранжерее повернули головки к вам. Все разом.',
    ],
  },
  {
    id: 'water',
    name: 'берег, пристань или корабль',
    match: /Dock|Pier|Beach|Boat|River|Ship|Prow|Bridge|Chart/,
    sounds: ['AudioFogBell', 'AudioMove3', 'AudioCreatureWarning'],
    music: 'AudioAtmosphere7',
    drafts: [
      'Вода чёрная и неподвижная. Колокол в тумане звонит сам по себе.',
      'Доски пристани скользкие от водорослей. Пахнет рыбой и чем-то древним.',
      'У самой кромки воды на песке следы. Они ведут из моря и обратно.',
    ],
  },
  {
    id: 'street',
    name: 'улица или лавка',
    match: /Street|Alley|TownSquare|Plaza|Bandstand|Parade|Market|Storefront|Shop|Pharmacy|Station|Tracks/,
    sounds: ['AudioDog', 'AudioCrows', 'AudioFogBell'],
    music: 'AudioAtmosphere4',
    drafts: [
      'Фонари мигают, и улица то появляется, то тонет в темноте. Ни одного прохожего.',
      'В витрине лавки выставлены странные вещи. Вывеска скрипит на ветру.',
      'Ставни закрыты, но вы чувствуете взгляды из каждого окна.',
    ],
  },
  {
    id: 'train',
    name: 'вагон поезда',
    match: /Car\d?$|Engine|Caboose|Carboose|Baggage|Freight|Passenger|Observation|Lounge Car/,
    sounds: ['AudioMove4', 'AudioElectric1', 'AudioThud1'],
    music: 'AudioAtmosphere2',
    drafts: [
      'Вагон раскачивается, и лампы мигают в такт стуку колёс. Пассажиры спят. Или нет?',
      'В купе пусто, только чемодан с приоткрытой крышкой. Изнутри что-то скребётся.',
      'За окном не видно ни огонька, хотя поезд должен идти через города.',
    ],
  },
  {
    id: 'salon',
    name: 'гостиная или бальный зал',
    match: /Ballroom|Lounge|Billiards|Exhibit|Viewing|Gallery/,
    sounds: ['AudioPiano', 'AudioGlassBreak2', 'AudioClock'],
    music: 'AudioAtmosphere1',
    drafts: [
      'Пианино играет само. Мелодия знакомая, но в ней не хватает нот.',
      'Хрусталь люстры звенит, хотя ветра нет. На паркете следы танцевавших пар.',
      'Портреты на стенах смотрят вниз, на центр зала. Туда, где на полу темнеет пятно.',
    ],
  },
  {
    id: 'hall',
    name: 'коридор или холл',
    match: /Hall|Lobby|Entry|Porch|Balcony|Portrait|Antechamber|Stairs|Corner|End/,
    sounds: ['AudioDoorCreak1', 'AudioClock', 'AudioEntrance'],
    music: 'AudioAtmosphere1',
    drafts: [
      'Длинный коридор теряется в темноте. Двери по обе стороны закрыты, кроме одной.',
      'Часы в холле остановились без четверти полночь. Маятник всё ещё качается.',
      'Ковёр на полу сбит, будто по нему кого-то тащили. Следы ведут вглубь дома.',
    ],
  },
];

export function moodOf(tile: string): Mood {
  const id = tile.replace(/^TileSide/, '');
  return MOODS.find((m) => m.match.test(id)) ?? MOODS[MOODS.length - 1];
}

// A request for a chat assistant: the story so far, the place, and what to write.
export function helpPrompt(p: Project, what: { room?: string; piece?: Piece; kind: 'room' | 'piece' }, current: string, roomName: (id: string) => string = (id) => roomLabelOf(p, id)): string {
  const roomId = what.kind === 'room' ? what.room! : what.piece!.room;
  const room = p.rooms.find((r) => r.id === roomId);
  const mood = room ? moodOf(room.tile) : undefined;
  const here = p.pieces
    .filter((x) => x.room === roomId && x.kind !== 'start')
    .map((x) => `- ${x.title || x.kind}${x.outcome.text.trim() ? `: ${x.outcome.text.trim().slice(0, 120)}` : ''}`)
    .join('\n');
  const task =
    what.kind === 'room'
      ? `Напиши 3 варианта короткого описания (2–3 предложения), которое игроки прочтут, когда эта комната откроется: «${roomName(roomId)}» (${mood?.name ?? 'комната'}).`
      : `Напиши 3 варианта текста (2–4 предложения), который игроки прочтут, когда используют «${what.piece!.title || 'жетон'}» в комнате «${roomName(roomId)}».`;
  return [
    'Помоги написать текст для сценария настольной игры «Особняки безумия» (Mansions of Madness, 2-я редакция) в приложении Valkyrie.',
    'Пиши атмосферно, в духе Лавкрафта и 1920-х, обращайся к игрокам на «вы», без кровавых подробностей и без спойлеров о том, что будет дальше.',
    '',
    `Сценарий: «${p.title || 'без названия'}».`,
    p.prologue.text.trim() ? `Вступление: ${p.prologue.text.trim().slice(0, 600)}` : '',
    p.goal.trim() ? `Цель сыщиков: ${p.goal.trim()}` : '',
    here ? `Что лежит в этой комнате:\n${here}` : '',
    current.trim() ? `Мой черновик: ${current.trim()}` : '',
    '',
    task,
    'Ответь только вариантами, каждый с новой строки, начиная с «1.», «2.», «3.».',
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
}

// "1. …\n2. …" from the assistant's answer.
export function parseVariants(answer: string): string[] {
  const raw = answer.split(/\n(?=\s*\d+[.)]\s)/);
  // chatter before "1." is dropped
  const numbered = raw.filter((s) => /^\s*\d+[.)]\s/.test(s));
  const parts = (numbered.length ? numbered : raw).map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  return parts.length ? parts : [answer.trim()].filter(Boolean);
}
