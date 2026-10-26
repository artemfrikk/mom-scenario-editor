import { useEffect, useMemo, useRef, useState } from 'react';
import { getText } from './model/ops';
import { validate } from './model/validate';
import { restoreAutosave, useStore, type View } from './store';
import { useImages } from './images';
import { ImagesDialog } from './ui/ImagesDialog';
import { Inspector } from './ui/Inspector';
import { LANGUAGE_LABEL } from './ui/labels';
import { MapView } from './ui/MapView';
import { CheckPage, QuestPage, TextsPage } from './ui/Pages';
import { StoryView } from './ui/StoryView';

const NAV: { view: View; icon: string; label: string }[] = [
  { view: 'quest', icon: '📖', label: 'Сценарий' },
  { view: 'story', icon: '🕸', label: 'Сюжет' },
  { view: 'map', icon: '🗺', label: 'Карта' },
  { view: 'texts', icon: '🌐', label: 'Тексты' },
  { view: 'check', icon: '✔', label: 'Проверка' },
];

export default function App() {
  const view = useStore((st) => st.view);
  const setView = useStore((st) => st.setView);
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const setLang = useStore((st) => st.setLang);
  const fileName = useStore((st) => st.fileName);
  const dirty = useStore((st) => st.dirty);
  const past = useStore((st) => st.past);
  const future = useStore((st) => st.future);
  const { undo, redo, open, reset, save } = useStore.getState();
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useStore((st) => st.notice);
  const flash = useStore((st) => st.flash);
  const [started, setStarted] = useState(false);
  const issues = useMemo(() => validate(s), [s]);
  const errors = issues.filter((i) => i.level === 'error').length;

  useEffect(() => {
    restoreAutosave().then((ok) => setStarted(ok));
    void useImages.getState().restore();
  }, []);

  const doSave = async () => {
    const blob = await save();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    flash(errors ? `Сохранено, но есть ошибки: ${errors}. Загляните в «Проверку».` : 'Сценарий сохранён.');
  };

  const doOpen = async (f: File | undefined) => {
    if (!f) return;
    try {
      await open(f);
      setStarted(true);
      flash(`Открыт ${f.name}`);
    } catch (e) {
      flash('Не удалось открыть файл: ' + (e as Error).message);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const inField = (e.target as HTMLElement).closest('input, textarea');
      const k = e.key.toLowerCase();
      if ((k === 'z' || k === 'я') && !e.shiftKey && !inField) {
        e.preventDefault();
        undo();
      } else if (((k === 'z' || k === 'я') && e.shiftKey) || k === 'y' || k === 'н') {
        if (inField) return;
        e.preventDefault();
        redo();
      } else if (k === 's' || k === 'ы') {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const languages = Object.keys(s.texts);
  const title = getText(s, lang, 'quest.name') || 'Без названия';
  const withInspector = view === 'story' || view === 'map';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Особняки безумия <small>редактор сценариев</small>
        </div>
        <div className="title">
          <b>{title}</b> · {fileName}
          {dirty ? ' · есть несохранённые изменения' : ''}
        </div>
        <button className="ghost" onClick={undo} disabled={!past.length} title="Отменить (Ctrl+Z)">
          ↶
        </button>
        <button className="ghost" onClick={redo} disabled={!future.length} title="Повторить (Ctrl+Shift+Z)">
          ↷
        </button>
        {languages.length > 1 && (
          <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ width: 'auto' }} title="Язык, на котором вы редактируете тексты">
            {languages.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABEL[l] ?? l}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => {
            if (dirty && !confirm('Начать новый сценарий? Несохранённые изменения пропадут.')) return;
            reset();
            setStarted(true);
          }}
        >
          Новый
        </button>
        <button onClick={() => fileInput.current?.click()}>Открыть…</button>
        <button className="primary" onClick={doSave} title="Ctrl+S">
          Сохранить .valkyrie
        </button>
        <input ref={fileInput} type="file" accept=".valkyrie,.zip" style={{ display: 'none' }} onChange={(e) => doOpen(e.target.files?.[0])} />
      </header>
      {!started ? (
        <Welcome
          onNew={() => {
            reset();
            setStarted(true);
          }}
          onOpen={() => fileInput.current?.click()}
          onDrop={doOpen}
        />
      ) : (
        <div className={'main' + (withInspector ? '' : ' no-inspector')}>
          <nav className="nav">
            {NAV.map((n) => (
              <button key={n.view} className={view === n.view ? 'active' : ''} onClick={() => setView(n.view)} title={n.label}>
                <span>{n.icon}</span>
                <span className="lbl">{n.label}</span>
                {n.view === 'check' && issues.length > 0 && <span className={'badge' + (errors ? '' : ' warn')}>{issues.length}</span>}
              </button>
            ))}
            <div className="spacer" />
            <div className="hint" style={{ padding: '0 10px' }}>
              Файлы открываются и сохраняются только на вашем компьютере.
            </div>
          </nav>
          <main className="workspace">
            {view === 'quest' && <QuestPage />}
            {view === 'story' && <StoryView />}
            {view === 'map' && <MapView />}
            {view === 'texts' && <TextsPage />}
            {view === 'check' && <CheckPage />}
          </main>
          {withInspector && <Inspector />}
        </div>
      )}
      {started && <ImagesDialog auto={view === 'map' || view === 'story'} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Welcome({ onNew, onOpen, onDrop }: { onNew: () => void; onOpen: () => void; onDrop: (f: File | undefined) => void }) {
  return (
    <div
      className="page"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(e.dataTransfer.files[0]);
      }}
    >
      <div className="welcome">
        <h1>Создавайте свои сценарии для «Особняков безумия»</h1>
        <div className="lead">
          Редактор сохраняет файлы в формате Valkyrie, так что сценарий можно сразу запустить в приложении Valkyrie и поделиться им с друзьями.
        </div>
        <div className="actions">
          <button onClick={onNew}>
            <b>✨ Новый сценарий</b>
            <span>Начните с пустого сценария со стартовым событием.</span>
          </button>
          <button onClick={onOpen}>
            <b>📂 Открыть .valkyrie</b>
            <span>Продолжите свой сценарий или изучите чужой. Можно перетащить файл сюда.</span>
          </button>
        </div>
        <div className="card">
          <b>Как это устроено</b>
          <ol className="hint" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
            <li>
              <b>Сюжет</b>: события в виде схемы. Каждая кнопка события ведёт к следующему, протяните стрелку от кнопки, чтобы связать
              их, или отпустите на пустом месте, чтобы создать новое.
            </li>
            <li>
              <b>Карта</b>: разложите тайлы, жетоны и двери мышкой. Событие «Показать на карте» открывает их во время игры.
            </li>
            <li>
              <b>Проверка</b> подскажет, где ссылка ведёт в никуда или событие недостижимо.
            </li>
            <li>
              Сохраните файл и положите его в папку сценариев Valkyrie, чтобы сыграть.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
