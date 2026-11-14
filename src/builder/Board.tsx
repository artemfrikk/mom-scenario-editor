// The map: rooms and what stands in them. Mouse and fingers both work: drag to move, tap to choose,
// drag the empty board to look around, wheel or two fingers to zoom.

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import catalog from '../content/catalog.json';
import { imageKey, useImages } from '../images';
import { roomAt, roomBox, snap, SNAP_PIECE, SNAP_TILE, SQUARE, type Sizes } from '../build/board';
import { flipRoom, rotateRoom } from '../build/edit';
import { deleteRoom, moveRoom, updatePiece, type Piece } from '../build/project';
import { reverseOf } from '../model/tiles';
import { useBuilder } from '../build/store';
import { actName, paceOf } from '../build/acts';
import { imageOf, kindInfo, roomTitle } from './names';

const PX_PER_UNIT = 1024 / SQUARE; // Valkyrie MoM tile pictures: 1024 px per room space
const PIECE = 0.9;
const tileById = new Map(catalog.tiles.map((t) => [t.id, t]));

interface View {
  x: number; // world x at the left edge
  y: number; // world -y at the top edge
  scale: number; // pixels per unit
}

export interface BoardApi {
  toWorld: (clientX: number, clientY: number) => { x: number; y: number } | null;
  fit: () => void;
}

type Drag =
  | { kind: 'pan'; sx: number; sy: number; view: View }
  | { kind: 'room'; id: string; dx: number; dy: number; moved: boolean; sx: number; sy: number }
  | { kind: 'piece'; id: string; dx: number; dy: number; moved: boolean; sx: number; sy: number };

export function Board({
  sizes,
  onSizes,
  onOpenPiece,
  dimmed,
  apiRef,
}: {
  sizes: Sizes;
  onSizes: (s: Sizes) => void;
  onOpenPiece: (id: string) => void;
  dimmed: Set<string>; // rooms the investigators do not see at the start
  apiRef: Ref<BoardApi>;
}) {
  const p = useBuilder((s) => s.project);
  const pace = useMemo(() => paceOf(p), [p]);
  const selected = useBuilder((s) => s.selected);
  const select = useBuilder((s) => s.select);
  const change = useBuilder((s) => s.change);
  const urls = useImages((s) => s.urls);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View>({ x: -4, y: -10, scale: 40 });
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; view: View; cx: number; cy: number } | null>(null);
  const userMoved = useRef(false);
  // live position of what is being dragged, so the project changes only once, on release
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // measure tile pictures to draw them at their real size
  useEffect(() => {
    const want = new Set(p.rooms.map((r) => r.tile));
    for (const side of want) {
      if (sizes[side]) continue;
      const url = urls[imageKey(tileById.get(side)?.image)];
      if (!url) continue;
      const img = new Image();
      img.onload = () => onSizes({ [side]: [img.naturalWidth / PX_PER_UNIT, img.naturalHeight / PX_PER_UNIT] });
      img.src = url;
    }
  }, [p.rooms, urls, sizes, onSizes]);

  const fit = () => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const r of p.rooms) {
      const b = roomBox(r, sizes);
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, -b.maxY);
      maxY = Math.max(maxY, -b.minY);
    }
    if (!isFinite(minX)) {
      minX = -2;
      maxX = 12;
      minY = -2;
      maxY = 8;
    }
    const scale = Math.min(size.w / (maxX - minX + 5), size.h / (maxY - minY + 5), 90);
    setView({ scale, x: (minX + maxX) / 2 - size.w / scale / 2, y: (minY + maxY) / 2 - size.h / scale / 2 });
  };

  useEffect(() => {
    if (!userMoved.current && size.w > 50) fit();
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, p.rooms.length, sizes]);

  const toWorld = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    return { x: view.x + (clientX - rect.left) / view.scale, y: -(view.y + (clientY - rect.top) / view.scale) };
  };
  useImperativeHandle(apiRef, () => ({ toWorld, fit }));

  const zoomAt = (clientX: number, clientY: number, factor: number, base = view) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scale = Math.max(8, Math.min(160, base.scale * factor));
    const wx = base.x + (clientX - rect.left) / base.scale;
    const wy = base.y + (clientY - rect.top) / base.scale;
    setView({ scale, x: wx - (clientX - rect.left) / scale, y: wy - (clientY - rect.top) / scale });
    userMoved.current = true;
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const down = (e: React.PointerEvent, target: Drag['kind'], id = '') => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // two fingers: zoom, whatever was being dragged
      const [a, b] = [...pointers.current.values()];
      drag.current = null;
      setGhost(null);
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), view, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    const w = toWorld(e.clientX, e.clientY);
    if (!w) return;
    if (target === 'pan') drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, view };
    else if (target === 'room') {
      const r = p.rooms.find((q) => q.id === id)!;
      drag.current = { kind: 'room', id, dx: w.x - r.x, dy: w.y - r.y, moved: false, sx: e.clientX, sy: e.clientY };
    } else {
      const x = p.pieces.find((q) => q.id === id)!;
      drag.current = { kind: 'piece', id, dx: w.x - x.x, dy: w.y - x.y, moved: false, sx: e.clientX, sy: e.clientY };
    }
  };

  const move = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const f = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.current.dist);
      zoomAt(pinch.current.cx, pinch.current.cy, f, pinch.current.view);
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (d.kind === 'pan') {
      setView({ ...d.view, x: d.view.x - (e.clientX - d.sx) / d.view.scale, y: d.view.y - (e.clientY - d.sy) / d.view.scale });
      userMoved.current = true;
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return;
    d.moved = true;
    const w = toWorld(e.clientX, e.clientY);
    if (!w) return;
    const step = d.kind === 'room' ? SNAP_TILE : SNAP_PIECE;
    setGhost({ id: d.id, x: snap(w.x - d.dx, step), y: snap(w.y - d.dy, step) });
  };

  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'pan') {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) select(null);
      return;
    }
    const g = ghost;
    setGhost(null);
    if (!d.moved || !g) {
      if (d.kind === 'room') select({ kind: 'room', id: d.id });
      else {
        select({ kind: 'piece', id: d.id });
        onOpenPiece(d.id);
      }
      return;
    }
    if (d.kind === 'room') change((q) => moveRoom(q, d.id, g.x, g.y));
    else {
      // a piece dropped into another room now belongs to it
      const into = roomAt({ ...p, rooms: p.rooms }, g.x, g.y, sizes);
      change((q) => updatePiece(q, d.id, { x: g.x, y: g.y, ...(into ? { room: into.id } : {}) }));
      select({ kind: 'piece', id: d.id });
    }
  };

  // what to draw, with the dragged thing at its live place
  const shown = useMemo(() => {
    if (!ghost) return p;
    const room = p.rooms.find((r) => r.id === ghost.id);
    if (room) return moveRoom(p, room.id, ghost.x, ghost.y);
    return updatePiece(p, ghost.id, { x: ghost.x, y: ghost.y });
  }, [p, ghost]);

  const sel = selected?.id;
  const selRoomData = selected?.kind === 'room' ? p.rooms.find((r) => r.id === sel) : undefined;
  const selRoom = selRoomData && { id: selRoomData.id, tile: selRoomData.tile, box: roomBox(selRoomData, sizes) };
  const t = `matrix(${view.scale} 0 0 ${view.scale} ${-view.x * view.scale} ${-view.y * view.scale})`;

  return (
    <div className="board">
      <svg
        ref={svgRef}
        className="board-svg"
        onPointerDown={(e) => down(e, 'pan')}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <defs>
          <pattern id="grid" width={SQUARE * view.scale} height={SQUARE * view.scale} patternUnits="userSpaceOnUse" x={-view.x * view.scale} y={-view.y * view.scale}>
            <path d={`M ${SQUARE * view.scale} 0 L 0 0 0 ${SQUARE * view.scale}`} fill="none" stroke="#2c2733" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g transform={t}>
          {shown.rooms.map((r) => {
            const tile = tileById.get(r.tile);
            const url = urls[imageKey(tile?.image)];
            const b = roomBox(r, sizes);
            const [w, h] = sizes[r.tile] ?? [b.maxX - b.minX, b.maxY - b.minY];
            const dim = dimmed.has(r.id);
            return (
              <g key={r.id} className={'room' + (sel === r.id ? ' selected' : '') + (dim ? ' later' : '')} onPointerDown={(e) => down(e, 'room', r.id)}>
                <g transform={`translate(${r.x} ${-r.y}) rotate(${-r.rot})`}>
                  {url ? (
                    <image href={url} width={w} height={h} preserveAspectRatio="none" />
                  ) : (
                    <rect width={w} height={h} className="room-plain" />
                  )}
                </g>
                <rect className="room-frame" x={b.minX} y={-b.maxY} width={b.maxX - b.minX} height={b.maxY - b.minY} rx={0.15} />
                <text className="room-name" x={b.minX + 0.3} y={-b.maxY + 0.7} fontSize={0.55}>
                  {r.todo ? '📝 ' : ''}
                  {pace.roomAct.has(r.id) && pace.acts.length > 1 ? `${actName(pace.roomAct.get(r.id)!)} · ` : ''}
                  {roomTitle(p, r.id)}
                  {dim ? ' · откроется позже' : ''}
                </text>
              </g>
            );
          })}
          {shown.pieces.map((x) => (
            <PieceMark key={x.id} x={x} selected={sel === x.id} urls={urls} onDown={(e) => down(e, 'piece', x.id)} />
          ))}
        </g>
      </svg>
      {selRoom && !ghost && (
        <RoomTools
          left={Math.max(4, (selRoom.box.minX - view.x) * view.scale)}
          top={Math.max(48, (-selRoom.box.maxY - view.y) * view.scale)}
          canFlip={!!reverseOf(selRoom.tile)}
          onRotate={() => change((q) => rotateRoom(q, selRoom.id))}
          onFlip={() => change((q) => flipRoom(q, selRoom.id))}
          onDelete={() => (change((q) => deleteRoom(q, selRoom.id)), select(null))}
        />
      )}
      <div className="board-zoom">
        <button onClick={() => fit()} title="Показать всю карту">⤢</button>
        <button onClick={() => zoomAt(size.w / 2 + svgRef.current!.getBoundingClientRect().left, size.h / 2 + svgRef.current!.getBoundingClientRect().top, 1.25)}>＋</button>
        <button onClick={() => zoomAt(size.w / 2 + svgRef.current!.getBoundingClientRect().left, size.h / 2 + svgRef.current!.getBoundingClientRect().top, 0.8)}>－</button>
      </div>
    </div>
  );
}

function RoomTools({ left, top, canFlip, onRotate, onFlip, onDelete }: { left: number; top: number; canFlip: boolean; onRotate: () => void; onFlip: () => void; onDelete: () => void }) {
  return (
    <div className="room-tools" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      <button onClick={onRotate} title="Повернуть на 90°">⟳ Повернуть</button>
      {canFlip && (
        <button onClick={onFlip} title="Показать другую сторону карточки">
          ⇆ Перевернуть
        </button>
      )}
      <button className="danger" onClick={onDelete} title="Убрать комнату (Delete)">
        🗑
      </button>
    </div>
  );
}

function PieceMark({ x, selected, urls, onDown }: { x: Piece; selected: boolean; urls: Record<string, string>; onDown: (e: React.PointerEvent) => void }) {
  const url = urls[imageKey(imageOf(x.look))];
  const info = kindInfo(x.kind);
  const r = x.kind === 'monster' ? PIECE * 0.62 : PIECE / 2;
  const cls = 'piece piece-' + x.kind + (selected ? ' selected' : '') + (x.kind === 'monster' && x.when === 'event' ? ' waiting' : '');
  return (
    <g className={cls} transform={`translate(${x.x} ${-x.y})`} onPointerDown={onDown}>
      <circle r={r + 0.08} className="piece-ring" />
      {url ? <image href={url} x={-r} y={-r} width={r * 2} height={r * 2} style={{ clipPath: 'circle(50%)' }} /> : <circle r={r} className="piece-bg" />}
      {!url && (
        <text fontSize={r * 1.1} textAnchor="middle" dominantBaseline="central">
          {info.icon}
        </text>
      )}
      {x.outcome.win && (
        <text className="piece-badge" x={r * 0.7} y={-r * 0.7} fontSize={0.42} textAnchor="middle" dominantBaseline="central">
          🏆
        </text>
      )}
    </g>
  );
}
