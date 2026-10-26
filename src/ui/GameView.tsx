import { useEffect, useRef, useState } from 'react';
import { factLabel } from '../model/facts';
import {
  adjustClues,
  adjustHp,
  buttonState,
  closable,
  choose,
  defeat,
  eliminated,
  endInvestigatorPhase,
  MAX_START,
  newGame,
  nextPhase,
  randomItems,
  newRound,
  touch,
  windowText,
  type GameState,
} from '../model/game';
import { buttonLabel, buttonsOf, getComponent, getText, resolveText } from '../model/ops';
import type { QComponent } from '../format/scenario';
import catalog from '../content/catalog.json';
import { useStore } from '../store';
import { Picker, Thumb } from './widgets';
import { ITEM_OPTIONS } from './options';
import { TYPE_LABEL } from './labels';
import { MapView } from './MapView';
import { labelOf, plainText, previewHtml } from './options';

// How a {c:Name} in a window is called: a Spawn by its monster, in Russian when the game's texts are connected.
function windowLabel(spawnName: string): string | undefined {
  const c = useStore.getState().scenario.components.find((x) => x.name === spawnName);
  if (c?.type === 'Tile') {
    const tile = catalog.tiles.find((x) => x.id === c.data.side);
    return tile ? labelOf(tile.name, tile.nameKey).split(' · ')[0] : undefined;
  }
  const id = (c?.data.monster ?? '').split(/\s+/)[0];
  const m = catalog.monsters.find((x) => x.id === id);
  return m ? labelOf(m.name, m.nameKey).split(' · ')[0] : undefined;
}

const PHASE = { investigator: 'ход сыщиков', mythos: 'фаза мифов', monsters: 'ход монстров', horror: 'фаза ужаса' } as const;

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
  const [clues, setClues] = useState(1);
  const [kit, setKit] = useState<'none' | 'random' | 'pick'>('random');
  const [kitCount, setKitCount] = useState(3);
  const [picked, setPicked] = useState<string[]>([]);

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
          <b>С чем начинают сыщики?</b>
          <div className="hint" style={{ margin: '6px 0' }}>Улики и предметы, которые у сыщиков уже есть к началу игры. Не больше {MAX_START}.</div>
          <div className="row" style={{ margin: '6px 0', alignItems: 'center' }}>
            Улики:
            {Array.from({ length: MAX_START + 1 }, (_, n) => (
              <button key={n} className={clues === n ? 'primary' : ''} onClick={() => setClues(n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="row" style={{ margin: '6px 0', alignItems: 'center' }}>
            Предметы:
            <button className={kit === 'none' ? 'primary' : ''} onClick={() => setKit('none')}>
              Без предметов
            </button>
            <button className={kit === 'random' ? 'primary' : ''} onClick={() => setKit('random')}>
              Случайные
            </button>
            <button className={kit === 'pick' ? 'primary' : ''} onClick={() => setKit('pick')}>
              Выбрать самим
            </button>
          </div>
          {kit === 'random' && (
            <div className="row" style={{ margin: '6px 0', alignItems: 'center' }}>
              Сколько:
              {Array.from({ length: MAX_START }, (_, i) => i + 1).map((n) => (
                <button key={n} className={kitCount === n ? 'primary' : ''} onClick={() => setKitCount(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
          {kit === 'pick' && (
            <div style={{ margin: '6px 0' }}>
              {picked.map((id) => (
                <div className="row" key={id} style={{ marginBottom: 4 }}>
                  <span style={{ flex: 1 }}>{ITEM_OPTIONS.find((o) => o.value === id)?.label ?? id}</span>
                  <button className="small ghost" onClick={() => setPicked(picked.filter((x) => x !== id))}>
                    Убрать
                  </button>
                </div>
              ))}
              {picked.length < MAX_START ? (
                <Picker options={ITEM_OPTIONS.filter((o) => !picked.includes(o.value))} value="" placeholder="Добавить предмет: начните вводить название…" onChange={(v) => v && setPicked([...picked, v])} />
              ) : (
                <div className="hint">Набрано {MAX_START}, это максимум.</div>
              )}
            </div>
          )}
          <button
            className="primary"
            style={{ marginTop: 8 }}
            onClick={() => {
              setHistory([]);
              const items = kit === 'random' ? randomItems(kitCount) : kit === 'pick' ? picked : [];
              setGame(newGame(s, names.map((n, i) => n.trim() || `Сыщик ${i + 1}`), Math.random, { clues, items }));
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
        <GameUi game={game} onPress={busy || game.ended ? undefined : (n) => act((g) => touch(s, g, n))} />
        <MapView embedded only={game.visible} onPick={busy || game.ended ? undefined : (n) => act((g) => touch(s, g, n))} />
        {current && (
          <div className="game-window" role="dialog">
            <div className="game-title" title={current.name}>
              {spawned ? 'Появление чудовища' : TYPE_LABEL[current.type]}
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
            <div className="game-text" dangerouslySetInnerHTML={{ __html: previewHtml(windowText(s, game, lang, current.name, windowLabel)) || '<i>Текст не написан</i>' }} />
            <div className="play-buttons">
              {buttonsOf(current).filter(() => !(current.type === 'Token' && !(current.data.buttons ?? '').trim())).map((b) => {
                const state = buttonState(current, b.index, game.vars);
                if (state === 'hidden') return null;
                return (
                  <button key={b.index} className="primary" disabled={state === 'disabled'} title={state === 'disabled' ? 'Сейчас эта кнопка недоступна' : ''} onClick={() => act((g) => choose(s, g, b.index))}>
                    {plainText(buttonLabel(s, lang, b), 80) || 'Продолжить'}
                    {!b.targets.length && <small> · дальше ничего</small>}
                  </button>
                );
              })}
              {closable(current) && (
                <button className="ghost" onClick={() => act((g) => choose(s, g, 0))}>
                  Закрыть
                </button>
              )}
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
            Раунд {game.round} · {PHASE[game.phase]}
          </b>
          <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {game.phase === 'investigator' ? (
              <button className="primary" disabled={busy || game.ended} onClick={() => act((g) => endInvestigatorPhase(s, g))}>
                Сыщики закончили ход
              </button>
            ) : game.phase === 'horror' ? (
              <button className="primary" disabled={busy || game.ended} onClick={() => act((g) => newRound(s, g))}>
                Фаза ужаса закончена, новый раунд
              </button>
            ) : (
              <button className="primary" disabled={busy || game.ended} onClick={() => act((g) => nextPhase(g))}>
                {game.phase === 'mythos' ? 'События мифов сыграны, ходят монстры' : 'Монстры походили, фаза ужаса'}
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

        <div className="card">
          <b>Улики: {game.clues}</b>
          <div className="row" style={{ margin: '6px 0' }}>
            <button className="small" disabled={game.clues <= 0} onClick={() => act((g) => adjustClues(g, -1))}>
              −
            </button>
            <button className="small" onClick={() => act((g) => adjustClues(g, 1))}>
              +
            </button>
          </div>
          {(game.startItems.length > 0 || game.items.length > 0) && (
            <>
              <b>Предметы сыщиков</b>
              <div className="hint">
                {[...game.startItems.map((id) => ITEM_OPTIONS.find((o) => o.value === id)?.label ?? id), ...game.items.map(itemName)].join(', ')}
              </div>
            </>
          )}
        </div>

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

// Screen elements of the scenario (the intro screen, for example). They sit over the map; sizes are fractions of the map height.
function GameUi({ game, onPress }: { game: GameState; onPress?: (name: string) => void }) {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const box = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const items = game.visible.map((n) => getComponent(s, n)).filter((c) => c?.type === 'UI');
  if (!items.length) return null;
  const textOf = (c: QComponent) => resolveText(s, lang, getText(s, lang, c.name + '.uitext')).trim();
  const goes = (c: QComponent) => buttonsOf(c).some((b) => b.targets.length);
  const at = (c: QComponent) => `${c.data.xposition ?? 0},${c.data.yposition ?? 0}`;
  const labelled = new Set(items.filter((c) => c && goes(c) && textOf(c)).map((c) => at(c!)));
  return (
    <div className="game-ui" ref={box}>
      {items.map((c) => {
        if (!c) return null;
        const d = c.data;
        const size = Number(d.size ?? 1) || 1;
        const text = textOf(c);
        const press = goes(c);
        // The whole-screen picture is the intro's dark background; other pictures live in the scenario's own files.
        if (!text && !press) return size >= 1 ? <div key={c.name} className="game-ui-bg" /> : null;
        // A picture-only button is drawn only when nothing with text sits in the same place; tiny ones are secret buttons.
        if (!text && (size < 0.02 || labelled.has(at(c)))) return null;
        const x = Number(d.xposition ?? 0) || 0;
        const y = Number(d.yposition ?? 0) || 0;
        const textsize = Number(d.textsize ?? 1) || 1;
        const style = { left: `calc(50% + ${x * h}px)`, top: `calc(50% + ${y * h}px)`, ...(press ? { minWidth: 150 } : { width: size * h }), maxHeight: h * 0.8, fontSize: Math.max(11, textsize * h * 0.028), color: press ? undefined : d.textcolor || undefined } as const;
        return (
          <div
            key={c.name}
            className={'game-ui-item' + (press ? ' press' : '')}
            style={style}
            onClick={press && onPress ? () => onPress(c.name) : undefined}
            role={press ? 'button' : undefined}
          >
            <span dangerouslySetInnerHTML={{ __html: previewHtml(text) || 'Продолжить' }} />
          </div>
        );
      })}
    </div>
  );
}
