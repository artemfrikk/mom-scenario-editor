// "Можно ли победить?": the solver walks every way through the scenario and reports what it found.

import { useState } from 'react';
import type { Scenario } from '../format/scenario';
import type { Project } from '../build/project';
import { solve, type Verdict } from '../build/solver';
import { kindInfo, monsterTitle, roomTitle } from './names';

export function WinCheck({ p, scenario }: { p: Project; scenario: Scenario }) {
  const [busy, setBusy] = useState(0);
  const [v, setV] = useState<{ for: Scenario; verdict: Verdict } | null>(null);
  const run = async () => {
    setBusy(1);
    const name = (x: Project['pieces'][number]) => {
      const info = kindInfo(x.kind);
      const what = x.title.trim() || (x.kind === 'monster' ? monsterTitle(x.look) : '');
      return `${info.icon} ${info.title}${what ? ` «${what}»` : ''} · ${roomTitle(p, x.room)}`;
    };
    const verdict = await solve(p, scenario, name, (n) => setBusy(n));
    setV({ for: scenario, verdict });
    setBusy(0);
  };
  const r = v?.for === scenario ? v.verdict : null;
  const loseRound = Math.min(...(p.timeline ?? []).filter((t) => t.lose).map((t) => t.round));
  const actions = r ? r.path.filter((m) => !m.includes(': «') && m !== 'Решить головоломку' && m !== 'Закончить раунд').length : 0;
  const rounds = Math.max(1, Math.ceil(actions / 4)); // two investigators, two actions each
  return (
    <div className="card win-check" style={{ maxWidth: 720, marginTop: 16 }}>
      <div className="row">
        <b>🧭 Можно ли победить?</b>
        <button className="auto primary" disabled={!!busy} onClick={run}>
          {busy ? `Перебираю… ${busy > 1 ? busy : ''}` : r ? 'Проверить снова' : 'Проверить'}
        </button>
      </div>
      <p className="hint">Редактор сам пройдёт сценарий всеми путями: проверки с успехом и провалом, все варианты решений, головоломки как решённые. Он найдёт тупики до первой игры за столом.</p>
      {v && !r && <p className="hint">Сценарий изменился с последней проверки. Нажмите «Проверить снова».</p>}
      {r && (
        <div className="verdict">
          {r.win ? (
            <p>
              ✅ <b>Победить можно.</b> Самый короткий путь: {actions} {plural(actions, 'действие', 'действия', 'действий')}, это примерно {rounds} {plural(rounds, 'раунд', 'раунда', 'раундов')} для двух сыщиков.
              {Number.isFinite(loseRound) && rounds >= loseRound - 1 && <> ⚠ Время кончается на раунде {loseRound}: сыщикам почти не останется запаса.</>}
            </p>
          ) : (
            <p>
              ❌ <b>Победить нельзя{r.complete ? '' : ' (насколько удалось проверить)'}.</b> Ни один путь не ведёт к победе. Проверьте замки и то, что открывает комнаты.
            </p>
          )}
          {r.win && (
            <details>
              <summary>Путь к победе</summary>
              <ol>
                {r.path.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
            </details>
          )}
          {r.traps.length > 0 && (
            <>
              <p>
                ⛔ <b>Тупики.</b> После этих ходов победить уже нельзя, а игра не заканчивается:
              </p>
              <ul>
                {r.traps.map((t, i) => (
                  <li key={i}>
                    {t.move}
                    {t.path.length > 0 && <span className="hint"> · если до этого: {t.path.slice(-3).join(' → ')}</span>}
                  </li>
                ))}
              </ul>
              <p className="hint">Так бывает, когда замок ждёт ответ, который можно не выбрать, или предмет, который уже не получить. Дайте другой путь или закончите игру поражением с текстом.</p>
            </>
          )}
          {r.unreached.length > 0 && (
            <>
              <p>
                👻 <b>Никогда не встретятся:</b>
              </p>
              <ul>
                {r.unreached.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              <p className="hint">Комната с ними не открывается, монстра никто не зовёт, или замок не открыть.</p>
            </>
          )}
          {r.win && !r.traps.length && !r.unreached.length && <p className="hint">Тупиков нет, до всего на карте можно добраться.</p>}
          <p className="hint">
            Проверено состояний игры: {r.states}
            {r.complete ? '.' : '. Сценарий большой, проверены не все пути.'} Монстра здесь можно победить в любой момент, а случайные события мифов проверены одним вариантом.
          </p>
        </div>
      )}
    </div>
  );
}

const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};
