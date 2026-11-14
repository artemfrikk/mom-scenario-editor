// The acts strip over the map: what each act holds, and hints where the pace sags.

import { useMemo, useState } from 'react';
import { actName, paceOf } from '../build/acts';
import { useBuilder } from '../build/store';
import { roomTitle } from './names';

export function PaceBar() {
  const p = useBuilder((s) => s.project);
  const select = useBuilder((s) => s.select);
  const pace = useMemo(() => paceOf(p), [p]);
  const [open, setOpen] = useState(false);
  if (p.rooms.length < 2) return null;
  return (
    <div className={'pace' + (open ? ' open' : '')}>
      <button className="pace-head" onClick={() => setOpen(!open)} title="Акты и темп сценария">
        📈 Темп: {pace.acts.length} {pace.acts.length === 1 ? 'акт' : 'акта'}
        {pace.hints.length > 0 && <span className="badge warn">{pace.hints.length}</span>}
        <span className="hint">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="pace-body">
          <div className="pace-acts">
            {pace.acts.map((a) => (
              <div key={a.n} className="pace-act">
                <b>Акт {actName(a.n)}</b>
                <div className="pace-rooms">
                  {a.rooms.map((r) => (
                    <button key={r} className="link" onClick={() => select({ kind: 'room', id: r })}>
                      {roomTitle(p, r)}
                    </button>
                  ))}
                </div>
                <div className="pace-counts">
                  <span title="Улики и предметы">🔎 {a.clues}</span>
                  <span title="Монстры">👹 {a.monsters}</span>
                  <span title="Проверки и головоломки">🎲 {a.tests}</span>
                  <span title="Решения">⚖ {a.decisions}</span>
                  {a.win && <span title="Здесь можно победить">🏆</span>}
                </div>
              </div>
            ))}
          </div>
          {pace.hints.length ? (
            <ul className="pace-hints">
              {pace.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : (
            <div className="hint">Темп ровный: в каждом акте есть находки и опасность, финал в конце.</div>
          )}
          <div className="hint">Акты считаются по тому, когда открываются комнаты: стартовая комната в первом акте, самые дальние двери в последнем.</div>
        </div>
      )}
    </div>
  );
}
