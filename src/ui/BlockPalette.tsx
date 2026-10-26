import { nextStep } from '../model/builder';
import { TEMPLATES } from '../model/templates';
import { isEventLike } from '../format/scenario';
import { useStore } from '../store';
import { ActionMenu } from './ActionMenu';

export const BLOCK_MIME = 'application/x-mse-block';

// The constructor's shelf: ready blocks to click or drag onto the story, and a hint about the next step.
export function BlockPalette({ onPlace, onClose }: { onPlace: (id: string) => void; onClose: () => void }) {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const selected = useStore((st) => st.selected);
  const select = useStore((st) => st.select);
  const step = nextStep(s, lang, selected);
  const chosen = s.components.find((c) => c.name === selected && isEventLike(c.type) && c.type !== 'Spawn' && c.data.display !== 'false');

  return (
    <aside className="block-palette" aria-label="Конструктор">
      <div className="bp-head">
        <b>🧩 Конструктор</b>
        <button className="small ghost" onClick={onClose} title="Скрыть панель">
          ✕
        </button>
      </div>
      <div className="bp-step">
        {step.text}
        {step.select && step.select !== selected && (
          <button className="small" onClick={() => select(step.select!)}>
            Показать
          </button>
        )}
      </div>
      <div className="bp-title">Добавить в сюжет</div>
      <div className="bp-list">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            className="bp-block"
            draggable
            title={t.what}
            onClick={() => onPlace(t.id)}
            onDragStart={(e) => {
              e.dataTransfer.setData(BLOCK_MIME, t.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          >
            <span className="ico">{t.icon}</span>
            <span>{t.title}</span>
          </button>
        ))}
      </div>
      <div className="hint">Нажмите на блок или перетащите его на схему. Он сам подключится к первой свободной кнопке.</div>
      {chosen && (
        <>
          <div className="bp-title">К событию «{chosen.name}»</div>
          <ActionMenu event={chosen.name} />
        </>
      )}
    </aside>
  );
}
