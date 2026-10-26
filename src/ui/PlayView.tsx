import { useMemo, useState } from 'react';
import { isEventLike, type Scenario } from '../format/scenario';
import { testsPass, type Vars } from '../model/facts';
import { buttonLabel, buttonsOf, getText, resolveText } from '../model/ops';
import { factLabel } from '../model/facts';
import { buttonState, fire, startPlay, type PlayState } from '../model/play';
import { useStore } from '../store';
import { TYPE_ICON } from './labels';
import { MapView } from './MapView';
import { plainText, previewHtml } from './options';

// Try the scenario as a player: press the buttons, see what appears on the map.
export function PlayView() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const select = useStore((st) => st.select);
  const facts = useStore((st) => st.facts);
  const setView = useStore((st) => st.setView);
  const [state, setState] = useState<PlayState>(() => startPlay(s));
  const [history, setHistory] = useState<PlayState[]>([]);

  const go = (name: string) => {
    setHistory((h) => [...h, state]);
    setState(fire(s, state, name));
  };
  const restart = () => {
    setHistory([]);
    setState(startPlay(s));
  };

  const current = state.current ? s.components.find((c) => c.name === state.current) : undefined;
  const { visible, current: currentName } = state;
  const pressable = useMemo(
    () => s.components.filter((c) => visible.includes(c.name) && (c.type === 'Token' || c.type === 'Door') && c.name !== currentName),
    [s.components, visible, currentName],
  );
  // Events that start by themselves later in the game (rounds, mythos...), offered as manual steps.
  const timed = s.components.filter((c) => isEventLike(c.type) && c.data.trigger && c.data.trigger !== 'EventStart');

  return (
    <div className="split">
      <div className="split-left play-pane">
        <div className="play-head">
          <b>▶ Пробный запуск</b>
          <span className="auto" />
          <button className="small" disabled={!history.length} onClick={() => setHistory((h) => (setState(h[h.length - 1]), h.slice(0, -1)))}>
            ↶ Шаг назад
          </button>
          <button className="small" onClick={restart}>
            Сначала
          </button>
        </div>
        <div className="hint" style={{ marginBottom: 10 }}>
          Нажимайте кнопки, как это сделают игроки. Справа видно, что в этот момент лежит на карте. Раунды и кубики здесь не считаются, а «память игры» считается.
        </div>
        {state.ended && <div className="info ok">Сценарий завершён (сработало «конец игры»).</div>}
        {state.note && <div className="info">{state.note}</div>}
        {current ? (
          <div className="play-window">
            <div className="play-title">
              {TYPE_ICON[current.type]} {current.name}
              <button
                className="small ghost"
                onClick={() => {
                  select(current.name);
                  setView('story');
                }}
              >
                Открыть в редакторе
              </button>
            </div>
            <div className="preview-text" dangerouslySetInnerHTML={{ __html: previewHtml(resolveText(s, lang, getText(s, lang, current.name + '.text'))) || '<i>Текст не написан</i>' }} />
            <div className="play-buttons">
              {buttonsOf(current).map((b) => {
                const st = buttonState(current, b.index, state.vars);
                if (st === 'hidden') return null;
                return (
                <button key={b.index} className="primary" disabled={!b.targets.length || st === 'disabled'} title={st === 'disabled' ? 'Условие кнопки не выполнено' : b.targets.length ? '' : 'Эта кнопка пока никуда не ведёт'} onClick={() => go(b.targets.find((n) => testsPassFor(s, n, state.vars)) ?? b.targets[0])}>
                  {plainText(buttonLabel(s, lang, b), 60) || 'Продолжить'}
                  {b.targets.length > 1 ? ' 🎲' : ''}
                </button>
                );
              })}
              {!buttonsOf(current).length && <span className="hint">У события нет кнопок.</span>}
            </div>
          </div>
        ) : (
          <div className="empty-state">{startPlay(s).path.length ? 'Окно закрыто. Выберите жетон, дверь или событие ниже.' : 'Нет события, которое запускается в начале. Загляните в «Проверку».'}</div>
        )}
        {pressable.length > 0 && (
          <div className="card">
            <b>Жетоны и двери на карте</b>
            <div className="hint">Нажмите, как будто игрок коснулся их.</div>
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              {pressable.map((c) => (
                <button key={c.name} className="small" onClick={() => go(c.name)}>
                  {TYPE_ICON[c.type]} {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {timed.length > 0 && (
          <details className="card">
            <summary>События, которые срабатывают по ходу игры</summary>
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 8 }}>
              {timed.map((c) => (
                <button key={c.name} className="small" onClick={() => go(c.name)}>
                  {c.name}
                </button>
              ))}
            </div>
          </details>
        )}
        {Object.keys(state.vars).length > 0 && (
          <div className="card">
            <b>Что запомнила игра</b>
            <div className="hint" style={{ marginTop: 6 }}>
              {Object.entries(state.vars)
                .map(([k, v]) => `${factLabel(facts, k)}: ${v}`)
                .join(' · ')}
            </div>
          </div>
        )}
        <div className="hint" style={{ marginTop: 12 }}>
          Путь: {state.path.length ? state.path.join(' → ') : 'пока пусто'}
        </div>
      </div>
      <div className="split-bar" style={{ cursor: 'default' }} />
      <div className="split-right" style={{ width: '50%' }}>
        <MapView embedded only={state.visible} />
      </div>
    </div>
  );
}

function testsPassFor(s: Scenario, name: string, vars: Vars): boolean {
  return testsPass(s.components.find((c) => c.name === name)?.data.vartests, vars);
}
