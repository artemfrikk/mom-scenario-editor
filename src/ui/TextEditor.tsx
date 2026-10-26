import { useRef, useState } from 'react';
import { factLabel, knownFacts } from '../model/facts';
import { resolveText } from '../model/ops';
import { useStore } from '../store';
import { ICON_TEXT, previewHtml } from './options';

// A text box for what players read: buttons for the game's icons, a preview that looks like the window in the game.
const ICONS: [string, string][] = [
  ['will', 'Воля'],
  ['lore', 'Знания'],
  ['strength', 'Сила'],
  ['agility', 'Ловкость'],
  ['observation', 'Наблюдательность'],
  ['influence', 'Влияние'],
  ['action', 'Действие'],
  ['success', 'Успех'],
  ['clue', 'Улика'],
];

const LONG = 700;

export function TextEditor({ value, onChange, rows = 6 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const facts = useStore((st) => st.facts);

  const insert = (before: string, after = '') => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const at = start + before.length + (end - start);
      el?.setSelectionRange(at, at);
    });
  };
  const known = knownFacts(s, facts);

  return (
    <div className="text-editor">
      <div className="te-bar">
        <button className="small" title="Жирный" onClick={() => insert('<b>', '</b>')}>
          <b>Ж</b>
        </button>
        <button className="small" title="Курсив" onClick={() => insert('<i>', '</i>')}>
          <i>К</i>
        </button>
        {ICONS.map(([k, label]) => (
          <button key={k} className="small" title={`Значок игры: ${label}`} onClick={() => insert(`{${k}}`)}>
            {ICON_TEXT[k]}
          </button>
        ))}
        <button className="small" title="Вставить имя случайного сыщика" onClick={() => insert('{rnd:hero}')}>
          🎲 сыщик
        </button>
        {known.length > 0 && (
          <select
            value=""
            style={{ width: 'auto' }}
            title="Вставить число из памяти игры"
            onChange={(e) => e.target.value && insert(`{var:${e.target.value}}`)}
          >
            <option value="">+ число из памяти…</option>
            {known.map((id) => (
              <option key={id} value={id}>
                {factLabel(facts, id)}
              </option>
            ))}
          </select>
        )}
        <span style={{ flex: 1 }} />
        <button className={'small' + (preview ? ' primary' : '')} onClick={() => setPreview(!preview)}>
          👁 Как в игре
        </button>
      </div>
      <textarea ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      <div className={'hint te-count' + (value.length > LONG ? ' warn' : '')}>
        {value.length} знаков{value.length > LONG ? '. Окно получается длинным: за столом такое неудобно читать вслух, подумайте, не разбить ли его на два события.' : ''}
      </div>
      {preview && <div className="preview-text te-preview" dangerouslySetInnerHTML={{ __html: previewHtml(resolveText(s, lang, value)) || '<i>Пусто</i>' }} />}
    </div>
  );
}
