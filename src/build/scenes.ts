// Ready scenes for the palette: a few pieces with their links already made.
// A scene lands in one room; what belongs elsewhere (a key, a note) goes to another room the author picked or one opened earlier.

import type { Sizes } from './board';
import { addPiece } from './edit';
import { emptyOutcome, type Outcome, type Piece, type PieceKind, type Project } from './project';

export interface Scene {
  id: string;
  icon: string;
  title: string;
  hint: string;
  group: 'Замки и ключи' | 'Люди' | 'Опасность' | 'Тайны';
  elsewhere?: string; // what goes to another room, in words; the scene works in one room too
  make: (b: SceneBuilder) => string; // returns the piece to open first
}

export class SceneBuilder {
  p: Project;
  added: string[] = [];
  readonly room: string;
  readonly other: string;
  readonly sizes: Sizes;
  constructor(p: Project, room: string, other: string, sizes: Sizes = {}) {
    this.p = p;
    this.room = room;
    this.other = other;
    this.sizes = sizes;
  }
  put(kind: PieceKind, look: string, title: string, outcome: Partial<Outcome>, extra: Partial<Piece> = {}, where = this.room): string {
    const [p, id] = addPiece(this.p, where, kind, look, undefined, this.sizes);
    this.p = { ...p, pieces: p.pieces.map((x) => (x.id === id ? { ...x, title, ...extra, outcome: { ...emptyOutcome(), once: x.outcome.once, ...outcome } } : x)) };
    this.added.push(id);
    return id;
  }
  patch(id: string, outcome: Partial<Outcome>) {
    this.p = { ...this.p, pieces: this.p.pieces.map((x) => (x.id === id ? { ...x, outcome: { ...x.outcome, ...outcome } } : x)) };
  }
}

export const SCENES: Scene[] = [
  {
    id: 'locked-door',
    icon: '🗝',
    title: 'Запертая дверь и ключ',
    hint: 'Дверь заперта, ключ лежит в другой комнате. Пока ключа нет, сыщики читают, что заперто.',
    group: 'Замки и ключи',
    elsewhere: 'ключ',
    make: (b) => {
      const key = b.put('search', 'TokenSearch', 'Ящик комода', { text: 'Под стопкой старых писем лежит тяжёлый латунный ключ.', item: 'ItemUniqueBrassKey' }, {}, b.other);
      return b.put('explore', '', 'Запертая дверь', { text: 'Ключ подходит. Замок со скрежетом поддаётся.', lock: { needs: [key], text: 'Дверь заперта. Замочная скважина старая, под большой ключ.' } });
    },
  },
  {
    id: 'safe-code',
    icon: '🔢',
    title: 'Сейф с кодом из записки',
    hint: 'В другой комнате записка с подсказкой, здесь сейф с головоломкой-кодом. Без записки сейф не открыть.',
    group: 'Замки и ключи',
    elsewhere: 'записка',
    make: (b) => {
      const note = b.put('search', 'TokenSearch', 'Записка', { text: 'На обороте счёта карандашом выведены цифры. Похоже на код.', clues: 1 }, {}, b.other);
      return b.put('interact', 'TokenInteract', 'Сейф', {
        text: 'Вы вспоминаете цифры из записки и поворачиваете диск.',
        puzzle: { kind: 'code', skill: 'lore', level: 3, alt: 3, pass: 'Дверца сейфа открывается. Внутри старый револьвер и пачка писем.' },
        item: 'ItemCommon38Revolver',
        lock: { needs: [note], text: 'Тяжёлый сейф с кодовым замком. Код вы не знаете.' },
      });
    },
  },
  {
    id: 'guard',
    icon: '🛡',
    title: 'Монстр стережёт проход',
    hint: 'Монстр появляется вместе с комнатой. Дверь дальше откроется, только когда он побеждён.',
    group: 'Замки и ключи',
    make: (b) => {
      const m = b.put('monster', 'MonsterCultist', 'Страж', { text: 'Страж падает и больше не встаёт.' }, { when: 'room' });
      b.put('explore', '', 'Дверь за стражем', { text: 'Путь свободен.', lock: { needs: [m], text: 'Страж не даёт пройти к двери.' } });
      return m;
    },
  },
  {
    id: 'npc-fetch',
    icon: '🎁',
    title: 'Просьба: принести предмет',
    hint: 'Человек просит найти вещь. Пока она не найдена, он повторяет просьбу. Потом благодарит и даёт улику.',
    group: 'Люди',
    elsewhere: 'вещь',
    make: (b) => {
      const thing = b.put('search', 'TokenSearch', 'Медальон', { text: 'В пыли под кроватью блестит медальон с выгравированным именем.' }, {}, b.other);
      return b.put('npc', 'TokenGreyWoman', 'Вдова', {
        text: '«Вы нашли его! Медальон моего мужа». Она открывает его, и внутри вы видите адрес, написанный мелким почерком.',
        clues: 1,
        lock: { needs: [thing], text: '«Мой муж носил медальон, не снимая. Найдите его, прошу вас. Тогда я расскажу, что знаю»' },
      });
    },
  },
  {
    id: 'decision',
    icon: '⚖',
    title: 'Раненый: помочь или уйти',
    hint: 'Решение с последствием: если помочь, позже откроется дверь, которую он показал.',
    group: 'Люди',
    make: (b) => {
      const man = b.put('npc', 'TokenGreyMan', 'Раненый', {
        text: 'У стены сидит человек, зажимая рану. «Помогите… я знаю, куда они пошли».',
        once: true,
        choices: [
          { id: 'c1', label: 'Помочь', outcome: { text: 'Вы перевязываете рану. «Чёрный ход за кухней. Они там», — шепчет он.', once: false } },
          { id: 'c2', label: 'Уйти', outcome: { text: 'Времени нет. Вы уходите, и стоны за спиной стихают.', once: false } },
        ],
      });
      b.put('explore', '', 'Чёрный ход', { text: 'Дверь, о которой говорил раненый, открывается без шума.', lock: { needs: [man + '.c1'], text: 'Обычная стена. Или нет?' } });
      return man;
    },
  },
  {
    id: 'witness',
    icon: '🗣',
    title: 'Свидетель с проверкой',
    hint: 'Свидетель говорит, только если убедить его проверкой Влияния.',
    group: 'Люди',
    make: (b) =>
      b.put('npc', 'TokenGreyMan', 'Свидетель', {
        text: 'Мужчина нервно оглядывается. «Я ничего не видел», — повторяет он.',
        test: { skill: 'influence', need: 2, pass: '«Ладно… ночью сюда приезжала карета без гербов. Человек в ней был в маске».', fail: 'Он отворачивается и больше не отвечает. Может, позже.' },
        clues: 1,
        once: false,
      }),
  },
  {
    id: 'ambush',
    icon: '👹',
    title: 'Засада при входе',
    hint: 'Монстр выходит сразу, как только сыщики открывают комнату.',
    group: 'Опасность',
    make: (b) => {
      b.p = { ...b.p, rooms: b.p.rooms.map((r) => (r.id === b.room && !r.enterText.trim() ? { ...r, enterText: 'Едва вы переступаете порог, из темноты на вас бросается тварь!' } : r)) };
      return b.put('monster', 'MonsterDeepOneHybrid', 'Тварь у двери', { text: 'Тварь затихает на полу.' }, { when: 'room' });
    },
  },
  {
    id: 'trap',
    icon: '💥',
    title: 'Ловушка в тайнике',
    hint: 'Обыск с проверкой Ловкости: успех даёт находку, провал наносит урон.',
    group: 'Опасность',
    make: (b) =>
      b.put('search', 'TokenSearch', 'Старый сундук', {
        text: 'Крышка сундука держится на тугой пружине. Что-то здесь не так.',
        test: { skill: 'agility', need: 1, pass: 'Вы успеваете отдёрнуть руку от лезвия. Внутри лежит фонарь.', fail: 'Лезвие из-под крышки рассекает вам ладонь.', harm: { kind: 'damage', amount: 2, who: 'one' } },
        item: 'ItemCommonKeroseneLantern',
      }),
  },
  {
    id: 'summon',
    icon: '🕯',
    title: 'Тронешь, и придёт монстр',
    hint: 'Странный предмет: если его тронуть, в комнате появляется монстр.',
    group: 'Опасность',
    make: (b) => {
      const m = b.put('monster', 'MonsterGhost', 'Дух', { text: 'Дух рассеивается с протяжным воем.' }, { when: 'event' });
      return b.put('interact', 'TokenInteract', 'Чёрная свеча', { text: 'Вы зажигаете свечу. Пламя становится синим, и в комнате резко холодает.', spawn: [m] });
    },
  },
  {
    id: 'horror',
    icon: '😱',
    title: 'Жуткая находка',
    hint: 'Осмотр с проверкой Воли: провал добавляет ужас, но улика остаётся.',
    group: 'Опасность',
    make: (b) =>
      b.put('sight', 'TokenSight', 'Портрет', {
        text: 'Глаза на портрете следят за вами. Вы подходите ближе.',
        test: { skill: 'will', need: 1, pass: 'Вы выдерживаете взгляд и замечаете под рамой сложенный листок.', fail: 'На миг лицо на портрете улыбается. Вы отшатываетесь.', harm: { kind: 'horror', amount: 1, who: 'one' } },
        clues: 1,
      }),
  },
  {
    id: 'hidden',
    icon: '🖼',
    title: 'Тайник за осмотром',
    hint: 'Обыск появляется доступным, только когда сыщики что-то заметили при осмотре.',
    group: 'Тайны',
    make: (b) => {
      const look = b.put('sight', 'TokenSight', 'Каминная полка', { text: 'Одна из плиток камина чище остальных. Её явно двигали.' });
      b.put('search', 'TokenSearch', 'Тайник в камине', { text: 'За плиткой ниша. В ней свёрток с записями.', clues: 1, lock: { needs: [look], text: 'Обычный камин, давно не топленный.' } });
      return look;
    },
  },
  {
    id: 'ritual',
    icon: '🔮',
    title: 'Прервать ритуал',
    hint: 'Головоломка на Знание. Решили — ритуал прерван и сыщики побеждают.',
    group: 'Тайны',
    make: (b) =>
      b.put('interact', 'TokenInteract', 'Ритуальный круг', {
        text: 'Символы на полу светятся всё ярче. Нужно стереть их в правильном порядке.',
        puzzle: { kind: 'slide', skill: 'lore', level: 3, alt: 0, pass: 'Последний символ гаснет. Тишина обрушивается на комнату. Ритуал прерван.' },
        win: true,
      }),
  },
];

// Put a scene into a room; `other` is where the things for "elsewhere" go (the same room if there is no other).
export function placeScene(p: Project, scene: Scene, room: string, other: string, sizes: Sizes = {}): [Project, string, string[]] {
  const b = new SceneBuilder(p, room, other || room, sizes);
  const focus = scene.make(b);
  return [b.p, focus, b.added];
}
