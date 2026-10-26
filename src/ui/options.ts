import catalog from '../content/catalog.json';
import type { Scenario } from '../format/scenario';
import { localName, useImages } from '../images';
import { takenSides } from '../model/tiles';
import { tokenLabel } from './labels';
import type { Option } from './widgets';

// "Прихожая · Hall" once the player's Valkyrie texts are connected, plain "Hall" before that.
export function labelOf(name: string, key: string | undefined): string {
  const ru = localName(useImages.getState().names, key);
  return ru && ru !== name ? `${ru} · ${name}` : name;
}

export const packName = Object.fromEntries(catalog.packs.map((p) => [p.id, p.name]));

export const TILE_OPTIONS: Option[] = catalog.tiles.map((t) => ({
  value: t.id,
  get label() {
    return labelOf(t.name, t.nameKey);
  },
  note: `${packName[t.pack] ?? t.pack} · ${t.traits.filter((x) => x !== 'inside' && x !== 'outside').join(', ')}`,
  image: t.image,
}));
// Rooms that can still be chosen: a card already on the map and its back side are left out.
export function freeTileOptions(s: Scenario, except?: string): Option[] {
  const taken = takenSides(s, except);
  return TILE_OPTIONS.filter((o) => !taken.has(o.value));
}

export const TOKEN_OPTIONS: Option[] = catalog.tokens.map((t) => ({ value: t.id, label: tokenLabel(t.id), note: packName[t.pack] }));
export const ITEM_OPTIONS: Option[] = catalog.items.map((t) => ({
  value: t.id,
  get label() {
    return labelOf(t.name, t.nameKey);
  },
  note: t.traits.join(', '),
  image: t.image,
}));
export const MONSTER_OPTIONS: Option[] = catalog.monsters.map((m) => ({
  value: m.id,
  get label() {
    return labelOf(m.name, m.nameKey);
  },
  note: packName[m.pack],
  image: m.image,
}));
export const AUDIO_OPTIONS: Option[] = catalog.audio.map((a) => ({ value: a.id, label: a.id.replace(/^Audio/, ''), note: a.traits.join(', ') }));

export const ICON_TEXT: Record<string, string> = {
  will: '⟨Воля⟩',
  lore: '⟨Знания⟩',
  strength: '⟨Сила⟩',
  agility: '⟨Ловкость⟩',
  observation: '⟨Наблюдательность⟩',
  influence: '⟨Влияние⟩',
  action: '➤',
  success: '✸',
  clue: '🔎',
};

export function previewHtml(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/&lt;(\/?)(b|i)&gt;/g, '<$1$2>')
    .replace(/\{ffg:([A-Z0-9_]+)\}/g, (_, k: string) => `<i>${k.replace(/_MAD\d+$/, '').replace(/^TILE_/, '').toLowerCase().replace(/_/g, ' ')}</i>`)
    .replace(/\{c:([^}]+)\}/g, '<b>$1</b>')
    .replace(/\{rnd:hero\}/g, '<i>[случайный сыщик]</i>')
    .replace(/\{var:([^}]+)\}/g, '<i>[число: $1]</i>')
    .replace(/\\n/g, '<br>')
    .replace(/\{([a-z]+)\}/g, (m, k: string) => ICON_TEXT[k] ?? m);
}

// Plain one-line text for compact previews (story nodes).
export function plainText(text: string, max = 160): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{c:([^}]+)\}/g, '$1')
    .replace(/\{([a-z]+)\}/g, (m, k: string) => ICON_TEXT[k] ?? m)
    .replace(/\{ffg:([A-Z0-9_]+)\}/g, (_, k: string) => k.replace(/_MAD\d+$/, '').replace(/^TILE_/, '').toLowerCase().replace(/_/g, ' '))
    .slice(0, max);
}
