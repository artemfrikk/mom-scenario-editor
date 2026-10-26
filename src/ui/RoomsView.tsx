import { useMemo } from 'react';
import { roomsOf } from '../model/rooms';
import { tileSize } from '../model/actions';
import { tileBox } from '../model/geometry';
import { startEvent } from '../model/fixes';
import { addComponent, fmt, position, setText, updateData } from '../model/ops';
import { useStore } from '../store';
import { TYPE_ICON } from './labels';
import { TILE_OPTIONS } from './options';
import { Thumb } from './widgets';

// Room by room: what shows the room, and which pieces and events live inside it.
export function RoomsView() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const change = useStore((st) => st.change);
  const select = useStore((st) => st.select);
  const selected = useStore((st) => st.selected);
  const rooms = useMemo(() => roomsOf(s), [s]);
  const inRooms = new Set(rooms.flatMap((r) => r.inside));
  const loose = s.components.filter((c) => ['Token', 'Door'].includes(c.type) && !inRooms.has(c.name));

  const addHere = (tile: string, type: 'Token' | 'Door') => {
    let made = '';
    change((sc) => {
      const t = sc.components.find((c) => c.name === tile);
      if (!t) return sc;
      const p = position(t) ?? { x: 0, y: 0 };
      const [w, h] = tileSize(t.data.side ?? '');
      const box = tileBox(p.x, p.y, w, h, Number(t.data.rotation ?? 0) || 0);
      const n = roomsOf(sc).find((r) => r.tile === tile)?.inside.length ?? 0;
      const at = { xposition: fmt(box.minX + 1.75 + (n % 3) * 1.75), yposition: fmt(box.maxY - 1.75 - Math.floor(n / 3) * 1.75) };
      let [next, name] = addComponent(sc, type, type === 'Token' ? { type: 'TokenSearch', ...at } : { ...at });
      next = setText(setText(next, lang, name + '.text', ''), lang, name + '.button1', type === 'Token' ? 'Искать дальше' : 'Продолжить');
      const host = roomsOf(next).find((r) => r.tile === tile)?.shownBy[0] ?? startEvent(next);
      if (host) {
        const add = (next.components.find((c) => c.name === host)?.data.add ?? '').split(/\s+/).filter(Boolean);
        next = updateData(next, host, { add: [...add, name].join(' ') });
      }
      made = name;
      return next;
    });
    if (made) select(made);
  };

  const chips = (names: string[]) =>
    names.map((n) => {
      const c = s.components.find((x) => x.name === n);
      return (
        <span key={n} className={'chip' + (selected === n ? ' on' : '')} onClick={() => select(n)} title={n}>
          {c ? TYPE_ICON[c.type] : ''} {n}
        </span>
      );
    });

  return (
    <div className="page rooms-page">
      <h1>Комнаты</h1>
      <div className="lead">Всё, что происходит в каждой комнате, в одном месте. Нажмите на любой значок, чтобы открыть его справа и изменить.</div>
      {!rooms.length && <div className="card">На карте пока нет комнат. Добавьте их на вкладке «Карта».</div>}
      <div className="room-grid">
        {rooms.map((r) => (
          <div className="card room-card" key={r.tile}>
            <div className="room-head">
              <Thumb path={TILE_OPTIONS.find((o) => o.value === r.side)?.image} className="room-img" />
              <div>
                <b onClick={() => select(r.tile)} style={{ cursor: 'pointer' }}>
                  {TILE_OPTIONS.find((o) => o.value === r.side)?.label ?? r.tile}
                </b>
                <div className="hint">{r.tile}</div>
              </div>
            </div>
            <div className="hint">Появляется, когда срабатывает:</div>
            <div>{r.shownBy.length ? chips(r.shownBy) : <span className="hint">ничего её не показывает</span>}</div>
            <div className="hint">Внутри:</div>
            <div>{r.inside.length ? chips(r.inside) : <span className="hint">пока пусто</span>}</div>
            {r.events.some((e) => !r.inside.includes(e)) && (
              <>
                <div className="hint">Что из этого запускается:</div>
                <div>{chips(r.events.filter((e) => !r.inside.includes(e)))}</div>
              </>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="small" onClick={() => addHere(r.tile, 'Token')}>
                + жетон здесь
              </button>
              <button className="small" onClick={() => addHere(r.tile, 'Door')}>
                + дверь здесь
              </button>
            </div>
          </div>
        ))}
        {loose.length > 0 && (
          <div className="card room-card">
            <b>Вне комнат</b>
            <div className="hint">Жетоны и двери, которые лежат не на комнате.</div>
            <div>{chips(loose.map((c) => c.name))}</div>
          </div>
        )}
      </div>
    </div>
  );
}
