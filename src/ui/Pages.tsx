import { useMemo, useState } from 'react';
import catalog from '../content/catalog.json';
import { defaultLanguage } from '../format/scenario';
import { getText, setText } from '../model/ops';
import { validate } from '../model/validate';
import { useStore } from '../store';
import { LANGUAGE_LABEL, LANGUAGES, TYPE_ICON } from './labels';
import { Field } from './widgets';

export function QuestPage() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const change = useStore((st) => st.change);
  const q = s.quest;
  const setQ = (patch: Record<string, string | undefined>) =>
    change((sc) => {
      const quest = { ...sc.quest };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '') delete quest[k];
        else quest[k] = v;
      }
      return { ...sc, quest };
    }, 'quest:' + Object.keys(patch).join());
  const text = (key: string) => getText(s, lang, key);
  const setT = (key: string, v: string) => change((sc) => setText(sc, lang, key, v), 'qtext:' + key);
  const packs = (q.packs ?? '').split(/\s+/).filter(Boolean);
  const boxes = catalog.packs.filter((p) => p.id !== 'MoMBase');

  return (
    <div className="page quest-page">
      <h1>Сценарий</h1>
      <div className="lead">Как сценарий будет выглядеть в списке Valkyrie, и ваши заметки о сюжете.</div>
      <div className="quest-grid">
      <div className="quest-form">
      <div className="card">
        <Field label="Название">
          <input value={text('quest.name')} onChange={(e) => setT('quest.name', e.target.value)} />
        </Field>
        <Field label="Короткое описание" hint="Одна-две строки для списка сценариев.">
          <input value={text('quest.synopsys')} onChange={(e) => setT('quest.synopsys', e.target.value)} />
        </Field>
        <Field label="Вступление и описание">
          <textarea rows={6} value={text('quest.description')} onChange={(e) => setT('quest.description', e.target.value)} />
        </Field>
        <div className="row">
          <Field label="Авторы (кратко)">
            <input value={text('quest.authors_short')} onChange={(e) => setT('quest.authors_short', e.target.value)} />
          </Field>
          <Field label="Авторы и благодарности">
            <input value={text('quest.authors')} onChange={(e) => setT('quest.authors', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="card">
        <div className="row">
          <Field label="Сыщиков от">
            <input type="number" min={1} max={5} value={q.minhero ?? '1'} onChange={(e) => setQ({ minhero: e.target.value })} />
          </Field>
          <Field label="до">
            <input type="number" min={1} max={5} value={q.maxhero ?? '5'} onChange={(e) => setQ({ maxhero: e.target.value })} />
          </Field>
          <Field label="Длительность, мин">
            <div className="row">
              <input type="number" value={q.lengthmin ?? ''} onChange={(e) => setQ({ lengthmin: e.target.value })} />
              <span className="auto">–</span>
              <input type="number" value={q.lengthmax ?? ''} onChange={(e) => setQ({ lengthmax: e.target.value })} />
            </div>
          </Field>
        </div>
        <Field label={`Сложность: ${Math.round(Number(q.difficulty ?? 0.5) * 100)}%`}>
          <input type="range" min={0} max={1} step={0.05} value={q.difficulty ?? '0.5'} onChange={(e) => setQ({ difficulty: e.target.value })} />
        </Field>
        <Field label="Нужные дополнения" hint="Отмеченные дополнения понадобятся игрокам, чтобы запустить сценарий.">
          <div>
            {boxes.map((p) => (
              <label className="check" key={p.id}>
                <input
                  type="checkbox"
                  checked={packs.includes(p.id)}
                  onChange={(e) => setQ({ packs: (e.target.checked ? [...packs, p.id] : packs.filter((x) => x !== p.id)).join(' ') || undefined })}
                />
                {p.name}
              </label>
            ))}
          </div>
        </Field>
      </div>
      <LanguagesCard />
      </div>
      <NotesCard />
      </div>
    </div>
  );
}

const NOTES_TEMPLATE = `# Сюжет

## Завязка
Кто главные герои и почему они оказались здесь?

## Место действия
Где всё происходит? Какие комнаты и места важны?

## Главная цель
Что нужно сделать игрокам, чтобы победить?

## Тайна
Что на самом деле происходит? Что игроки узнают постепенно?

## Ход сюжета
1.
2.
3.

## Персонажи и монстры
-

## Концовки
- Победа:
- Поражение:
`;

// Free-form plot notes of the author. They are saved inside the .valkyrie file but never shown in the game.
function NotesCard() {
  const notes = useStore((st) => st.notes);
  const setNotes = useStore((st) => st.setNotes);
  const words = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  return (
    <div className="notes-card">
      <div className="notes-head">
        <b>Сюжет и заметки автора</b>
        <span className="hint">{words} слов</span>
      </div>
      <div className="hint" style={{ marginBottom: 8 }}>
        Запишите здесь всю историю: завязку, тайну, ход событий, концовки. Игроки этого не увидят. Заметки сохраняются внутри файла сценария.
      </div>
      <textarea
        className="notes-text"
        value={notes}
        placeholder="Например: «Сыщиков вызвал в старый дом профессор Блэквуд. Он пропал, а в подвале слышны шаги…»"
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="row" style={{ marginTop: 8 }}>
        <button
          className="small auto"
          onClick={() => {
            if (!notes.trim() || confirm('Добавить шаблон в конец ваших заметок?')) setNotes((notes.trim() ? notes.trimEnd() + '\n\n' : '') + NOTES_TEMPLATE);
          }}
        >
          Вставить шаблон сюжета
        </button>
        <span className="auto hint">Подсказка для начала: вопросы в шаблоне помогут ничего не забыть.</span>
      </div>
    </div>
  );
}

function LanguagesCard() {
  const s = useStore((st) => st.scenario);
  const change = useStore((st) => st.change);
  const setLang = useStore((st) => st.setLang);
  const langs = Object.keys(s.texts);
  const main = defaultLanguage(s);
  return (
    <div className="card">
      <Field label="Языки сценария" hint="Основной язык показывается, если перевода на язык игрока нет.">
        <div>
          {langs.map((l) => (
            <span key={l} className="chip" onClick={() => setLang(l)}>
              {LANGUAGE_LABEL[l] ?? l}
              {l === main ? ' · основной' : ''}
            </span>
          ))}
        </div>
      </Field>
      <div className="row">
        <select
          value=""
          onChange={(e) => {
            const l = e.target.value;
            if (!l) return;
            change((sc) => ({ ...sc, texts: { ...sc.texts, [l]: {} } }));
            setLang(l);
          }}
        >
          <option value="">+ Добавить язык…</option>
          {LANGUAGES.filter((l) => !langs.includes(l)).map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABEL[l]}
            </option>
          ))}
        </select>
        <select value={main} onChange={(e) => change((sc) => ({ ...sc, quest: { ...sc.quest, defaultlanguage: e.target.value } }))}>
          {langs.map((l) => (
            <option key={l} value={l}>
              Основной: {LANGUAGE_LABEL[l] ?? l}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function TextsPage() {
  const s = useStore((st) => st.scenario);
  const change = useStore((st) => st.change);
  const select = useStore((st) => st.select);
  const setView = useStore((st) => st.setView);
  const main = defaultLanguage(s);
  const langs = Object.keys(s.texts);
  const [other, setOther] = useState(langs.find((l) => l !== main) ?? '');
  const [filter, setFilter] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const keys = useMemo(() => {
    const all = new Set<string>();
    for (const l of langs) for (const k of Object.keys(s.texts[l])) all.add(k);
    return [...all];
  }, [s.texts, langs]);
  const q = filter.toLowerCase();
  const shown = keys.filter(
    (k) =>
      (!q || k.toLowerCase().includes(q) || getText(s, main, k).toLowerCase().includes(q)) &&
      (!onlyMissing || (other && !getText(s, other, k).trim() && getText(s, main, k).trim())),
  );

  return (
    <div className="page">
      <h1>Тексты и перевод</h1>
      <div className="lead">Все тексты сценария в одной таблице. Удобно для вычитки и перевода.</div>
      <div className="row" style={{ maxWidth: 760, marginBottom: 14 }}>
        <input placeholder="Поиск по тексту или ключу" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select value={other} onChange={(e) => setOther(e.target.value)}>
          <option value="">Без перевода</option>
          {langs
            .filter((l) => l !== main)
            .map((l) => (
              <option key={l} value={l}>
                Перевод: {LANGUAGE_LABEL[l] ?? l}
              </option>
            ))}
        </select>
        {other && (
          <label className="check auto" style={{ margin: 0 }}>
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Только без перевода
          </label>
        )}
      </div>
      <table className="texts-table">
        <thead>
          <tr>
            <th>Ключ</th>
            <th>{LANGUAGE_LABEL[main] ?? main}</th>
            {other && <th>{LANGUAGE_LABEL[other] ?? other}</th>}
          </tr>
        </thead>
        <tbody>
          {shown.map((k) => {
            const owner = k.split('.')[0];
            const isComponent = s.components.some((c) => c.name === owner);
            return (
              <tr key={k}>
                <td className="key">
                  {isComponent ? (
                    <a
                      href="#"
                      style={{ color: 'inherit' }}
                      onClick={(e) => {
                        e.preventDefault();
                        select(owner);
                        setView('story');
                      }}
                    >
                      {k}
                    </a>
                  ) : (
                    k
                  )}
                </td>
                {[main, other].filter(Boolean).map((l) => (
                  <td key={l}>
                    <textarea
                      rows={Math.min(8, Math.max(1, Math.ceil(getText(s, l, k).length / 70)))}
                      value={getText(s, l, k)}
                      onChange={(e) => change((sc) => setText(sc, l, k, e.target.value), `t:${l}:${k}`)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CheckPage() {
  const s = useStore((st) => st.scenario);
  const select = useStore((st) => st.select);
  const setView = useStore((st) => st.setView);
  const issues = useMemo(() => validate(s), [s]);
  const counts = s.components.reduce<Record<string, number>>((m, c) => ((m[c.type] = (m[c.type] ?? 0) + 1), m), {});
  return (
    <div className="page">
      <h1>Проверка</h1>
      <div className="lead">Ошибки, из-за которых сценарий может сломаться в Valkyrie.</div>
      <div className="card">
        {Object.entries(counts).map(([t, n]) => (
          <span key={t} className="chip" style={{ cursor: 'default' }}>
            {TYPE_ICON[t as keyof typeof TYPE_ICON]} {n}
          </span>
        ))}
      </div>
      <div className="card" style={{ padding: 0 }}>
        {issues.length === 0 ? (
          <div style={{ padding: 18, color: 'var(--ok)' }}>✓ Проблем не найдено.</div>
        ) : (
          <ul className="issues">
            {issues.map((i, n) => (
              <li
                key={n}
                onClick={() => {
                  if (!i.component) return;
                  select(i.component);
                  const c = s.components.find((x) => x.name === i.component);
                  setView(c && ['Tile', 'MPlace'].includes(c.type) ? 'map' : 'story');
                }}
              >
                <span className={'dot ' + i.level} />
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
