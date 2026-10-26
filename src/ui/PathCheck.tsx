import { create } from 'zustand';
import type { Scenario } from '../format/scenario';
import { explore, type Exploration } from '../model/explore';
import { readiness } from '../model/readiness';
import { useStore } from '../store';

// The last path check. It only counts while the scenario is the very same object it was made for.
const usePaths = create<{ for: Scenario | null; result: Exploration | null; run: (s: Scenario, heroes: string[]) => void }>((set) => ({
  for: null,
  result: null,
  run: (s, heroes) => set({ for: s, result: explore(s, heroes) }),
}));

function useResult(): Exploration | null {
  const s = useStore((st) => st.scenario);
  const { for: made, result } = usePaths();
  return made === s ? result : null;
}

export function PathCheck() {
  const s = useStore((st) => st.scenario);
  const select = useStore((st) => st.select);
  const setView = useStore((st) => st.setView);
  const run = usePaths((st) => st.run);
  const r = useResult();
  const heroes = Math.max(1, Number(s.quest.minhero ?? 1) || 1);
  return (
    <div className="card">
      <b>Проверка всех путей</b>
      <div className="hint" style={{ margin: '4px 0 8px' }}>
        Редактор сам «играет» ваш сценарий: нажимает каждую кнопку, каждый жетон и дверь, переходит из раунда в раунд. Так видно, можно ли дойти до концовки и какие события никогда не срабатывают.
      </div>
      <button className="primary" onClick={() => run(s, Array.from({ length: heroes }, (_, i) => `Сыщик ${i + 1}`))}>
        Проверить все пути
      </button>
      {r && (
        <div style={{ marginTop: 10 }}>
          {r.endings.length ? (
            <div style={{ color: 'var(--ok)' }}>✓ До концовки можно дойти. Найдено концовок: {r.endings.length}.</div>
          ) : (
            <div style={{ color: 'var(--danger, #c0392b)' }}>✗ До концовки дойти не удалось. Нужно событие, которое завершает игру, и путь к нему.</div>
          )}
          {r.endings.map((e) => (
            <div key={e.event} className="hint">
              <a href="#" onClick={(ev) => (ev.preventDefault(), select(e.event), setView('story'))}>{e.event}</a>
              {': '}
              {e.path.length ? e.path.join(' → ') : 'сразу в начале'}
            </div>
          ))}
          {r.neverReached.length > 0 && (
            <div style={{ marginTop: 6 }}>
              Эти события не сработали ни в одном варианте игры:
              <div>
                {r.neverReached.map((n) => (
                  <span key={n} className="chip" onClick={() => (select(n), setView('story'))}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!r.complete && <div className="hint">Сценарий очень большой, проверен не весь. Результат приблизительный.</div>}
          <div className="hint">Проверено вариантов игры: {r.states}. Бросок кубиков берётся самый высокий и самый низкий.</div>
        </div>
      )}
    </div>
  );
}

export function Readiness() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const setView = useStore((st) => st.setView);
  const r = useResult();
  const steps = readiness(s, lang, r ? r.endings.length > 0 : null);
  const done = steps.filter((x) => x.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <div className="card readiness">
      <div className="notes-head">
        <b>Готовность сценария</b>
        <span className="hint">{done} из {steps.length}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: pct + '%' }} />
      </div>
      <ul className="steps-list">
        {steps.map((x) => (
          <li key={x.id} className={x.done ? 'done' : ''} onClick={() => !x.done && x.go && setView(x.go)}>
            <span>{x.done ? '✓' : '○'}</span>
            <span>
              {x.label}
              {!x.done && <small className="hint"> — {x.hint}</small>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
