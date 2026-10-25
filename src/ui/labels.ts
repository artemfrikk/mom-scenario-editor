import type { ComponentType } from '../format/scenario';

export const TYPE_LABEL: Record<ComponentType, string> = {
  Event: 'Событие',
  Token: 'Жетон',
  Door: 'Дверь',
  Tile: 'Тайл',
  Spawn: 'Монстр',
  UI: 'Экранный элемент',
  MPlace: 'Место монстра',
  QItem: 'Предмет',
  Puzzle: 'Головоломка',
  CustomMonster: 'Свой монстр',
  Activation: 'Активация',
};

export const TYPE_ICON: Record<ComponentType, string> = {
  Event: '📜',
  Token: '🔍',
  Door: '🚪',
  Tile: '🧱',
  Spawn: '👹',
  UI: '🖼',
  MPlace: '📍',
  QItem: '🗝',
  Puzzle: '🧩',
  CustomMonster: '🐙',
  Activation: '⚡',
};

export const TYPE_HELP: Record<ComponentType, string> = {
  Event: 'Текст и кнопки, которые видят игроки. Кнопки ведут к следующим событиям.',
  Token: 'Жетон на карте. Когда игрок нажимает на него, срабатывает это событие.',
  Door: 'Дверь между комнатами. Нажатие на неё тоже запускает событие.',
  Tile: 'Комната или участок улицы на карте.',
  Spawn: 'Появление монстра на поле.',
  UI: 'Картинка или надпись поверх экрана.',
  MPlace: 'Точка, куда ставится монстр.',
  QItem: 'Предмет, который сыщики получают в сценарии.',
  Puzzle: 'Головоломка (слайдер, код, изображение или башня).',
  CustomMonster: 'Монстр с собственными параметрами.',
  Activation: 'Собственные действия монстра в фазе мифа.',
};

export const TRIGGER_LABEL: Record<string, string> = {
  '': 'Нет (только по кнопке)',
  EventStart: 'Начало сценария',
  StartRound: 'Начало раунда',
  EndRound: 'Конец каждого раунда',
  Mythos: 'Фаза мифа',
  EndInvestigatorTurn: 'Конец хода сыщика',
  BeforeMonsterActivation: 'Перед активацией монстров',
  StartFinalRound: 'Начало последнего раунда',
  NoMorale: 'Мораль закончилась',
  Eliminated: 'Сыщик выбыл',
};

const TOKEN_WORDS: Record<string, string> = {
  Search: 'Поиск',
  Interact: 'Взаимодействие',
  Explore: 'Исследование',
  Sight: 'Осмотр',
  Clue: 'Улика',
  Darkness: 'Тьма',
  Fire: 'Огонь',
  Barricade: 'Баррикада',
  Door: 'Дверь',
  Secret: 'Потайной ход',
  Sewer: 'Канализация',
  Trapdoor: 'Люк',
  Wall: 'Стена',
  Investigators: 'Сыщики',
  Inside: '(внутри)',
  Outside: '(снаружи)',
  Green: 'зелёная',
  Woman: 'женщина',
  Man: 'мужчина',
  White: 'Белая фигура:',
  Grey: 'Серая фигура:',
  Red: 'Красная фигура:',
  Purple: 'Фиолетовая фигура:',
  Orange: 'Оранжевая фигура:',
  Blue: 'Синяя фигура:',
  Cat: 'Кошка',
  Dog: 'Собака',
};

export function tokenLabel(id: string): string {
  const words = id.replace(/^Token/, '').match(/[A-Z][a-z]*|\d+/g) ?? [id];
  if (!words.some((w) => w in TOKEN_WORDS)) return words.join(' ');
  return words.map((w) => TOKEN_WORDS[w] ?? w).join(' ');
}

export const TOKEN_ICON: Record<string, string> = {
  TokenSearch: '🔍',
  TokenInteract: '✋',
  TokenExplore: '👣',
  TokenSight: '👁',
  TokenClue: '❓',
  TokenDarkness: '🌑',
  TokenFire: '🔥',
  TokenInvestigators: '🧑‍🤝‍🧑',
};

export function tokenIcon(id: string): string {
  if (TOKEN_ICON[id]) return TOKEN_ICON[id];
  if (/Door/.test(id)) return '🚪';
  if (/Barricade|Wall/.test(id)) return '🧱';
  if (/Woman|Man/.test(id)) return '🧍';
  return '◆';
}

export const LANGUAGES = [
  'Russian',
  'English',
  'German',
  'French',
  'Spanish',
  'Italian',
  'Polish',
  'Portuguese',
  'Chinese',
  'Korean',
  'Czech',
  'Japanese',
];

export const LANGUAGE_LABEL: Record<string, string> = {
  Russian: 'Русский',
  English: 'English',
  German: 'Deutsch',
  French: 'Français',
  Spanish: 'Español',
  Italian: 'Italiano',
  Polish: 'Polski',
  Portuguese: 'Português',
  Chinese: '中文',
  Korean: '한국어',
  Czech: 'Čeština',
  Japanese: '日本語',
};
