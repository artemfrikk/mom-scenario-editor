// Acts and pace: the rooms fall into acts by when they open, and every act is counted
// (clues, monsters, tests, decisions) so the author sees where the story sags or ends too soon.

import { startRoom, type Piece, type Project } from './project';

export interface Act {
  n: number; // 1, 2, 3
  rooms: string[];
  clues: number; // clues and items found
  monsters: number;
  tests: number; // skill tests and puzzles
  harm: number; // tests that hurt on failure
  decisions: number;
  win: boolean; // victory can come in this act
}

export interface Pace {
  roomAct: Map<string, number>; // rooms that open at some point; the others are not in any act
  pieceAct: Map<string, number>;
  acts: Act[];
  hints: string[];
}

const NAMES = ['I', 'II', 'III'];
export const actName = (n: number) => NAMES[n - 1] ?? String(n);

export function paceOf(p: Project): Pace {
  const start = startRoom(p);
  const roomStep = new Map<string, number>();
  const pieceStep = new Map<string, number>();
  if (start) roomStep.set(start.id, 0);
  const spawners = (m: Piece) => p.pieces.filter((x) => x.outcome.spawn?.includes(m.id) || x.outcome.choices?.some((c) => c.outcome.spawn?.includes(m.id)));
  const reveals = (x: Piece) => [...(x.outcome.reveal ?? []), ...(x.outcome.choices ?? []).flatMap((c) => c.outcome.reveal ?? [])];
  // Step by step until nothing changes: a room opens one step after what opens it, a lock waits for what it needs.
  for (let round = 0; round < p.rooms.length + p.pieces.length + 2; round++) {
    let changed = false;
    for (const x of p.pieces) {
      let s = roomStep.get(x.room);
      if (x.kind === 'monster' && x.when === 'event') {
        const by = spawners(x)
          .map((q) => pieceStep.get(q.id))
          .filter((v): v is number => v !== undefined);
        s = by.length ? Math.max(s ?? 0, Math.min(...by)) : undefined;
      }
      if (s === undefined) continue;
      const needs = (x.outcome.lock?.needs ?? []).filter((n) => !n.startsWith('%')).map((n) => pieceStep.get(n.split('.')[0]));
      if (needs.some((v) => v === undefined)) continue;
      const step = Math.max(s, ...needs.map((v) => v! + 1));
      if (pieceStep.get(x.id) !== step) {
        pieceStep.set(x.id, step);
        changed = true;
      }
    }
    for (const r of p.rooms) {
      if (r === start) continue;
      const by = p.pieces
        .filter((x) => reveals(x).includes(r.id))
        .map((x) => pieceStep.get(x.id))
        .filter((v): v is number => v !== undefined);
      const timed = (p.timeline ?? []).some((t) => t.outcome.reveal?.includes(r.id));
      const step = by.length ? Math.min(...by) + 1 : timed ? 1 : undefined;
      if (step !== undefined && roomStep.get(r.id) !== step) {
        roomStep.set(r.id, step);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const last = Math.max(0, ...roomStep.values());
  const count = Math.min(3, last + 1);
  const actOf = (step: number) => Math.min(count, 1 + Math.floor((Math.min(step, last) * count) / (last + 1)));
  const roomAct = new Map([...roomStep].map(([id, s]) => [id, actOf(s)]));
  const pieceAct = new Map([...pieceStep].map(([id, s]) => [id, actOf(s)]));

  const acts: Act[] = Array.from({ length: count }, (_, i) => ({ n: i + 1, rooms: [], clues: 0, monsters: 0, tests: 0, harm: 0, decisions: 0, win: false }));
  for (const r of p.rooms) {
    const a = roomAct.get(r.id);
    if (a) acts[a - 1].rooms.push(r.id);
  }
  for (const x of p.pieces) {
    const a = pieceAct.get(x.id);
    if (!a) continue;
    const act = acts[a - 1];
    const o = x.outcome;
    const outs = [o, ...(o.choices ?? []).map((c) => c.outcome)];
    act.clues += outs.reduce((n, q) => n + (q.clues ?? 0) + (q.item ? 1 : 0), 0);
    if (x.kind === 'monster') act.monsters++;
    if (o.test || o.puzzle) act.tests++;
    if (o.test?.harm && o.test.harm.amount > 0) act.harm++;
    if (o.choices?.length) act.decisions++;
    if (outs.some((q) => q.win)) act.win = true;
  }

  const hints: string[] = [];
  if (count === 1 && p.rooms.length >= 3) hints.push('Все комнаты открываются сразу: нет нарастания. Спрячьте часть комнат за дверями.');
  for (const act of acts) {
    if (act.n > 1 && !act.monsters && !act.harm) hints.push(`В акте ${actName(act.n)} ещё нет опасности: ни монстра, ни проверки с уроном или ужасом.`);
    if (!act.clues && !act.win && act.rooms.length) hints.push(`В акте ${actName(act.n)} сыщики ничего не находят: нет улик и предметов.`);
  }
  const firstWin = acts.find((a) => a.win);
  if (firstWin && firstWin.n < count) hints.push(`Финал наступает слишком рано: победить можно уже в акте ${actName(firstWin.n)}, и акт ${actName(count)} можно пропустить. Заприте финал, пока сыщики не сделают что-то из последнего акта.`);
  const lost = p.rooms.filter((r) => !roomAct.has(r.id));
  if (lost.length) hints.push(`Комнат, которые никогда не откроются: ${lost.length}. К ним не ведёт ни одна дверь.`);
  return { roomAct, pieceAct, acts, hints };
}
