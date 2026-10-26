import { useState } from 'react';
import { wizardScenario, WIZARD_DEFAULTS, type WizardAnswers } from '../model/templates';
import { useStore } from '../store';
import { TILE_OPTIONS } from './options';
import { Field, Picker } from './widgets';

const STEPS = ['Название', 'История', 'Игроки', 'Первая комната', 'Концовки'] as const;

// Five short questions that end in a working skeleton: intro, goal, win and defeat are already linked.
export function Wizard({ onClose, onEmpty }: { onClose: () => void; onEmpty: () => void }) {
  const lang = useStore((st) => st.lang);
  const startWith = useStore((st) => st.startWith);
  const flash = useStore((st) => st.flash);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<WizardAnswers>(WIZARD_DEFAULTS);
  const set = (patch: Partial<WizardAnswers>) => setA((x) => ({ ...x, ...patch }));
  const last = step === STEPS.length - 1;

  const finish = () => {
    const { scenario, notes } = wizardScenario(a, lang);
    startWith(scenario, notes);
    flash('Сценарий создан. Откройте любое событие и замените тексты на свои.');
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal wizard" role="dialog" aria-label="Новый сценарий">
        <div className="steps">
          {STEPS.map((t, i) => (
            <span key={t} className={i === step ? 'on' : i < step ? 'done' : ''}>
              {i + 1}. {t}
            </span>
          ))}
        </div>
        {step === 0 && (
          <>
            <h2>Как называется ваш сценарий?</h2>
            <p className="hint">Название увидят игроки в списке сценариев. Его можно поменять позже.</p>
            <Field label="Название">
              <input autoFocus value={a.title} placeholder="Например: Тайна старого маяка" onChange={(e) => set({ title: e.target.value })} />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <h2>О чём эта история?</h2>
            <Field label="Вступление" hint="Первое, что прочитают игроки: где они, что случилось.">
              <textarea rows={4} autoFocus value={a.intro} placeholder="Сыщики приехали в рыбацкий посёлок. Маяк не светит уже три ночи…" onChange={(e) => set({ intro: e.target.value })} />
            </Field>
            <Field label="Главная цель" hint="Что игрокам нужно сделать, чтобы победить.">
              <input value={a.goal} placeholder="Найти пропавшего смотрителя и зажечь маяк" onChange={(e) => set({ goal: e.target.value })} />
            </Field>
          </>
        )}
        {step === 2 && (
          <>
            <h2>Сколько сыщиков может играть?</h2>
            <div className="row">
              <Field label="От">
                <input type="number" min={1} max={5} value={a.minhero} onChange={(e) => set({ minhero: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
              </Field>
              <Field label="До">
                <input type="number" min={1} max={5} value={a.maxhero} onChange={(e) => set({ maxhero: Math.min(5, Math.max(a.minhero, Number(e.target.value) || 5)) })} />
              </Field>
            </div>
            <p className="hint">В «Особняках безумия» играют от одного до пяти сыщиков.</p>
          </>
        )}
        {step === 3 && (
          <>
            <h2>С какой комнаты начинается игра?</h2>
            <p className="hint">Эта комната появится на карте сразу. Остальные вы добавите позже.</p>
            <Picker options={TILE_OPTIONS} value={a.tile} placeholder="Название комнаты, например Hall" onChange={(v) => set({ tile: v })} />
          </>
        )}
        {step === 4 && (
          <>
            <h2>Чем всё может закончиться?</h2>
            <Field label="Победа">
              <textarea rows={3} value={a.winText} onChange={(e) => set({ winText: e.target.value })} />
            </Field>
            <Field label="Поражение" hint="Показывается, когда все сыщики выбыли.">
              <textarea rows={3} value={a.loseText} onChange={(e) => set({ loseText: e.target.value })} />
            </Field>
          </>
        )}
        <div className="row" style={{ marginTop: 16 }}>
          {step > 0 && <button onClick={() => setStep(step - 1)}>Назад</button>}
          <button className="primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Создать сценарий' : 'Дальше'}
          </button>
          <span className="auto" />
          <button className="ghost" onClick={onEmpty} title="Только стартовое событие, без вопросов">
            Пропустить: пустой сценарий
          </button>
          <button className="ghost" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
