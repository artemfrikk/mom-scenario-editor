import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { aiPrompt, parseAiAnswer } from '../translate/ai';
import { GOOGLE_CODE, translateAll } from '../translate/machine';
import type { Group, Row } from '../translate/rows';
import { useTranslator, type Translations } from '../translate/store';
import { countMatches, fixInvestigator, fixTerms, replaceAll } from '../translate/terms';
import { needsNoTranslation, tokenProblems } from '../translate/tokens';
import { FolderSave } from './FolderSave';
import { LANGUAGE_LABEL, TYPE_ICON, TYPE_LABEL } from './labels';
import { previewHtml } from './options';

type Filter = 'all' | 'empty' | 'auto' | 'problems';
const PAGE = 40;

const langLabel = (l: string) => LANGUAGE_LABEL[l] ?? l;
const TARGETS = Object.keys(GOOGLE_CODE);

function rowState(row: Row, tr: Translations) {
  const e = tr[row.key];
  const text = e?.text ?? '';
  const empty = text.trim() === '';
  const problems = empty ? null : tokenProblems(row.source, text);
  return { text, empty, auto: !empty && e?.status !== 'done', problems };
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function TranslatorPage({ editorReady }: { editorReady: boolean }) {
  const pkg = useTranslator((st) => st.pkg);
  const flash = useStore((st) => st.flash);
  const [restoring, setRestoring] = useState(() => !useTranslator.getState().pkg);

  useEffect(() => {
    if (!restoring) return;
    void useTranslator
      .getState()
      .restoreLast()
      .then((ok) => {
        setRestoring(false);
        if (ok) flash('Продолжаем перевод с того места, где вы остановились.');
      });
  }, [flash, restoring]);

  const openFile = async (f: Blob | undefined, name?: string) => {
    if (!f) return;
    try {
      const how = await useTranslator.getState().open(f, name ?? (f as File).name ?? 'scenario.valkyrie');
      const { target } = useTranslator.getState();
      flash(
        how === 'restored'
          ? 'Нашёлся ваш прошлый перевод этого сценария, продолжаем с него.'
          : how === 'existing'
            ? `В сценарии уже есть перевод (${langLabel(target)}). Его можно поправить и дополнить.`
            : 'Сценарий открыт. Начните с кнопки «Перевести автоматически».',
      );
    } catch (e) {
      flash((e as Error).message);
    }
  };

  if (restoring) return <div className="page" />;
  if (!pkg) return <TranslatorStart onOpen={openFile} editorReady={editorReady} />;
  return <TranslatorWork />;
}

function TranslatorStart({ onOpen, editorReady }: { onOpen: (f: Blob | undefined, name?: string) => void; editorReady: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div className="page">
      <div className="welcome">
        <h1>Переводчик сценариев Valkyrie</h1>
        <div className="lead">
          Откройте любой сценарий .valkyrie, переведите его тексты автоматически, поправьте то, что звучит странно, и сохраните. Значки и
          команды игры в тексте не ломаются, а всё остальное в сценарии остаётся как было.
        </div>
        <div
          className={'drop' + (over ? ' over' : '')}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            onOpen(e.dataTransfer.files[0]);
          }}
        >
          <b>📂 Перетащите сюда файл .valkyrie</b>
          <span>или нажмите, чтобы выбрать его на компьютере</span>
        </div>
        <input ref={input} type="file" accept=".valkyrie,.zip" style={{ display: 'none' }} onChange={(e) => onOpen(e.target.files?.[0])} />
        {editorReady && (
          <button
            style={{ marginBottom: 16 }}
            onClick={async () => onOpen(await useStore.getState().save(), useStore.getState().fileName)}
            title="Перевести сценарий, который сейчас открыт в редакторе"
          >
            📖 Взять сценарий из редактора
          </button>
        )}
        <div className="card">
          <b>Где лежат скачанные сценарии</b>
          <p className="hint" style={{ lineHeight: 1.6 }}>
            Valkyrie хранит их в папке <code>C:\Users\ваше имя\AppData\Roaming\Valkyrie\Download</code>. Проще всего попасть туда так: в окне
            выбора файла вставьте в адресную строку <code>%AppData%\Valkyrie\Download</code> и нажмите Enter.
          </p>
        </div>
        <div className="card">
          <b>Как это работает</b>
          <ol className="hint" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
            <li>Откройте сценарий. Переводчик сам найдёт язык оригинала.</li>
            <li>
              Нажмите <b>«Перевести автоматически»</b>: Google переведёт всё за минуту. Для красивого художественного текста можно перевести
              через ChatGPT или Claude.
            </li>
            <li>Пройдитесь по текстам и поправьте их. Работа сохраняется сама, можно закрыть вкладку и вернуться.</li>
            <li>
              Сохраните файл в папку <b>Download</b> вместо старого и выберите русский язык в настройках Valkyrie.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function TranslatorWork() {
  const pkg = useTranslator((st) => st.pkg)!;
  const source = useTranslator((st) => st.source);
  const target = useTranslator((st) => st.target);
  const groups = useTranslator((st) => st.groups);
  const tr = useTranslator((st) => st.tr);
  const undo = useTranslator((st) => st.undo);
  const undoLabel = useTranslator((st) => st.undoLabel);
  const flash = useStore((st) => st.flash);
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState<string>('');
  const [search, setSearch] = useState('');
  // How many rows are rendered; starts over whenever the filter changes.
  const viewKey = [filter, group, search, source, target].join('|');
  const [page, setPage] = useState({ key: viewKey, n: PAGE });
  const shown = page.key === viewKey ? page.n : PAGE;
  const setShown = (n: number) => setPage({ key: viewKey, n });
  const [machine, setMachine] = useState<{ done: number; total: number; abort: AbortController } | null>(null);
  const [dialog, setDialog] = useState<'ai' | 'replace' | 'saved' | null>(null);

  const languages = Object.keys(pkg.texts);
  const rows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const translatable = useMemo(() => rows.filter((r) => !needsNoTranslation(r.source)), [rows]);
  const stats = useMemo(() => {
    let done = 0;
    let auto = 0;
    let problems = 0;
    for (const r of translatable) {
      const s = rowState(r, tr);
      if (!s.empty) done++;
      if (s.auto) auto++;
      if (s.problems) problems++;
    }
    return { total: translatable.length, done, auto, problems, checked: done - auto };
  }, [translatable, tr]);

  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (group && r.group !== group) return false;
    // Lone icons, dashes and references to other phrases are copied as they are.
    if (needsNoTranslation(r.source)) return false;
    const s = rowState(r, tr);
    if (filter === 'empty' && !s.empty) return false;
    if (filter === 'auto' && !s.auto) return false;
    if (filter === 'problems' && !s.problems) return false;
    return !q || r.source.toLowerCase().includes(q) || s.text.toLowerCase().includes(q) || r.key.toLowerCase().includes(q);
  });

  const title = pkg.texts[target]?.get('quest.name') || pkg.texts[source]?.get('quest.name') || pkg.fileName;

  const runMachine = async (only?: Row[]) => {
    const todo = (only ?? translatable.filter((r) => rowState(r, tr).empty)).filter((r) => r.source.trim());
    if (!todo.length) {
      flash('Все тексты уже переведены. Чтобы перевести заново, очистите нужный текст.');
      return;
    }
    const abort = new AbortController();
    setMachine({ done: 0, total: todo.length, abort });
    let done = 0;
    let lost = 0;
    try {
      await translateAll(
        todo.map((r) => r.source),
        source,
        target,
        (i, res) => {
          done++;
          if (!res.ok) lost++;
          const text = target === 'Russian' ? fixTerms(todo[i].source, res.text) : res.text;
          useTranslator.getState().setText(todo[i].key, text, 'auto');
          setMachine((m) => (m ? { ...m, done } : m));
        },
        { signal: abort.signal },
      );
      if (!abort.signal.aborted)
        flash(lost ? `Готово. В ${lost} текстах потерялись значки игры: они в фильтре «Есть ошибки».` : 'Готово! Теперь пройдитесь по текстам и поправьте их.');
    } catch (e) {
      if (!abort.signal.aborted) flash('Перевод остановился: ' + (e as Error).message + ' Уже переведённое сохранено.');
    } finally {
      setMachine(null);
    }
  };

  const save = async () => {
    try {
      download(await useTranslator.getState().build(), pkg.fileName);
      setDialog('saved');
    } catch (e) {
      flash('Не получилось сохранить: ' + (e as Error).message);
    }
  };

  return (
    <div className="tr">
      <div className="tr-head">
        <div className="tr-title">
          <b>{title}</b>
          <span className="hint">{pkg.fileName}</span>
        </div>
        <label className="tr-lang">
          <span>С языка</span>
          <select value={source} onChange={(e) => void useTranslator.getState().setLanguages(e.target.value, target)}>
            {languages
              .filter((l) => l !== target)
              .map((l) => (
                <option key={l} value={l}>
                  {langLabel(l)}
                </option>
              ))}
          </select>
        </label>
        <span className="tr-arrow">→</span>
        <label className="tr-lang">
          <span>На язык</span>
          <select value={target} onChange={(e) => void useTranslator.getState().setLanguages(source === e.target.value ? languages.find((l) => l !== e.target.value) ?? source : source, e.target.value)}>
            {TARGETS.filter((l) => l !== source).map((l) => (
              <option key={l} value={l}>
                {langLabel(l)}
                {pkg.texts[l] ? ' (уже есть)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="tr-progress" title={`Переведено ${stats.done} из ${stats.total}, из них проверено вами ${stats.checked}`}>
          <div className="hint">
            Переведено <b>{stats.done}</b> из {stats.total} · проверено {stats.checked}
          </div>
          <div className="bar">
            <div className="checked" style={{ width: `${(100 * stats.checked) / Math.max(1, stats.total)}%` }} />
            <div className="auto" style={{ width: `${(100 * stats.auto) / Math.max(1, stats.total)}%` }} />
          </div>
        </div>
        <button className="ghost" onClick={() => confirm('Закрыть этот сценарий? Перевод останется сохранённым в браузере.') && useTranslator.getState().close()}>
          Другой файл
        </button>
      </div>

      <div className="tr-actions">
        {machine ? (
          <div className="tr-running">
            <span>
              Перевожу… {machine.done} из {machine.total}
            </span>
            <div className="bar">
              <div className="auto" style={{ width: `${(100 * machine.done) / machine.total}%` }} />
            </div>
            <button onClick={() => machine.abort.abort()}>Остановить</button>
          </div>
        ) : (
          <>
            <button className="primary" onClick={() => void runMachine()} title="Google переведёт все тексты, у которых ещё нет перевода">
              ⚡ Перевести автоматически
            </button>
            <button onClick={() => setDialog('ai')} title="Художественный перевод через ChatGPT, Claude или другой чат-ассистент">
              🤖 Через ChatGPT / Claude
            </button>
            <button onClick={() => setDialog('replace')} title="Заменить слово сразу во всех переводах">
              🔁 Замена слов
            </button>
          </>
        )}
        {undo && !machine && (
          <button className="ghost" onClick={() => useTranslator.getState().undoBulk()}>
            ↶ Отменить «{undoLabel}»
          </button>
        )}
        <div className="spacer" />
        <FolderSave getBlob={() => useTranslator.getState().build()} fileName={pkg.fileName} onDone={flash} />
        <button className="primary" onClick={save} disabled={!!machine}>
          💾 Сохранить сценарий
        </button>
      </div>

      <div className="tr-body">
        <aside className="tr-groups">
          <button className={group === '' ? 'active' : ''} onClick={() => setGroup('')}>
            <span>📚 Все тексты</span>
          </button>
          {groups
            .filter((g) => g.rows.some((r) => !needsNoTranslation(r.source)))
            .map((g) => (
              <GroupButton key={g.id} g={g} tr={tr} active={group === g.id} onClick={() => setGroup(g.id)} />
            ))}
        </aside>
        <section className="tr-list">
          <div className="tr-filters">
            <input placeholder="🔍 Поиск по тексту" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="seg">
              {(
                [
                  ['all', 'Все'],
                  ['empty', `Без перевода · ${stats.total - stats.done}`],
                  ['auto', `Не проверено · ${stats.auto}`],
                  ['problems', `Есть ошибки · ${stats.problems}`],
                ] as [Filter, string][]
              ).map(([f, label]) => (
                <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 && <div className="tr-empty">{filter === 'all' ? 'Ничего не нашлось.' : 'Здесь пусто. Отлично!'}</div>}
          {visible.slice(0, shown).map((r) => (
            <RowCard key={r.key} row={r} group={groups.find((g) => g.id === r.group)!} showGroup={!group} onMachine={() => void runMachine([r])} busy={!!machine} />
          ))}
          {visible.length > shown && (
            <button className="tr-more" onClick={() => setShown(shown + PAGE)}>
              Показать ещё ({visible.length - shown})
            </button>
          )}
        </section>
      </div>

      {dialog === 'ai' && <AiDialog rows={translatable} onClose={() => setDialog(null)} />}
      {dialog === 'replace' && <ReplaceDialog rows={rows} onClose={() => setDialog(null)} />}
      {dialog === 'saved' && <SavedDialog fileName={pkg.fileName} target={target} onClose={() => setDialog(null)} />}
    </div>
  );
}

function GroupButton({ g, tr, active, onClick }: { g: Group; tr: Translations; active: boolean; onClick: () => void }) {
  const rows = g.rows.filter((r) => !needsNoTranslation(r.source));
  const done = rows.filter((r) => !rowState(r, tr).empty).length;
  const icon = g.type === 'quest' ? '📖' : g.type === 'other' ? '💬' : TYPE_ICON[g.type];
  const kind = g.type === 'quest' || g.type === 'other' ? '' : TYPE_LABEL[g.type];
  return (
    <button className={active ? 'active' : ''} onClick={onClick} title={kind ? `${kind} ${g.title}` : g.title}>
      <span>
        {icon} {g.title}
      </span>
      {rows.length > 0 && <small className={done === rows.length ? 'full' : ''}>{done === rows.length ? '✓' : `${done}/${rows.length}`}</small>}
    </button>
  );
}

function RowCard({ row, group, showGroup, onMachine, busy }: { row: Row; group: Group; showGroup: boolean; onMachine: () => void; busy: boolean }) {
  const entry = useTranslator((st) => st.tr[row.key]);
  const text = entry?.text ?? '';
  const empty = text.trim() === '';
  const fixed = needsNoTranslation(row.source);
  const problems = empty ? null : tokenProblems(row.source, text);
  const status = empty ? 'empty' : entry?.status === 'done' ? 'done' : 'auto';
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [text]);

  const kind = group.type === 'quest' || group.type === 'other' ? '' : TYPE_LABEL[group.type];
  return (
    <div className={'tr-row ' + status + (problems ? ' bad' : '')}>
      <div className="tr-row-head">
        {showGroup && (
          <span className="tr-where">
            {kind ? `${kind} «${group.title}»` : group.title} ·
          </span>
        )}
        <b>{row.field}</b>
        <span className="tr-status">
          {fixed ? 'переводить не нужно' : status === 'empty' ? 'нет перевода' : status === 'done' ? '✓ проверено' : 'машинный перевод'}
        </span>
      </div>
      <div className="tr-cols">
        <div className="tr-source" dangerouslySetInnerHTML={{ __html: sourceHtml(row.source) }} />
        <div>
          <textarea
            ref={area}
            value={text}
            placeholder={fixed ? 'Можно оставить как в оригинале' : 'Перевод…'}
            onChange={(e) => useTranslator.getState().setText(row.key, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                useTranslator.getState().setStatus(row.key, 'done');
                const all = [...document.querySelectorAll<HTMLTextAreaElement>('.tr-row textarea')];
                all[all.indexOf(e.currentTarget) + 1]?.focus();
              }
            }}
            spellCheck
            lang={GOOGLE_CODE[useTranslator.getState().target]}
          />
          {problems && (
            <div className="tr-problem">
              {problems.missing.length > 0 && (
                <>
                  Потерялось: <code>{problems.missing.join(' ')}</code>. Без этого в игре пропадёт значок или ссылка.{' '}
                </>
              )}
              {problems.extra.length > 0 && (
                <>
                  Лишнее: <code>{problems.extra.join(' ')}</code>.
                </>
              )}
            </div>
          )}
          <div className="tr-row-actions">
            <button className="ghost" disabled={busy} onClick={onMachine} title="Перевести этот текст через Google заново">
              ⚡ Google
            </button>
            <button className="ghost" onClick={() => useTranslator.getState().setText(row.key, row.source)} title="Вставить текст оригинала, чтобы править поверх него">
              📋 Как в оригинале
            </button>
            {status === 'auto' && (
              <button className="ghost ok" onClick={() => useTranslator.getState().setStatus(row.key, 'done')} title="Ctrl+Enter в поле перевода делает то же самое">
                ✓ Проверено
              </button>
            )}
            {!empty && <span className="hint tr-preview" dangerouslySetInnerHTML={{ __html: 'В игре: ' + sourceHtml(text) }} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function sourceHtml(text: string): string {
  return previewHtml(text.replace(/\n/g, '\\n')).replace(/\{qst:([^}]+)\}/g, '<i class="tr-ref">[фраза $1]</i>');
}

function AiDialog({ rows, onClose }: { rows: Row[]; onClose: () => void }) {
  const tr = useTranslator((st) => st.tr);
  const target = useTranslator((st) => st.target);
  const flash = useStore((st) => st.flash);
  const [mode, setMode] = useState<'empty' | 'auto'>(() => (rows.some((r) => rowState(r, useTranslator.getState().tr).empty) ? 'empty' : 'auto'));
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const pending = rows.filter((r) => {
    const s = rowState(r, tr);
    return mode === 'empty' ? s.empty : s.empty || s.auto;
  });
  // Portions of about 6000 characters fit any chat comfortably.
  const portion: Row[] = [];
  let size = 0;
  for (const r of pending) {
    if (portion.length && size + r.source.length > 6000) break;
    portion.push(r);
    size += r.source.length;
  }
  const prompt = aiPrompt(
    portion.map((r) => ({ key: r.key, text: r.source })),
    target,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setError('Браузер не дал скопировать. Выделите текст запроса ниже и скопируйте вручную (Ctrl+C).');
    }
  };

  const apply = () => {
    try {
      const data = parseAiAnswer(answer);
      const known = new Set(portion.map((r) => r.key));
      let n = 0;
      for (const [k, v] of Object.entries(data)) {
        if (!known.has(k) || !v.trim()) continue;
        const src = portion.find((r) => r.key === k)!.source;
        useTranslator.getState().setText(k, target === 'Russian' ? fixTerms(src, v) : v, 'auto');
        n++;
      }
      if (!n) throw new Error('В ответе нет ни одного перевода из этой порции. Проверьте, что скопировали ответ на последний запрос.');
      setAnswer('');
      setCopied(false);
      setError('');
      flash(`Вставлено переводов: ${n}. ${pending.length - n > 0 ? 'Можно взять следующую порцию.' : 'Это была последняя порция.'}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tr-ai" role="dialog" aria-label="Перевод через чат-ассистента" onClick={(e) => e.stopPropagation()}>
        <h2>Перевод через ChatGPT или Claude</h2>
        <p className="hint">
          Чат-ассистент переводит длинные истории живее, чем Google. Переводим порциями: скопируйте запрос, вставьте в чат, а ответ
          вставьте сюда.
        </p>
        <div className="tr-radios">
          <label>
            <input type="radio" checked={mode === 'empty'} onChange={() => setMode('empty')} /> Только тексты без перевода
          </label>
          <label>
            <input type="radio" checked={mode === 'auto'} onChange={() => setMode('auto')} /> Ещё и заменить непроверенный машинный перевод
          </label>
        </div>
        {portion.length === 0 ? (
          <p>
            <b>Всё уже переведено.</b>
          </p>
        ) : (
          <>
            <ol>
              <li>
                <div className="row">
                  <button className="primary" onClick={copy}>
                    {copied ? '✓ Запрос скопирован' : '📋 Скопировать запрос'}
                  </button>
                  <span className="hint">
                    {portion.length} текстов из {pending.length}
                  </span>
                </div>
                <details>
                  <summary className="hint">Посмотреть запрос</summary>
                  <textarea readOnly value={prompt} rows={6} onFocus={(e) => e.currentTarget.select()} />
                </details>
              </li>
              <li>
                Откройте{' '}
                <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">
                  ChatGPT
                </a>{' '}
                или{' '}
                <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
                  Claude
                </a>
                , вставьте запрос (Ctrl+V) и отправьте.
              </li>
              <li>
                Скопируйте ответ целиком и вставьте сюда:
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} placeholder='{"EventStart.text": "…"}' />
              </li>
            </ol>
            {error && <div className="error">{error}</div>}
          </>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          {portion.length > 0 && (
            <button className="primary" disabled={!answer.trim()} onClick={apply}>
              Вставить перевод
            </button>
          )}
          <button className="ghost auto" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplaceDialog({ rows, onClose }: { rows: Row[]; onClose: () => void }) {
  const tr = useTranslator((st) => st.tr);
  const target = useTranslator((st) => st.target);
  const flash = useStore((st) => st.flash);
  const [find, setFind] = useState('');
  const [to, setTo] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const keys = rows.map((r) => r.key).filter((k) => tr[k]);
  const matches = keys.reduce((n, k) => n + countMatches(tr[k].text, find, caseSensitive), 0);
  const investigators = target === 'Russian' ? keys.filter((k) => fixInvestigator(tr[k].text) !== tr[k].text).length : 0;

  const apply = (label: string, change: (text: string) => string) => {
    let n = 0;
    useTranslator.getState().bulk(label, (old) => {
      const next = { ...old };
      for (const k of keys) {
        const t = change(old[k].text);
        if (t !== old[k].text) {
          next[k] = { ...old[k], text: t };
          n++;
        }
      }
      return next;
    });
    flash(`Изменено текстов: ${n}. Если что-то не так, нажмите «Отменить».`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Замена слов" onClick={(e) => e.stopPropagation()}>
        <h2>Замена слов во всех переводах</h2>
        <p className="hint">Удобно, чтобы одно имя или термин везде писался одинаково.</p>
        <label className="field">
          <span>Найти</span>
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="например, Уолтер Линч" autoFocus />
        </label>
        <label className="field">
          <span>Заменить на</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="check auto">
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Учитывать большие и маленькие буквы
        </label>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={!find || !matches} onClick={() => apply(`замена «${find}»`, (t) => replaceAll(t, find, to, caseSensitive))}>
            Заменить везде{find ? ` (${matches})` : ''}
          </button>
        </div>
        {investigators > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <b>Сыщики, а не следователи</b>
            <p className="hint">
              В русском издании игры героев называют <b>сыщиками</b>. Машинный перевод пишет «следователь» или «исследователь» в {investigators}{' '}
              текстах. Исправить во всех падежах?
            </p>
            <button onClick={() => apply('сыщики', fixInvestigator)}>Исправить на «сыщик»</button>
          </div>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="ghost auto" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

function SavedDialog({ fileName, target, onClose }: { fileName: string; target: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Что дальше" onClick={(e) => e.stopPropagation()}>
        <h2>Файл сохранён. Что дальше</h2>
        <ol>
          <li>
            Найдите <b>{fileName}</b> в папке «Загрузки».
          </li>
          <li>
            Переложите его в папку сценариев Valkyrie <b>с заменой</b> старого файла:
            <div className="path">
              <code>%AppData%\Valkyrie\Download</code>
            </div>
            <span className="hint">Этот адрес можно вставить прямо в адресную строку Проводника.</span>
          </li>
          <li>
            В Valkyrie откройте настройки и выберите язык <b>{langLabel(target)}</b>.
          </li>
          <li>
            В списке сценариев переключитесь в режим <b>офлайн</b>: иначе при обновлении сценария Valkyrie может скачать оригинал поверх
            перевода.
          </li>
        </ol>
        <p className="hint">Тексты, которые вы не перевели, Valkyrie покажет на языке оригинала.</p>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="primary" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
