import { useMemo, useState } from 'react';
import { isEventLike } from '../format/scenario';
import { buttonLabel, buttonsOf } from '../model/ops';
import { buildTemplate, TEMPLATES } from '../model/templates';
import { useStore } from '../store';
import { plainText } from './options';

// A list of ready-made patterns. Pick one, say where it hangs, and it is built and linked.
export function TemplatesDialog({ onClose }: { onClose: () => void }) {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const selected = useStore((st) => st.selected);
  const change = useStore((st) => st.change);
  const select = useStore((st) => st.select);
  const flash = useStore((st) => st.flash);
  const facts = useStore((st) => st.facts);
  const setFact = useStore((st) => st.setFact);

  const hooks = useMemo(
    () =>
      s.components
        .filter((c) => isEventLike(c.type) && c.type !== 'Spawn')
        .flatMap((c) =>
          buttonsOf(c).map((b) => ({
            value: `${c.name}:${b.index}`,
            label: `${c.name}, кнопка «${plainText(buttonLabel(s, lang, b), 30) || b.index}»`,
          })),
        ),
    [s, lang],
  );
  const initial = hooks.find((h) => h.value.startsWith((selected ?? '') + ':'))?.value ?? hooks.find((h) => h.value.startsWith('EventStart:'))?.value ?? hooks[0]?.value ?? '';
  const [hook, setHook] = useState(initial);

  const build = (id: string) => {
    const [event, button] = hook.split(':');
    let first = '';
    let newFacts: Record<string, string> = {};
    change((sc) => {
      const built = buildTemplate(sc, lang, id, event ? { event, button: Number(button) } : undefined, facts);
      if (!built) return sc;
      first = built.first;
      newFacts = built.facts;
      return built.scenario;
    });
    for (const [k, v] of Object.entries(newFacts)) setFact(k, v);
    if (first) select(first);
    flash('Добавлено. Замените тексты-заготовки на свои, Ctrl+Z отменяет.');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal templates" role="dialog" aria-label="Готовые заготовки" onClick={(e) => e.stopPropagation()}>
        <h2>Готовые заготовки</h2>
        <p className="hint">Выберите, к чему подключить: цепочки событий привяжутся к этой кнопке, а жетоны и двери будут показаны на карте этим событием.</p>
        <select value={hook} onChange={(e) => setHook(e.target.value)}>
          {hooks.map((h) => (
            <option key={h.value} value={h.value}>
              {h.label}
            </option>
          ))}
        </select>
        <div className="tpl-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="tpl" onClick={() => build(t.id)}>
              <b>
                {t.icon} {t.title}
              </b>
              <span>{t.what}</span>
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <span className="auto" />
          <button className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
