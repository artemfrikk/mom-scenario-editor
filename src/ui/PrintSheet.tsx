import { useMemo, useState } from 'react';
import { defaultLanguage } from '../format/scenario';
import { buildSheet } from '../model/sheet';
import { getText } from '../model/ops';
import { useStore } from '../store';
import { TRIGGER_LABEL } from './labels';

// The whole story as a plain document: for proofreading and for people who play-test the scenario.
// "Print" also works as "save as PDF" in the browser's print window.
export function PrintSheet({ onClose }: { onClose: () => void }) {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const facts = useStore((st) => st.facts);
  const notes = useStore((st) => st.notes);
  const [withNotes, setWithNotes] = useState(false);
  const sheet = useMemo(() => buildSheet(s, lang, facts, (t) => TRIGGER_LABEL[t] ?? t), [s, lang, facts]);
  const title = getText(s, lang, 'quest.name') || getText(s, defaultLanguage(s), 'quest.name') || 'Сценарий';
  const board = s.components.filter((c) => ['Tile', 'Token', 'Door', 'Spawn'].includes(c.type));

  return (
    <div className="print-overlay">
      <div className="print-bar">
        <b>Печать сюжета</b>
        <label className="check auto">
          <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} /> с заметками автора
        </label>
        <span className="auto" />
        <button className="primary" onClick={() => window.print()}>
          Печать или PDF
        </button>
        <button onClick={onClose}>Закрыть</button>
      </div>
      <div className="print-page">
        <h1>{title}</h1>
        <p>{getText(s, lang, 'quest.synopsys')}</p>
        {withNotes && notes.trim() && (
          <>
            <h2>Заметки автора</h2>
            <pre>{notes}</pre>
          </>
        )}
        <h2>Ход сюжета</h2>
        {sheet.map((e, i) => (
          <section key={e.name} className="print-event">
            <h3>
              {i + 1}. {e.name}
            </h3>
            {e.when && <div className="small-note">{e.when}</div>}
            {e.onlyIf && <div className="small-note">Событие сработает, только если: {e.onlyIf}</div>}
            {e.hidden ? <div className="small-note">Окна нет, событие срабатывает незаметно.</div> : <blockquote>{e.text || '(текст не написан)'}</blockquote>}
            {e.buttons.length > 0 && (
              <ul>
                {e.buttons.map((b, n) => (
                  <li key={n}>
                    {b.label && <b>«{b.label}»</b>} {b.targets.length ? '→ ' + b.targets.join(' / ') : '→ конец ветки'}
                    {b.condition && <i> (только если {b.condition}; иначе {b.whenFalse})</i>}
                  </li>
                ))}
              </ul>
            )}
            {e.adds.length > 0 && <div className="small-note">Появляется на карте: {e.adds.join(', ')}</div>}
            {e.removes.length > 0 && <div className="small-note">Исчезает с карты: {e.removes.join(', ')}</div>}
            {e.remembers.length > 0 && <div className="small-note">Игра запоминает: {e.remembers.join('; ')}</div>}
          </section>
        ))}
        <h2>Что лежит на карте</h2>
        <p>{board.map((c) => c.name).join(', ') || 'Ничего'}</p>
      </div>
    </div>
  );
}
