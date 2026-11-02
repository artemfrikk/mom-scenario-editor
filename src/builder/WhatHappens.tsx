// The "What happens?" window: opens when a piece is put on the map or tapped.
// The author picks a ready answer and writes the words; the constructor does the rest.

import { useMemo, useState } from 'react';
import catalog from '../content/catalog.json';
import { useImages } from '../images';
import type { Sizes } from '../build/board';
import { roomBehindDoor } from '../build/edit';
import { useOwned } from '../build/owned';
import { deletePiece, pieceOf, updateOutcome, updatePiece, type Outcome, type Piece, type Project } from '../build/project';
import { useBuilder } from '../build/store';
import { itemTitle, kindInfo, tilesFree, monsterTitle, NPC_TOKENS, packOf, roomTitle, tokenTitle } from './names';
import { Picker, type Option } from '../ui/widgets';
import { labelOf } from '../ui/options';

type Preset = { id: string; icon: string; title: string; apply: (o: Outcome) => Partial<Outcome> };

const clear: Partial<Outcome> = { item: undefined, clues: undefined, win: undefined };

// Ready answers for each kind of piece; each only fills the fields, everything stays editable.
const PRESETS: Partial<Record<Piece['kind'], Preset[]>> = {
  search: [
    { id: 'item', icon: '🗝', title: 'Находят предмет', apply: (o) => ({ ...clear, item: o.item || 'ItemCommonKnife', text: o.text || 'Среди старых вещей вы находите кое-что полезное.' }) },
    { id: 'clue', icon: '❓', title: 'Находят улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || 'Обрывок письма. Кто-то здесь явно что-то искал до вас.' }) },
    { id: 'nothing', icon: '🕸', title: 'Ничего', apply: (o) => ({ ...clear, text: o.text || 'Пыль, паутина и ничего больше.' }) },
    { id: 'danger', icon: '⚠', title: 'Опасность', apply: (o) => ({ ...clear, text: o.text || 'Из ящика выскальзывает что-то холодное и склизкое. Каждый сыщик здесь получает 1 ужас.' }) },
    { id: 'win', icon: '🏆', title: 'Главная находка: победа', apply: (o) => ({ ...clear, win: true, text: o.text || 'Вот оно! То, ради чего вы пришли.' }) },
  ],
  interact: [
    { id: 'text', icon: '📜', title: 'Записка или надпись', apply: (o) => ({ ...clear, text: o.text || 'На стене выцарапано: «Не спускайтесь в подвал».' }) },
    { id: 'clue', icon: '❓', title: 'Даёт улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || 'Вы замечаете то, что упустили остальные.' }) },
    { id: 'monster', icon: '👹', title: 'Будит монстра', apply: (o) => ({ ...clear, text: o.text || 'Где-то в доме раздаётся вой.' }) },
    { id: 'win', icon: '🏆', title: 'Завершает ритуал: победа', apply: (o) => ({ ...clear, win: true, text: o.text || 'Последний знак начерчен. Тьма отступает.' }) },
  ],
  sight: [
    { id: 'text', icon: '👁', title: 'Что-то странное', apply: (o) => ({ ...clear, text: o.text || 'В зеркале мелькает чужое отражение.' }) },
    { id: 'clue', icon: '❓', title: 'Даёт улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || 'Следы ведут к камину.' }) },
  ],
  npc: [
    { id: 'talk', icon: '💬', title: 'Рассказывает', apply: (o) => ({ ...clear, text: o.text || '«Хозяин не выходил из кабинета три дня», — шепчет он.' }) },
    { id: 'give', icon: '🗝', title: 'Отдаёт предмет', apply: (o) => ({ ...clear, item: o.item || 'ItemCommonKnife', text: o.text || '«Возьмите. Вам это нужнее».' }) },
    { id: 'clue', icon: '❓', title: 'Даёт улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || '«Я видел, кто приходил ночью».' }) },
    { id: 'win', icon: '🏆', title: 'Спасён: победа', apply: (o) => ({ ...clear, win: true, text: o.text || 'Вы выводите его из проклятого дома.' }) },
  ],
};

const ITEMS: Option[] = catalog.items.map((i) => ({
  value: i.id,
  get label() {
    return labelOf(i.name, i.nameKey);
  },
  note: i.traits.join(', '),
  image: i.image,
}));

export function WhatHappens({ id, sizes, onClose }: { id: string; sizes: Sizes; onClose: () => void }) {
  const p = useBuilder((s) => s.project);
  const change = useBuilder((s) => s.change);
  const select = useBuilder((s) => s.select);
  const owned = useOwned((s) => s.packs);
  useImages((s) => s.names); // names in Russian arrive later
  const x = pieceOf(p, id);
  const [more, setMore] = useState(false);
  if (!x) return null;
  const info = kindInfo(x.kind);
  const o = x.outcome;
  const set = (patch: Partial<Outcome>, key?: string) => change((q) => updateOutcome(q, id, patch), key);
  const setPiece = (patch: Partial<Piece>, key?: string) => change((q) => updatePiece(q, id, patch), key);
  const items = ITEMS.filter((i) => owned.includes(packOf(i.value) ?? 'MoMBase'));
  const others = p.rooms.filter((r) => r.id !== x.room);
  const waiting = p.pieces.filter((m) => m.kind === 'monster' && m.when === 'event' && m.id !== id);
  const presets = PRESETS[x.kind] ?? [];

  if (x.kind === 'start' || x.kind === 'mark') {
    return (
      <Dialog title={info.title} icon={info.icon} onClose={onClose} onDelete={() => (change((q) => deletePiece(q, id)), onClose())}>
        <p className="hint">{x.kind === 'start' ? 'Здесь сыщики ставят свои фигурки в начале игры. Эта комната видна сразу.' : 'Метка просто лежит на карте и ничего не делает. Её видно вместе с комнатой.'}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={x.kind === 'monster' ? `Монстр: ${monsterTitle(x.look)}` : `Что произойдёт? · ${info.title}`}
      icon={info.icon}
      onClose={onClose}
      onDelete={() => (change((q) => deletePiece(q, id)), onClose())}
    >
      <div className="wh">
        <div className="wh-form">
          <div className="hint">Комната: {roomTitle(p, x.room)}</div>

          {x.kind === 'npc' && (
            <label className="field">
              <span>Кто это</span>
              <div className="row">
                <input value={x.title} placeholder="Дворецкий, вдова, полицейский…" onChange={(e) => setPiece({ title: e.target.value }, 'title' + id)} />
                <Picker options={NPC_TOKENS.map((t) => ({ value: t, label: tokenTitle(t), image: catalog.tokens.find((k) => k.id === t)?.image }))} value={x.look} onChange={(v) => setPiece({ look: v })} />
              </div>
            </label>
          )}
          {(x.kind === 'search' || x.kind === 'interact' || x.kind === 'sight') && (
            <label className="field">
              <span>Что это (видите только вы)</span>
              <input value={x.title} placeholder="Письменный стол, камин, сундук…" onChange={(e) => setPiece({ title: e.target.value }, 'title' + id)} />
            </label>
          )}

          {x.kind === 'monster' && <MonsterPart p={p} x={x} setPiece={setPiece} />}

          {x.kind === 'explore' && <DoorPart p={p} x={x} sizes={sizes} set={set} onNewRoom={(r) => select({ kind: 'room', id: r })} />}

          {presets.length > 0 && (
            <div className="presets">
              {presets.map((pr) => (
                <button key={pr.id} onClick={() => set(pr.apply(o))}>
                  <span>{pr.icon}</span> {pr.title}
                </button>
              ))}
            </div>
          )}

          <label className="field">
            <span>{x.kind === 'monster' ? 'Что игроки прочтут, когда монстр побеждён' : x.kind === 'explore' ? 'Что игроки прочтут, открыв дверь' : 'Что игроки прочтут'}</span>
            <textarea rows={5} value={o.text} placeholder={x.kind === 'explore' ? 'Дверь со скрипом поддаётся…' : 'Напишите текст для игроков'} onChange={(e) => set({ text: e.target.value }, 'text' + id)} />
          </label>

          {o.item !== undefined && (
            <label className="field">
              <span>Предмет, который получат сыщики</span>
              <div className="row">
                <Picker options={items} value={o.item} onChange={(v) => set({ item: v })} />
                <button className="auto ghost" onClick={() => set({ item: undefined })} title="Без предмета">✕</button>
              </div>
            </label>
          )}
          {!!o.clues && (
            <label className="field">
              <span>Сколько улик</span>
              <div className="row">
                <input type="number" min={1} max={5} value={o.clues} onChange={(e) => set({ clues: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
                <button className="auto ghost" onClick={() => set({ clues: undefined })} title="Без улик">✕</button>
              </div>
            </label>
          )}

          <button className="link" onClick={() => setMore(!more)}>
            {more ? '▾' : '▸'} Ещё: предмет, улика, открыть комнату, позвать монстра, победа
          </button>
          {more && (
            <div className="more">
              {o.item === undefined && <button onClick={() => set({ item: 'ItemCommonKnife' })}>🗝 Дать предмет</button>}
              {!o.clues && <button onClick={() => set({ clues: 1 })}>❓ Дать улику</button>}
              {x.kind !== 'explore' && others.length > 0 && (
                <div className="field">
                  <span className="hint">Откроются комнаты</span>
                  <RoomChecks p={p} rooms={others.map((r) => r.id)} value={o.reveal ?? []} onChange={(reveal) => set({ reveal })} />
                </div>
              )}
              {waiting.length > 0 && (
                <div className="field">
                  <span className="hint">Появятся монстры (те, что ждут сигнала)</span>
                  {waiting.map((m) => (
                    <label key={m.id} className="check">
                      <input
                        type="checkbox"
                        checked={(o.spawn ?? []).includes(m.id)}
                        onChange={(e) => set({ spawn: e.target.checked ? [...(o.spawn ?? []), m.id] : (o.spawn ?? []).filter((q) => q !== m.id) })}
                      />
                      {monsterTitle(m.look)} — {roomTitle(p, m.room)}
                    </label>
                  ))}
                </div>
              )}
              <label className="check">
                <input type="checkbox" checked={!!o.win} onChange={(e) => set({ win: e.target.checked || undefined })} /> 🏆 После этого сыщики побеждают
              </label>
              {x.kind !== 'monster' && (
                <label className="check">
                  <input type="checkbox" checked={o.once} onChange={(e) => set({ once: e.target.checked })} /> Жетон исчезает после использования
                </label>
              )}
            </div>
          )}
        </div>
        <Preview p={p} x={x} />
      </div>
    </Dialog>
  );
}

function MonsterPart({ p, x, setPiece }: { p: Project; x: Piece; setPiece: (patch: Partial<Piece>, key?: string) => void }) {
  const owned = useOwned((s) => s.packs);
  const options: Option[] = catalog.monsters
    .filter((m) => owned.includes(m.pack))
    .map((m) => ({
      value: m.id,
      get label() {
        return labelOf(m.name, m.nameKey);
      },
      image: m.image,
    }));
  const callers = p.pieces.filter((q) => (q.outcome.spawn ?? []).includes(x.id));
  return (
    <>
      <label className="field">
        <span>Какой монстр</span>
        <Picker options={options} value={x.look} onChange={(v) => setPiece({ look: v })} />
      </label>
      <div className="field">
        <span className="hint">Когда он появится</span>
        <label className="check">
          <input type="radio" checked={(x.when ?? 'room') === 'room'} onChange={() => setPiece({ when: 'room' })} /> Сразу, как только сыщики откроют эту комнату
        </label>
        <label className="check">
          <input type="radio" checked={x.when === 'event'} onChange={() => setPiece({ when: 'event' })} /> Позже, по сигналу (обыск, разговор, рычаг)
        </label>
        {x.when === 'event' && (
          <div className="hint">{callers.length ? `Позовёт: ${callers.map((c) => c.title || kindInfo(c.kind).title).join(', ')}.` : 'Откройте нужный жетон и в «Ещё» отметьте этого монстра.'}</div>
        )}
      </div>
    </>
  );
}

function DoorPart({ p, x, sizes, set, onNewRoom }: { p: Project; x: Piece; sizes: Sizes; set: (o: Partial<Outcome>) => void; onNewRoom: (id: string) => void }) {
  const change = useBuilder((s) => s.change);
  const owned = useOwned((s) => s.packs);
  const others = p.rooms.filter((r) => r.id !== x.room);
  const free = useMemo(() => tilesFree(p, owned), [p, owned]);
  return (
    <div className="field">
      <span className="hint">Куда ведёт дверь</span>
      {others.length > 0 && <RoomChecks p={p} rooms={others.map((r) => r.id)} value={x.outcome.reveal ?? []} onChange={(reveal) => set({ reveal })} />}
      <div className="row" style={{ marginTop: 6 }}>
        <Picker
          options={free}
          value=""
          placeholder="➕ Новая комната за этой дверью…"
          onChange={(tile) => {
            let room = '';
            change((q) => {
              const [next, id] = roomBehindDoor(q, x.id, tile, sizes);
              room = id;
              return next;
            });
            if (room) onNewRoom(room);
          }}
        />
      </div>
      <div className="hint">Новая комната встанет вплотную к этой. Пока дверь не открыта, сыщики её не видят.</div>
    </div>
  );
}

function RoomChecks({ p, rooms, value, onChange }: { p: Project; rooms: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="checks">
      {rooms.map((r) => (
        <label key={r} className="check">
          <input type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((q) => q !== r))} />
          {roomTitle(p, r)}
        </label>
      ))}
    </div>
  );
}

// The window as the players will see it.
function Preview({ p, x }: { p: Project; x: Piece }) {
  const o = x.outcome;
  const lines: string[] = [];
  if (o.item) lines.push(`Сыщики получают: ${itemTitle(o.item)}`);
  if (o.clues) lines.push(o.clues > 1 ? `Улики: ${o.clues}` : 'Сыщик получает улику');
  for (const r of o.reveal ?? []) lines.push(`На карте появляется: ${roomTitle(p, r)}`);
  for (const m of o.spawn ?? []) {
    const q = pieceOf(p, m);
    if (q) lines.push(`Появляется: ${monsterTitle(q.look)}`);
  }
  if (o.win) lines.push('Победа!');
  return (
    <div className="wh-preview">
      <div className="hint">Так увидят игроки</div>
      <div className="wh-card">
        <div className="wh-text">{o.text || <span className="hint">Текст пока пуст. Если оставить так, окно не появится.</span>}</div>
        {lines.length > 0 && (
          <ul className="wh-effects">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <div className="wh-btn">Далее</div>
      </div>
    </div>
  );
}

export function Dialog({ title, icon, children, onClose, onDelete }: { title: string; icon: string; children: React.ReactNode; onClose: () => void; onDelete?: () => void }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal builder-modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <span className="modal-icon">{icon}</span>
          <h2>{title}</h2>
          {onDelete && (
            <button className="danger ghost" onClick={onDelete}>
              Убрать с карты
            </button>
          )}
          <button className="primary" onClick={onClose}>
            Готово
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
