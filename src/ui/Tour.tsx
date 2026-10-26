import { useState } from 'react';
import { TOUR_KEY } from '../tour';

const STEPS = [
  {
    icon: '📖',
    title: 'Добро пожаловать',
    text: 'Сценарий состоит из событий (окон с текстом и кнопками) и карты (комнаты, жетоны, двери). Сейчас покажу, где что находится. Это займёт минуту.',
  },
  {
    icon: '🕸',
    title: 'Сюжет',
    text: 'Каждый блок — одно событие. Кнопка «+ Далее» создаёт следующее. Кнопка «✨ Заготовки» добавляет готовые куски: жетон с находкой, запертую дверь, засаду, развилку, концовки.',
  },
  {
    icon: '🗺',
    title: 'Карта',
    text: 'Слева панель «Комнаты»: нажмите на комнату, и она появится на карте. Объект виден игрокам, только если какое-то событие его показывает. Редактор сам предложит событие.',
  },
  {
    icon: '▶',
    title: 'Проба',
    text: 'Вкладка «Проба» играет ваш сценарий как игрок: нажимаете кнопки и видите, что появляется на карте. Так сразу заметно, где сюжет обрывается.',
  },
  {
    icon: '✔',
    title: 'Проверка',
    text: 'Показывает, что сломается в игре, и исправляет большинство проблем одной кнопкой. Заглядывайте перед сохранением.',
  },
  {
    icon: '📁',
    title: 'Сохранение',
    text: 'Кнопка «В папку Valkyrie» записывает файл прямо в нужную папку, после выбора её один раз. Автосохранение в браузере тоже работает. Этот тур можно открыть снова кнопкой «?» сверху.',
  },
];

export function Tour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const close = () => {
    try {
      localStorage.setItem(TOUR_KEY, 'done');
    } catch {
      // remembering is optional
    }
    onClose();
  };
  return (
    <div className="modal-backdrop">
      <div className="modal tour" role="dialog" aria-label="Знакомство с редактором">
        <div className="tour-icon">{step.icon}</div>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        <div className="tour-dots">
          {STEPS.map((_, n) => (
            <span key={n} className={n === i ? 'on' : ''} />
          ))}
        </div>
        <div className="row">
          <button className="ghost" onClick={close}>
            Пропустить
          </button>
          <span className="auto" />
          {i > 0 && <button onClick={() => setI(i - 1)}>Назад</button>}
          <button className="primary" onClick={() => (i === STEPS.length - 1 ? close() : setI(i + 1))}>
            {i === STEPS.length - 1 ? 'Начать' : 'Дальше'}
          </button>
        </div>
      </div>
    </div>
  );
}
