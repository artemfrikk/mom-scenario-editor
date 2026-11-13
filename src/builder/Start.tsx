// How a new scenario begins: an empty one, or a ready example to change.

import { EXAMPLES } from '../build/examples';
import type { Project } from '../build/project';
import { Dialog } from './WhatHappens';

export function StartChoices({ onPick }: { onPick: (from?: Project) => void }) {
  return (
    <div className="actions start-choices">
      <button onClick={() => onPick()}>
        <b>✨ Пустой сценарий</b>
        <span>Шесть шагов: обложка, вступление, карта, угроза, финалы, пробная игра.</span>
      </button>
      {EXAMPLES.map((x) => (
        <button key={x.id} onClick={() => onPick(x.make())}>
          <b>
            {x.icon} Пример: {x.title}
          </b>
          <span>{x.text}</span>
        </button>
      ))}
    </div>
  );
}

export function StartDialog({ onPick, onClose }: { onPick: (from?: Project) => void; onClose: () => void }) {
  return (
    <Dialog title="С чего начать?" icon="✨" onClose={onClose}>
      <p className="hint">Пример можно сразу сыграть на шаге «Сыграть» или скачать, а потом переделать под себя.</p>
      <div className="welcome">
        <StartChoices onPick={onPick} />
      </div>
    </Dialog>
  );
}
