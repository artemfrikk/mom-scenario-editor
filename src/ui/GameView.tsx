import { useState } from 'react';
import { factLabel } from '../model/facts';
import {
  adjustHp,
  buttonState,
  choose,
  defeat,
  eliminated,
  endInvestigatorPhase,
  newGame,
  newRound,
  touch,
  windowText,
  type GameState,
} from '../model/game';
import { buttonLabel, buttonsOf, getComponent } from '../model/ops';
import catalog from '../content/catalog.json';
import { useStore } from '../store';
import { Thumb } from './widgets';
import { TYPE_ICON } from './labels';
import { MapView } from './MapView';
import { labelOf, plainText, previewHtml } from './options';

const monsterImage = (id: string) => catalog.monsters.find((m) => m.id === id);

// Play the scenario right here: rounds, event windows, monsters, items and the board, as Valkyrie does it.
export function GameView() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const facts = useStore((st) => st.facts);
  const select = useStore((st) => st.select);
  const setView = useStore((st) => st.setView);
  const min = Math.max(1, Number(s.quest.minhero) || 1);
  const max = Math.max(min, Number(s.quest.maxhero) || 5);
  const [names, setNames] = useState<string[]>(() => Array.from({ length: Math.min(max, Math.max(min, 2)) }, (_, i) => `Сыщик ${i + 1}`));
  const [game, setGame] = useState<GameState | null>(null);
  const [history, setHistory] = useState<GameState[]>([]);

  const act = (fn: (g: GameState) => GameState) => {
    if (!game) return;
    setHistory((h) => [...h.slice(-100), game]);
    setGame(fn(game));
  };

  if (!game) {
    return (
      <div className="page">
        <h1>Играть</h1>
        <div className="lead">Сценарий запускается прямо здесь. Нажимайте кнопки в окнах, трогайте жетоны и двери на карте, ведите раунды.</div>
        <div className="card" style={{ maxWidth: 520 }}>
          <b>Сколько сыщиков играет?</b>
          <div className="row" style={{ margin: '10px 0' }}>
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
              <button
                key={n}
                className={names.length === n ? 'primary' : ''}
                onClick={() => setNames(Array.from({ length: n }, (_, i) => names[i] ?? `Сыщик ${i + 1}`))}
              >
                {n}
              </button>
            ))}
          </div>
          {names.map((n, i) => (
            <input key={i} style={{ marginBottom: 6 }} value={n} aria-label={`Имя сыщика ${i + 1}`} onChange={(e) => setNames(names.map((x, k) => (k === i ? e.target.value : x)))} />
          ))}
          <div className="hint" style={{ margin: '8px 0 12px' }}>
            Число сыщиков влияет на здоровье монстров и на условия «#heroes». Имена подставляются вместо {'{rnd:hero}'} в текстах.
          </div>
          <button
            className="primary"
            onClick={() => {
              setHistory([]);
              setGame(newGame(s, names.map((n, i) => n.trim() || `Сыщик ${i + 1}`)));
            }}
          >
            ▶ Начать игру
          </button>
        </div>
      </div>
    );
  }

  const current = game.current ? getComponent(s, game.current) : undefined;
  const spawned = current?.type === 'Spawn' ? game.monsters.find((m) => m.spawn === current.name) : undefined;
  const busy = !!game.current;
  const itemName = (q: string) => {
    const id = (getComponent(s, q)?.data.itemname ?? '').split(/\s+/)[0];
    const it = catalog.items.find((x) => x.id === id);
    return it ? labelOf(it.name, it.nameKey) : q;
  };

  return (
    <div className="game">
      <div className="game-map">
        <MapView embedded only={game.visible} onPick={busy || game.ended ? undefined : (n) => act((g) => touch(s, g, n))} />
        {current && (
          <div className="game-window" role="dialog">
            <div className="game-title">
              {TYPE_ICON[current.type]} {current.name}
            </div>
            {spawned && (
              <div className="game-monster">
                <Thumb path={monsterImage(spawned.monsterId)?.image} className="game-monster-img" />
                <div>
                  <b>{labelOf(spawned.name, monsterImage(spawned.monsterId)?.nameKey)}</b>
                  <div className="hint">Здоровье: {spawned.maxHp}</div>
                </div>
              </div>
            )}
            <div className="game-text" dangerouslySetInnerHTML={{ __html: previewHtml(windowText(s, game, lang, current.name)) || '<i>Текст не написан</i>' }} />
            <div className="play-buttons">
              {buttonsOf(current).map((b) => {
                const state = buttonState(current, b.index, game.vars);
                if (state === 'hidden') return null;
                return (
                  <button key={b.index} className="primary" disabled={state === 'disabled'} title={state === 'disabled' ? 'Сейчас эта кнопка недоступна' : ''} onClick={() => act((g) => choose(s, g, b.index))}>
                    {plainText(buttonLabel(s, lang, b), 80) || 'Продолжить'}
                    {!b.targets.length && <small> · дальше ничего</small>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {game.ended && (
          <div className="game-window">
            <div className="game-title">🏁 Сценарий завершён</div>
            <p>Раундов сыграно: {game.round}. Побеждено монстров и найденное смотрите в журнале справа.</p>
            <div className="row">
              <button className="primary" onClick={() => setGame(null)}>
                Сыграть ещё раз
              </button>
              <button onClick={() => setView('story')}>Вернуться к редактированию</button>
            </div>
          </div>
        )}
      </div>

      <aside className="game-side">
        <div className="card">
          <b>
            Раунд {game.round} · {game.phase === 'investigator' ? 'ход сыщиков' : 'фаза мифов'}
          </b>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {game.phase === 'investigator' ? (
              <button className="primary" disabled={busy || game.ended} onClick={() => act((g) => endInvestigatorPhase(s, g))}>
                Сыщики закончили ход
              </button>
            ) : (
              <button className="primary" disabled={busy || game.ended} onClick={() => act((g) => newRound(s, g))}>
                Монстры походили, новый раунд
              </button>
            )}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            {busy ? 'Сначала закройте окно события.' : 'Тронуть жетон или дверь: нажмите на них на карте.'}
          </div>
        </div>

        <div className="card">
          <b>Сыщики</b>
          <div className="hint">{game.heroes.join(', ')}</div>
          <button className="small ghost danger" style={{ marginTop: 6 }} disabled={busy || game.ended} onClick={() => act((g) => eliminated(s, g))}>
            Все сыщики выбыли
          </button>
        </div>

        <div className="card">
          <b>Монстры на поле</b>
          {game.monsters.length === 0 && <div className="hint">Пока никого.</div>}
          {game.monsters.map((m, i) => (
            <div className="monster-row" key={i}>
              <Thumb path={monsterImage(m.monsterId)?.image} className="chip-img" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{labelOf(m.name, monsterImage(m.monsterId)?.nameKey)}</b>
                <div className="hint">
                  Здоровье {m.hp} из {m.maxHp}
                </div>
              </div>
              <button className="small" disabled={busy || m.hp <= 0} onClick={() => act((g) => adjustHp(g, i, -1))}>
                −
              </button>
              <button className="small" disabled={busy || m.hp >= m.maxHp} onClick={() => act((g) => adjustHp(g, i, 1))}>
                +
              </button>
              <button className="small" disabled={busy || game.ended} onClick={() => act((g) => defeat(s, g, i))}>
                Побеждён
              </button>
            </div>
          ))}
        </div>

        {game.items.length > 0 && (
          <div className="card">
            <b>Получено сыщиками</b>
            <div className="hint">{game.items.map(itemName).join(', ')}</div>
          </div>
        )}

        <details className="card" open>
          <summary>
            <b>Для автора</b>
          </summary>
          <div className="row" style={{ margin: '8px 0', flexWrap: 'wrap' }}>
            <button className="small" disabled={!history.length} onClick={() => setHistory((h) => (setGame(h[h.length - 1]), h.slice(0, -1)))}>
              ↶ Шаг назад
            </button>
            <button className="small" onClick={() => setGame(null)}>
              Начать сначала
            </button>
            {game.current && (
              <button
                className="small"
                onClick={() => {
                  select(game.current);
                  setView('story');
                }}
              >
                Открыть событие в редакторе
              </button>
            )}
          </div>
          <div className="hint">
            Запомнено:{' '}
            {Object.entries(game.vars)
              .filter(([, v]) => v !== 0)
              .map(([k, v]) => `${factLabel(facts, k)}: ${v}`)
              .join(' · ') || 'ничего'}
          </div>
          <div className="game-log">{game.log.slice(-30).join(' → ')}</div>
        </details>
      </aside>
    </div>
  );
}
