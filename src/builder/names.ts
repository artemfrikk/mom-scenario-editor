// Names of game pieces in Russian when the player's Valkyrie texts are connected, else the catalog name.

import catalog from '../content/catalog.json';
import { localName, useImages } from '../images';
import { roomLabelOf } from '../build/check';
import type { PieceKind, Project } from '../build/project';
import { reverseOf } from '../model/tiles';
import { tokenLabel } from '../ui/labels';
import { labelOf, packName } from '../ui/options';
import type { Option } from '../ui/widgets';

const tiles = new Map(catalog.tiles.map((t) => [t.id, t]));
const monsters = new Map(catalog.monsters.map((m) => [m.id, m]));
const items = new Map(catalog.items.map((i) => [i.id, i]));
export const tokens = new Map(catalog.tokens.map((t) => [t.id, t]));

const ru = (key: string | undefined) => localName(useImages.getState().names, key);

export const tileTitle = (side: string) => ru(tiles.get(side)?.nameKey) ?? tiles.get(side)?.name ?? side.replace(/^TileSide/, '');
export const monsterTitle = (id: string) => ru(monsters.get(id)?.nameKey) ?? monsters.get(id)?.name ?? id.replace(/^Monster/, '');
export const itemTitle = (id: string) => ru(items.get(id)?.nameKey) ?? items.get(id)?.name ?? id.replace(/^Item/, '');
export const roomTitle = (p: Project, id: string) => roomLabelOf(p, id, tileTitle);

export const imageOf = (look: string): string | undefined =>
  (tiles.get(look) ?? monsters.get(look) ?? items.get(look) ?? tokens.get(look) as { image?: string } | undefined)?.image;

export const packOf = (id: string): string | undefined => (tiles.get(id) ?? monsters.get(id) ?? items.get(id) ?? tokens.get(id))?.pack;

export interface KindInfo {
  kind: PieceKind;
  icon: string;
  title: string;
  hint: string;
  token: string;
}

// What can be put into a room, in the order the palette shows it.
export const KINDS: KindInfo[] = [
  { kind: 'start', icon: '🧑‍🤝‍🧑', title: 'Сыщики начинают здесь', hint: 'Отсюда начинается игра.', token: 'TokenInvestigators' },
  { kind: 'search', icon: '🔍', title: 'Обыск', hint: 'Шкаф, стол, сундук: сыщики что-то находят.', token: 'TokenSearch' },
  { kind: 'explore', icon: '🚪', title: 'Дверь в другую комнату', hint: 'Открывает следующую комнату.', token: 'TokenExplore' },
  { kind: 'interact', icon: '✋', title: 'Взаимодействие', hint: 'Рычаг, алтарь, записка: что-то происходит.', token: 'TokenInteract' },
  { kind: 'sight', icon: '👁', title: 'Осмотр', hint: 'Сыщики замечают что-то странное.', token: 'TokenSight' },
];

export const kindInfo = (k: PieceKind): KindInfo =>
  KINDS.find((x) => x.kind === k) ??
  (k === 'npc'
    ? { kind: 'npc', icon: '🧍', title: 'Персонаж', hint: 'С ним можно поговорить.', token: 'TokenGreyMan' }
    : k === 'monster'
      ? { kind: 'monster', icon: '👹', title: 'Монстр', hint: 'Появляется с комнатой или по сигналу.', token: '' }
      : { kind: 'mark', icon: '🌑', title: 'Метка на карте', hint: 'Тьма, огонь, завал: просто лежит на карте.', token: 'TokenDarkness' });

const GENERIC = new Set(['TokenSearch', 'TokenInteract', 'TokenExplore', 'TokenSight', 'TokenInvestigators', 'TokenClue']);
const MARK = /Darkness|Fire|Barricade|Rubble|Overgrowth|Water|Rift|Sewer|Trapdoor/;
const SKIP = /Door|Wall|Secret|Temple/;

export const MARK_TOKENS = catalog.tokens.filter((t) => MARK.test(t.id)).map((t) => t.id);
export const NPC_TOKENS = catalog.tokens.filter((t) => !GENERIC.has(t.id) && !MARK.test(t.id) && !SKIP.test(t.id)).map((t) => t.id);

export const tokenTitle = (id: string) => tokenLabel(id);

// Tiles that can still go on the map: owned, not used yet, and not the back of a card that is used.
export function tilesFree(p: Project, owned: string[]): Option[] {
  const taken = new Set<string>();
  for (const r of p.rooms) {
    taken.add(r.tile);
    const back = reverseOf(r.tile);
    if (back) taken.add(back);
  }
  return catalog.tiles
    .filter((t) => owned.includes(t.pack) && !taken.has(t.id))
    .map((t) => ({
      value: t.id,
      get label() {
        return labelOf(t.name, t.nameKey);
      },
      note: packName[t.pack],
      image: t.image,
    }));
}


// "AudioDoorCreak1" → "Door Creak 1"
export const soundName = (id: string) =>
  id
    .replace(/^Audio/, '')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/(\d+)/, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
