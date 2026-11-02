// What would stop the scenario from working, said in the author's words, with the thing to look at.

import catalog from '../content/catalog.json';
import { reverseOf } from '../model/tiles';
import { pieceOf, roomOf, startRoom, type Project } from './project';

export interface Problem {
  level: 'error' | 'warning';
  text: string;
  room?: string;
  piece?: string;
  step?: 'cover' | 'prologue' | 'map' | 'endings';
}

const tileName = new Map(catalog.tiles.map((t) => [t.id, t.name]));
export type TileTitle = (side: string) => string;
export const catalogTitle: TileTitle = (side) => tileName.get(side) ?? side.replace(/^TileSide/, '');

export function roomLabelOf(p: Project, id: string, title: TileTitle = catalogTitle): string {
  const r = roomOf(p, id);
  if (!r) return 'комната';
  const same = p.rooms.filter((q) => q.tile === r.tile);
  const base = title(r.tile);
  return same.length > 1 ? `${base} (${same.indexOf(r) + 1})` : base;
}

export function checkProject(p: Project, title: TileTitle = catalogTitle): Problem[] {
  const roomLabel = (q: Project, id: string) => roomLabelOf(q, id, title);
  const out: Problem[] = [];
  if (!p.title.trim()) out.push({ level: 'warning', text: 'У сценария нет названия.', step: 'cover' });
  if (!p.raw && !p.prologue.text.trim()) out.push({ level: 'warning', text: 'Напишите вступление: с него начинается игра.', step: 'prologue' });
  if (!p.rooms.length) {
    out.push({ level: 'error', text: 'На карте нет ни одной комнаты.', step: 'map' });
    return out;
  }
  const start = startRoom(p);
  if (!p.raw && !p.pieces.some((x) => x.kind === 'start')) {
    out.push({ level: 'warning', text: `Не отмечено, где начинают сыщики. Пока это «${roomLabel(p, start!.id)}». Поставьте туда жетон «Сыщики здесь».`, room: start?.id, step: 'map' });
  }

  // rooms nobody opens
  const opened = new Set(p.pieces.flatMap((x) => x.outcome.reveal ?? []));
  if (!p.raw) {
    for (const r of p.rooms) {
      if (r === start || opened.has(r.id)) continue;
      out.push({ level: 'error', text: `В комнату «${roomLabel(p, r.id)}» нельзя попасть: её не открывает ни одна дверь.`, room: r.id, step: 'map' });
    }
  }

  // the same card twice, or a card and its back
  const seen = new Map<string, string>();
  for (const r of p.rooms) {
    const back = reverseOf(r.tile);
    const clash = seen.get(r.tile) ?? (back ? seen.get(back) : undefined);
    if (clash) {
      out.push({
        level: 'error',
        text: `«${roomLabel(p, r.id)}» и «${roomLabel(p, clash)}» напечатаны на одной карточке тайла: в настоящей игре их не положить вместе.`,
        room: r.id,
        step: 'map',
      });
    }
    seen.set(r.tile, r.id);
  }

  for (const x of p.pieces) {
    const where = roomLabel(p, x.room);
    if (x.kind === 'explore' && !(x.outcome.reveal ?? []).length) {
      out.push({ level: 'warning', text: `Дверь в комнате «${where}» никуда не ведёт. Выберите, какую комнату она открывает.`, piece: x.id, room: x.room, step: 'map' });
    }
    if (x.kind === 'monster' && x.when === 'event' && !p.pieces.some((q) => (q.outcome.spawn ?? []).includes(x.id))) {
      out.push({ level: 'warning', text: `Монстр в комнате «${where}» ждёт сигнала, но его никто не зовёт.`, piece: x.id, room: x.room, step: 'map' });
    }
    if (['search', 'interact', 'npc', 'sight'].includes(x.kind) && !x.outcome.text.trim() && !x.outcome.item && !x.outcome.clues && !x.outcome.win && !(x.outcome.reveal ?? []).length) {
      out.push({ level: 'warning', text: `Жетон в комнате «${where}» ничего не делает. Напишите, что найдут сыщики.`, piece: x.id, room: x.room, step: 'map' });
    }
    for (const m of x.outcome.spawn ?? []) if (!pieceOf(p, m)) out.push({ level: 'warning', text: `Жетон в комнате «${where}» зовёт монстра, которого больше нет.`, piece: x.id, step: 'map' });
  }

  if (!p.raw && !p.pieces.some((x) => x.outcome.win)) {
    out.push({ level: 'error', text: 'Пока нельзя победить. Выберите, после чего сыщики побеждают: находка, разговор или побеждённый монстр.', step: 'map' });
  }
  if (!p.winText.trim()) out.push({ level: 'warning', text: 'Нет текста победы.', step: 'endings' });
  return out;
}
