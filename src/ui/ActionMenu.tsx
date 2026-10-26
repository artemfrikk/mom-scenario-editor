import { useState } from 'react';
import { ACTIONS, applyAction, type Action } from '../model/actions';
import { useStore } from '../store';
import { freeTileOptions, ITEM_OPTIONS, MONSTER_OPTIONS } from './options';
import { Picker } from './widgets';


// "What can happen" in plain words: pick an action and the right fields get filled in.
export function ActionMenu({ event }: { event: string }) {
  const lang = useStore((st) => st.lang);
  const scenario = useStore((st) => st.scenario);
  const facts = useStore((st) => st.facts);
  const setFact = useStore((st) => st.setFact);
  const change = useStore((st) => st.change);
  const select = useStore((st) => st.select);
  const flash = useStore((st) => st.flash);
  const [asking, setAsking] = useState<Action | null>(null);

  const run = (a: Action, arg = '') => {
    let first: string | undefined;
    let newFacts: Record<string, string> = {};
    change((sc) => {
      const r = applyAction(sc, lang, event, a.id, arg, facts);
      if (!r) return sc;
      first = r.first;
      newFacts = r.facts;
      return r.scenario;
    });
    for (const [id, label] of Object.entries(newFacts)) setFact(id, label);
    setAsking(null);
    flash(`Готово: ${a.title.toLowerCase()}.`);
    if (first && first !== event) select(first);
  };

  return (
    <div className="action-menu">
      <div className="action-grid">
        {ACTIONS.map((a) => (
          <button key={a.id} className="action-card" title={a.what} onClick={() => (a.needs ? setAsking(a) : run(a))}>
            <span className="ico">{a.icon}</span>
            <span>{a.title}</span>
          </button>
        ))}
      </div>
      {asking?.needs && (
        <div className="action-ask">
          <div className="hint">{asking.what} Выберите:</div>
          <Picker options={asking.needs === 'tile' ? freeTileOptions(scenario) : asking.needs === 'monster' ? MONSTER_OPTIONS : ITEM_OPTIONS} value="" autoFocus placeholder="Начните вводить название…" onChange={(v) => run(asking, v)} />
          <button className="small ghost" onClick={() => setAsking(null)}>
            Отмена
          </button>
        </div>
      )}
    </div>
  );
}
