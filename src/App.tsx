import { useEffect, useRef, useState } from 'react';
import { compileCampaign } from './build/campaign';
import { useOwned } from './build/owned';
import { allChapters, restoreAutosave, useBuilder, type Step } from './build/store';
import { ChapterBar } from './builder/Chapters';
import { MapStep } from './builder/MapStep';
import { ThreatStep } from './builder/ThreatStep';
import { CoverStep, EndingsStep, OwnedDialog, PlayStep, Problems, PrologueStep } from './builder/Steps';
import { useProblems } from './builder/problems';
import { StartChoices, StartDialog } from './builder/Start';
import type { Project } from './build/project';
import { useImages } from './images';
import { useStore } from './store';
import { ImagesButton, ImagesDialog } from './ui/ImagesDialog';
import { TranslatorPage } from './ui/Translator';

const STEPS: { step: Step; icon: string; label: string }[] = [
  { step: 'cover', icon: '📖', label: 'Обложка' },
  { step: 'prologue', icon: '🕯', label: 'Вступление' },
  { step: 'map', icon: '🗺', label: 'Карта' },
  { step: 'threat', icon: '⏳', label: 'Угроза' },
  { step: 'endings', icon: '🏁', label: 'Финалы' },
  { step: 'play', icon: '▶', label: 'Сыграть' },
];

export default function App() {
  const p = useBuilder((s) => s.project);
  const step = useBuilder((s) => s.step);
  const setStep = useBuilder((s) => s.setStep);
  const dirty = useBuilder((s) => s.dirty);
  const fileName = useBuilder((s) => s.fileName);
  const past = useBuilder((s) => s.past);
  const future = useBuilder((s) => s.future);
  const notice = useBuilder((s) => s.notice);
  const flash = useBuilder((s) => s.flash);
  const toast = useStore((s) => s.notice);
  const askedPacks = useOwned((s) => s.asked);
  const { undo, redo, open, reset, save } = useBuilder.getState();
  const fileInput = useRef<HTMLInputElement>(null);
  const [started, setStarted] = useState(false);
  const [packs, setPacks] = useState(false);
  const [translator, setTranslator] = useState(() => window.location.hash === '#translate');
  const problems = useProblems();
  const errors = problems.filter((x) => x.level === 'error').length;

  useEffect(() => {
    restoreAutosave().then(setStarted);
    void useImages.getState().restore();
    const onHash = () => setTranslator(window.location.hash === '#translate');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openTranslator = (on: boolean) => {
    if (on) useStore.setState({ scenario: compileCampaign(allChapters(), useBuilder.getState().assets), fileName, lang: 'Russian' });
    window.location.hash = on ? 'translate' : '';
    setTranslator(on);
  };

  const doSave = async () => {
    const blob = await save();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    flash(errors ? `Файл скачан, но в сценарии есть что поправить: ${errors}.` : 'Файл скачан. Положите его в папку Valkyrie\\Download.');
  };

  const doOpen = async (f: File | undefined) => {
    if (!f) return;
    try {
      await open(f);
      setStarted(true);
      flash(useBuilder.getState().foreign ? `Открыт ${f.name}. Он сделан в другом редакторе: комнаты видны, остальное сохранится как было.` : `Открыт ${f.name}`);
    } catch (e) {
      flash('Не удалось открыть файл: ' + (e as Error).message);
    }
  };

  const [choosing, setChoosing] = useState(false);
  const startNew = (from?: Project) => {
    if (dirty && !confirm('Начать новый сценарий? Несохранённые изменения пропадут.')) return;
    setChoosing(false);
    reset(from);
    setStarted(true);
    if (!askedPacks) setPacks(true);
    if (from) flash(`Открыт пример «${from.title}». Меняйте в нём что угодно или сразу сыграйте на шаге «Сыграть».`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || translator) return;
      const inField = (e.target as HTMLElement).closest('input, textarea');
      const k = e.key.toLowerCase();
      if ((k === 'z' || k === 'я') && !inField) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((k === 'y' || k === 'н') && !inField) {
        e.preventDefault();
        redo();
      } else if (k === 's' || k === 'ы') {
        e.preventDefault();
        void doSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (translator) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            Особняки безумия <small>переводчик сценариев</small>
          </div>
          <div className="title" />
          <button onClick={() => openTranslator(false)}>← В конструктор</button>
        </header>
        <main className="workspace">
          <TranslatorPage editorReady={started} />
        </main>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Особняки безумия <small>конструктор сценариев</small>
        </div>
        <div className="title">
          {started && (
            <>
              <b>{p.title || 'Без названия'}</b>
              {dirty ? ' · не скачан' : ''}
            </>
          )}
        </div>
        {started && (
          <>
            <button className="ghost" onClick={undo} disabled={!past.length} title="Отменить (Ctrl+Z)">
              ↶
            </button>
            <button className="ghost" onClick={redo} disabled={!future.length} title="Повторить (Ctrl+Shift+Z)">
              ↷
            </button>
          </>
        )}
        <button onClick={() => setChoosing(true)}>Новый</button>
        <button onClick={() => fileInput.current?.click()}>Открыть…</button>
        <ImagesButton />
        <button className="ghost" onClick={() => setPacks(true)} title="Какие коробки игры у вас есть">
          📦 Мои коробки
        </button>
        <button className="ghost" onClick={() => openTranslator(true)} title="Перевести любой сценарий Valkyrie">
          🌍
        </button>
        {started && (
          <button className="primary" onClick={doSave} title="Ctrl+S">
            Скачать .valkyrie
          </button>
        )}
        <input ref={fileInput} type="file" accept=".valkyrie,.zip" hidden onChange={(e) => (doOpen(e.target.files?.[0]), (e.target.value = ''))} />
      </header>
      {!started ? (
        <Welcome onNew={startNew} onOpen={() => fileInput.current?.click()} onDrop={doOpen} />
      ) : (
        <div className="builder">
          <nav className="steps-nav">
            <ChapterBar />
            {STEPS.map((s, i) => {
              const count = s.step === 'play' ? 0 : problems.filter((x) => x.step === s.step).length;
              return (
                <button key={s.step} className={step === s.step ? 'active' : ''} onClick={() => setStep(s.step)}>
                  <span className="step-num">{i + 1}</span>
                  <span>{s.icon}</span>
                  <span className="lbl">{s.label}</span>
                  {count > 0 && <span className="badge warn">{count}</span>}
                </button>
              );
            })}
            <div className="spacer" />
            {step === 'map' && <Problems compact />}
          </nav>
          <main className="workspace">
            {step === 'cover' && <CoverStep />}
            {step === 'prologue' && <PrologueStep />}
            {step === 'map' && <MapStep />}
            {step === 'threat' && <ThreatStep />}
            {step === 'endings' && <EndingsStep />}
            {step === 'play' && <PlayStep />}
          </main>
        </div>
      )}
      {started && <ImagesDialog auto={step === 'map'} />}
      {choosing && <StartDialog onPick={startNew} onClose={() => setChoosing(false)} />}
      {packs && <OwnedDialog onClose={() => setPacks(false)} />}
      {(notice || toast) && <div className="toast">{notice || toast}</div>}
    </div>
  );
}

function Welcome({ onNew, onOpen, onDrop }: { onNew: (from?: Project) => void; onOpen: () => void; onDrop: (f: File | undefined) => void }) {
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
        <h1>Создайте свою историю для «Особняков безумия»</h1>
        <div className="lead">Напишите вступление, разложите комнаты и решите, что случится в каждой. Связи, переменные и события Valkyrie конструктор расставит сам.</div>
        <StartChoices onPick={onNew} />
        <div className="actions">
          <button onClick={onOpen}>
            <b>📂 Открыть .valkyrie</b>
            <span>Продолжите свой сценарий. Можно перетащить файл сюда.</span>
          </button>
        </div>
        <div className="card">
          <b>Как это устроено</b>
          <ol className="hint" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
            <li>Положите на карту первую комнату и жетон «Сыщики начинают здесь».</li>
            <li>Нажмите на комнату и выберите, что в ней будет: обыск, дверь, персонаж, монстр.</li>
            <li>В окне «Что произойдёт?» выберите готовый ответ и напишите текст для игроков.</li>
            <li>Отметьте 🏆, после чего сыщики побеждают. Сыграйте пробную партию прямо здесь.</li>
            <li>Скачайте .valkyrie и положите в папку Valkyrie\Download.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
