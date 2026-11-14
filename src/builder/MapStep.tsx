// The map step: a palette on the left, the board in the middle, the chosen room on the right.
// Anything in the palette can be dragged onto the board, or tapped to put it into the chosen room.

import { PaceBar } from './Pace';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import catalog from '../content/catalog.json';
import { imageUrl, useImages } from '../images';
import { roomAt, type Sizes } from '../build/board';
import { addPiece, addRoom, flipRoom, rotateRoom } from '../build/edit';
import { reverseOf } from '../model/tiles';
import { useOwned } from '../build/owned';
import { deletePiece, deleteRoom, piecesIn, roomOf, startRoom, updateRoom, type PieceKind, type Project } from '../build/project';
import { useBuilder } from '../build/store';
import { Board, type BoardApi } from './Board';
import { imageOf, KINDS, tilesFree, kindInfo, MARK_TOKENS, monsterTitle, NPC_TOKENS, packOf, roomTitle, tokenTitle } from './names';
import { WhatHappens } from './WhatHappens';
import { SoundPick } from './Sound';

type Tab = 'rooms' | 'things' | 'people' | 'monsters';
type Grab = { what: 'tile' | 'piece'; kind?: PieceKind; look: string; icon: string; label: string };

export function MapStep() {
  const p = useBuilder((s) => s.project);
  const change = useBuilder((s) => s.change);
  const selected = useBuilder((s) => s.selected);
  const select = useBuilder((s) => s.select);
  const flash = useBuilder((s) => s.flash);
  const [sizes, setSizes] = useState<Sizes>({});
  const onSizes = useCallback((s: Sizes) => setSizes((m) => ({ ...m, ...s })), []);
  const [open, setOpen] = useState<string | null>(null);
  const board = useRef<BoardApi>(null);

  // rooms that are not on the table when the game begins
  const dimmed = useMemo(() => {
    const start = startRoom(p);
    return new Set(p.rooms.filter((r) => r !== start).map((r) => r.id));
  }, [p]);

  // Delete (or Backspace) removes the chosen room or piece; Ctrl+Z brings it back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
      const target = open ? { kind: 'piece' as const, id: open } : selected;
      if (!target) return;
      e.preventDefault();
      change((q) => (target.kind === 'room' ? deleteRoom(q, target.id) : deletePiece(q, target.id)));
      select(null);
      setOpen(null);
      flash(target.kind === 'room' ? 'Комната убрана. Ctrl+Z вернёт её.' : 'Убрано с карты. Ctrl+Z вернёт.');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, selected, change, select, flash]);

  const room = selected?.kind === 'room' ? roomOf(p, selected.id) : selected?.kind === 'piece' ? roomOf(p, p.pieces.find((x) => x.id === selected.id)?.room ?? '') : undefined;

  // Something from the palette lands on the board (at = world point) or is tapped (no point).
  const place = (g: Grab, at: { x: number; y: number } | null) => {
    if (g.what === 'tile') {
      let id = '';
      change((q) => {
        const [next, rid] = addRoom(q, g.look, at ? { x: at.x - 3.5, y: at.y + 1.75 } : undefined, sizes);
        id = rid;
        return next;
      });
      select({ kind: 'room', id });
      if (!p.rooms.length) flash('Первая комната на карте. Поставьте в неё жетон «Сыщики начинают здесь».');
      return;
    }
    const target = at ? roomAt(p, at.x, at.y, sizes) : room;
    if (!target) {
      flash(at ? 'Положите это внутрь комнаты.' : 'Сначала выберите комнату на карте.');
      return;
    }
    let id = '';
    change((q) => {
      const [next, pid] = addPiece(q, target.id, g.kind!, g.look, at ?? undefined, sizes);
      id = pid;
      return next;
    });
    select({ kind: 'piece', id });
    setOpen(id);
  };

  return (
    <div className="map-step">
      <Palette p={p} onPlace={place} board={board} hasRoom={!!room} />
      <div className="map-center">
        {!p.rooms.length && (
          <div className="board-empty">
            <b>Начните с первой комнаты.</b>
            <div className="hint">Перетащите тайл слева на поле или просто нажмите на него.</div>
          </div>
        )}
        <Board apiRef={board} sizes={sizes} onSizes={onSizes} onOpenPiece={setOpen} dimmed={dimmed} />
        <PaceBar />
      </div>
      {room && <RoomPanel id={room.id} onAdd={(kind, look) => place({ what: 'piece', kind, look, icon: '', label: '' }, null)} onOpen={setOpen} />}
      {open && <WhatHappens id={open} sizes={sizes} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Palette({ p, onPlace, board, hasRoom }: { p: Project; onPlace: (g: Grab, at: { x: number; y: number } | null) => void; board: React.RefObject<BoardApi | null>; hasRoom: boolean }) {
  const [tab, setTab] = useState<Tab>(p.rooms.length ? 'things' : 'rooms');
  const [query, setQuery] = useState('');
  const owned = useOwned((s) => s.packs);
  const urls = useImages((s) => s.urls);
  useImages((s) => s.names);
  const [ghost, setGhost] = useState<{ g: Grab; x: number; y: number } | null>(null);

  const tiles = useMemo(() => tilesFree(p, owned), [p, owned]);
  const q = query.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);

  // Drag with mouse or finger. A short tap counts as "put it into the chosen room".
  // A finger that moves mostly up or down scrolls the list; any other move drags the piece out.
  // The browser does not scroll here (touch-action: none), so a diagonal drag towards the map is never lost.
  const grab = (e: React.PointerEvent, g: Grab) => {
    if (e.pointerType === 'mouse') e.preventDefault();
    const touch = e.pointerType !== 'mouse';
    const list = (e.currentTarget as HTMLElement).closest('.pal-list') as HTMLElement | null;
    const sx = e.clientX;
    const sy = e.clientY;
    const top = list?.scrollTop ?? 0;
    let mode: '' | 'drag' | 'scroll' = '';
    const mv = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!mode) {
        if (Math.hypot(dx, dy) < 8) return;
        mode = touch && list && Math.abs(dy) > Math.abs(dx) * 2.5 ? 'scroll' : 'drag';
      }
      if (mode === 'scroll') list!.scrollTop = top - dy;
      else setGhost({ g, x: ev.clientX, y: ev.clientY });
    };
    const stop = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', stop);
      setGhost(null);
    };
    const finish = (ev: PointerEvent) => {
      stop();
      if (mode === 'scroll') return;
      if (!mode) return onPlace(g, null);
      const at = board.current?.toWorld(ev.clientX, ev.clientY);
      if (at) onPlace(g, at);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', stop);
  };

  const Item = ({ g, image, note }: { g: Grab; image?: string; note?: string }) => {
    const url = imageUrl(urls, image);
    return (
      <div className="pal-item" onPointerDown={(e) => grab(e, g)} title={note}>
        {url ? <img src={url} alt="" draggable={false} /> : <span className="pal-icon">{g.icon}</span>}
        <span className="pal-label">{g.label}</span>
      </div>
    );
  };

  return (
    <aside className="b-palette">
      <div className="pal-tabs">
        {(
          [
            ['rooms', '🧱 Комнаты'],
            ['things', '🔍 Жетоны'],
            ['people', '🧍 Люди'],
            ['monsters', '👹 Монстры'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>
      <input className="pal-search" placeholder="Поиск…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="hint pal-hint">
        {tab === 'rooms' ? 'Перетащите комнату на поле или нажмите, чтобы поставить рядом.' : hasRoom ? 'Перетащите в комнату или нажмите, чтобы положить в выбранную.' : 'Перетащите в комнату на карте.'}
      </div>
      <div className={'pal-list' + (tab === 'rooms' ? ' tiles' : '')}>
        {tab === 'rooms' &&
          tiles.filter((t) => match(t.label)).map((t) => <Item key={t.value} g={{ what: 'tile', look: t.value, icon: '🧱', label: t.label }} image={t.image} note={t.note} />)}
        {tab === 'things' && (
          <>
            {KINDS.filter((k) => match(k.title)).map((k) => (
              <Item key={k.kind} g={{ what: 'piece', kind: k.kind, look: k.token, icon: k.icon, label: k.title }} image={imageOf(k.token)} note={k.hint} />
            ))}
            <div className="pal-sub">Метки на карте</div>
            {MARK_TOKENS.filter((t) => owned.includes(packOf(t) ?? 'MoMBase') && match(tokenTitle(t))).map((t) => (
              <Item key={t} g={{ what: 'piece', kind: 'mark', look: t, icon: '🌑', label: tokenTitle(t) }} image={imageOf(t)} />
            ))}
          </>
        )}
        {tab === 'people' &&
          NPC_TOKENS.filter((t) => owned.includes(packOf(t) ?? 'MoMBase') && match(tokenTitle(t))).map((t) => (
            <Item key={t} g={{ what: 'piece', kind: 'npc', look: t, icon: '🧍', label: tokenTitle(t) }} image={imageOf(t)} />
          ))}
        {tab === 'monsters' &&
          catalog.monsters
            .filter((m) => owned.includes(m.pack) && match(monsterTitle(m.id)))
            .map((m) => <Item key={m.id} g={{ what: 'piece', kind: 'monster', look: m.id, icon: '👹', label: monsterTitle(m.id) }} image={m.image} />)}
      </div>
      {ghost && (
        <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.g.icon} {ghost.g.label}
        </div>
      )}
    </aside>
  );
}

function RoomPanel({ id, onAdd, onOpen }: { id: string; onAdd: (kind: PieceKind, look: string) => void; onOpen: (id: string) => void }) {
  const p = useBuilder((s) => s.project);
  const change = useBuilder((s) => s.change);
  const select = useBuilder((s) => s.select);
  const r = roomOf(p, id);
  if (!r) return null;
  const pieces = piecesIn(p, id);
  const start = startRoom(p);
  const openers = p.pieces.filter((x) => (x.outcome.reveal ?? []).includes(id));
  return (
    <aside className="room-panel">
      <div className="room-head">
        <h3>{roomTitle(p, id)}</h3>
        <button className="small" onClick={() => change((q) => rotateRoom(q, id))} title="Повернуть">
          ⟳
        </button>
        {reverseOf(r.tile) && (
          <button className="small" onClick={() => change((q) => flipRoom(q, id))} title="Перевернуть карточку на другую сторону">
            ⇆
          </button>
        )}
        <button className="small danger" onClick={() => (change((q) => deleteRoom(q, id)), select(null))} title="Убрать комнату (Delete)">
          🗑
        </button>
      </div>
      <div className="hint">
        {r === start
          ? 'Сыщики начинают здесь, комната видна с начала игры.'
          : openers.length
            ? `Появится, когда сыщики откроют: ${openers.map((o) => roomTitle(p, o.room)).join(', ')}.`
            : '⚠ Пока сюда не ведёт ни одна дверь.'}
      </div>
      <label className="field">
        <span>Что видят сыщики, войдя сюда</span>
        <textarea rows={3} value={r.enterText} placeholder="Необязательно. Например: «Холодно. В камине тлеют угли…»" onChange={(e) => change((q) => updateRoom(q, id, { enterText: e.target.value }), 'enter' + id)} />
      </label>
      <RoomSound id={id} sound={r.sound} music={r.music} />

      <div className="room-add">
        <div className="hint">Что здесь будет?</div>
        {KINDS.map((k) => (
          <button key={k.kind} onClick={() => onAdd(k.kind, k.token)} title={k.hint}>
            {k.icon} {k.title}
          </button>
        ))}
        <button onClick={() => onAdd('npc', NPC_TOKENS[0])}>🧍 Персонаж</button>
        <button onClick={() => onAdd('monster', catalog.monsters[0].id)}>👹 Монстр</button>
      </div>

      {pieces.length > 0 && (
        <div className="room-list">
          <div className="hint">В комнате</div>
          {pieces.map((x) => {
            const info = kindInfo(x.kind);
            return (
              <button key={x.id} className="room-item" onClick={() => onOpen(x.id)}>
                <span>{info.icon}</span>
                <span className="grow">
                  {x.title || (x.kind === 'monster' ? monsterTitle(x.look) : info.title)}
                  {x.outcome.win ? ' · 🏆' : ''}
                  <small>{summary(p, x.id)}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function summary(p: Project, id: string): string {
  const x = p.pieces.find((q) => q.id === id)!;
  const o = x.outcome;
  const bits: string[] = [];
  if (x.kind === 'monster') bits.push(x.when === 'event' ? 'ждёт сигнала' : 'выходит с комнатой');
  if (o.lock) bits.push('🔒');
  if (o.test) bits.push('🎲 проверка');
  if (o.puzzle) bits.push('🧩 головоломка');
  if (o.choices?.length) bits.push(`💬 ответов: ${o.choices.length}`);
  if (o.item) bits.push('предмет');
  if (o.clues) bits.push('улика');
  if (o.reveal?.length) bits.push('→ ' + o.reveal.map((r) => roomTitle(p, r)).join(', '));
  if (o.spawn?.length) bits.push('зовёт монстра');
  if (!bits.length && o.text) bits.push(o.text.slice(0, 40) + (o.text.length > 40 ? '…' : ''));
  if (!bits.length && x.kind !== 'start' && x.kind !== 'mark') bits.push('пока ничего не делает');
  return bits.join(' · ');
}

// A room's own sound when it appears, and the music that starts there.
function RoomSound({ id, sound, music }: { id: string; sound?: string; music?: string }) {
  const change = useBuilder((s) => s.change);
  const [open, setOpen] = useState(false);
  if (!open && !sound && !music)
    return (
      <button className="link" onClick={() => setOpen(true)}>
        ▸ 🔊 Звук и музыка комнаты
      </button>
    );
  return (
    <>
      <SoundPick label="🔊 Звук, когда комната открывается" value={sound} onChange={(v) => change((q) => updateRoom(q, id, { sound: v }))} />
      <SoundPick music label="🎵 Музыка с этого момента" value={music} onChange={(v) => change((q) => updateRoom(q, id, { music: v }))} />
    </>
  );
}
