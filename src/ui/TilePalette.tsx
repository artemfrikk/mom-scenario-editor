import { useMemo, useState } from 'react';
import catalog from '../content/catalog.json';
import { isEventLike } from '../format/scenario';
import type { Side } from '../model/geometry';
import { useStore } from '../store';
import { useImages } from '../images';
import { labelOf, packName } from './options';
import { Thumb } from './widgets';

// A side panel with every room as a picture: click one and it lands in the middle of the map
// and is shown by the chosen event, so it cannot be forgotten.
export function TilePalette({ onPick, onClose, canDock }: { onPick: (side: string, shownBy: string, dir: Side) => void; onClose: () => void; canDock: boolean }) {
  const s = useStore((st) => st.scenario);
  const selected = useStore((st) => st.selected);
  const events = useMemo(() => s.components.filter((c) => isEventLike(c.type) && c.type !== 'Spawn').map((c) => c.name), [s.components]);
  const [shownBy, setShownBy] = useState(() =>
    events.includes(selected ?? '') ? selected! : (s.components.find((c) => c.data.trigger === 'EventStart')?.name ?? events[0] ?? ''),
  );
  const [dir, setDir] = useState<Side>('right');
  useImages((st) => st.names); // redraw when the official names arrive
  const [q, setQ] = useState('');
  const [pack, setPack] = useState('');
  const tiles = catalog.tiles.filter(
    (t) => (!pack || t.pack === pack) && (!q || (labelOf(t.name, t.nameKey) + ' ' + t.id + ' ' + t.traits.join(' ')).toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <aside className="palette">
      <div className="palette-head">
        <b>Комнаты</b>
        <button className="small ghost" onClick={onClose} title="Закрыть панель">
          ✕
        </button>
      </div>
      <label className="hint">Показать в игре, когда сработает:</label>
      <select value={shownBy} onChange={(e) => setShownBy(e.target.value)}>
        {events.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
      <label className="hint">{canDock ? 'Поставить рядом с выбранной комнатой:' : 'Выберите комнату на карте, и новая встанет рядом с ней. Пока ставлю в центре.'}</label>
      {canDock && (
        <div className="row dock">
          {(
            [
              ['left', '◀ слева'],
              ['up', '▲ сверху'],
              ['down', '▼ снизу'],
              ['right', 'справа ▶'],
            ] as [Side, string][]
          ).map(([d, label]) => (
            <button key={d} className={'small' + (dir === d ? ' primary' : '')} onClick={() => setDir(d)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <input placeholder="Поиск: Hall, подвал, улица…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={pack} onChange={(e) => setPack(e.target.value)}>
        <option value="">Все наборы</option>
        {catalog.packs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="palette-grid">
        {tiles.map((t) => (
          <button key={t.id} className="palette-tile" onClick={() => onPick(t.id, shownBy, dir)} title={`${labelOf(t.name, t.nameKey)} · ${packName[t.pack] ?? t.pack}`}>
            <Thumb path={t.image} className="palette-img" />
            <span>{labelOf(t.name, t.nameKey)}</span>
          </button>
        ))}
        {tiles.length === 0 && <div className="hint">Ничего не найдено.</div>}
      </div>
    </aside>
  );
}
