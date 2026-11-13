// The threat over time: how strong Valkyrie's own mythos events are in each round, and the author's
// own events that come in a given round (a monster arrives, a room opens, time runs out).

import { useBuilder } from '../build/store';
import { PACE, takeId, type Mythos, type MythosCard, type MythosLevel, type Outcome, type Project, type SkillTest, type TimedEvent } from '../build/project';
import { Count, RoomChecks, TestPart } from './WhatHappens';
import { monsterTitle, roomTitle } from './names';

const LEVELS: { level: MythosLevel; icon: string; title: string; hint: string }[] = [
  { level: 0, icon: '🌫', title: 'Только атмосфера', hint: 'Скрипы, шорохи, тени. Ничем не вредят.' },
  { level: 1, icon: '🕯', title: 'Слабая', hint: 'Мелкие неприятности: немного ужаса, потерянный предмет.' },
  { level: 2, icon: '🔥', title: 'Средняя', hint: 'Ощутимый урон и ужас, пожар, тьма.' },
  { level: 3, icon: '💀', title: 'Сильная', hint: 'Опасные события, которые могут убить.' },
];

const set = (f: (p: Project) => Project, key?: string) => useBuilder.getState().change(f, key);

// level of the mythos events in a round
function levelAt(m: Mythos, round: number): MythosLevel {
  let level = m.level;
  for (const r of [...m.rises].sort((a, b) => a.round - b.round)) if (r.round <= round) level = r.level;
  return level;
}

type Preset = { icon: string; title: string; make: (p: Project) => Partial<TimedEvent> };
const PRESETS: Preset[] = [
  { icon: '🕯', title: 'Что-то происходит', make: () => ({ outcome: { text: 'Где-то наверху хлопает дверь. Дом будто вздыхает.', once: false } }) },
  {
    icon: '👹',
    title: 'Приходит монстр',
    make: (p) => {
      const m = p.pieces.find((x) => x.kind === 'monster' && x.when === 'event');
      return { outcome: { text: 'Из темноты доносится тяжёлое дыхание. Что-то пришло за вами.', spawn: m ? [m.id] : [], once: false } };
    },
  },
  { icon: '🚪', title: 'Открывается комната', make: () => ({ outcome: { text: 'С грохотом распахивается дверь, которой раньше здесь не было.', reveal: [], once: false } }) },
  { icon: '⌛', title: 'Время вышло: поражение', make: () => ({ round: 12, lose: true, every: false, outcome: { text: 'Часы бьют полночь. Слишком поздно: ритуал завершён без вас.', once: false } }) },
];

export function ThreatStep() {
  const p = useBuilder((s) => s.project);
  const timeline = p.timeline ?? [];
  const last = Math.max(12, ...timeline.map((t) => t.round + 2), ...(p.mythos?.rises ?? []).map((r) => r.round + 2));
  const lose = timeline.filter((t) => t.lose).map((t) => t.round);
  const end = lose.length ? Math.min(...lose) : 0;

  const add = (pr: Preset) =>
    set((q) => {
      const [next, id] = takeId(q, 'T');
      const used = (q.timeline ?? []).map((t) => t.round);
      const round = Math.max(3, ...used.map((r) => r + 2));
      const ev: TimedEvent = { id, round, every: false, outcome: { text: '', once: false }, ...pr.make(q) };
      return { ...next, timeline: [...(q.timeline ?? []), ev].sort((a, b) => a.round - b.round) };
    });

  return (
    <div className="page step-page">
      <h1>Угроза</h1>
      <div className="lead">
        Каждый раунд, после хода сыщиков, наступает фаза мифов: Valkyrie показывает событие, которое мешает сыщикам. Здесь вы решаете, насколько эти события сильны и что
        случится в определённые раунды. Так у игроков появляется ощущение, что время уходит.
      </div>

      <div className="rounds">
        {Array.from({ length: last }, (_, i) => i + 1).map((r) => {
          const lv = p.mythos ? levelAt(p.mythos, r) : undefined;
          const evs = timeline.filter((t) => t.round === r || (t.every && t.round < r));
          return (
            <div key={r} className={'round lv' + (lv ?? 'x') + (end && r > end ? ' after' : '')} title={lv !== undefined ? LEVELS[lv].title : ''}>
              <b>{r}</b>
              <span>{lv !== undefined ? LEVELS[lv].icon : '·'}</span>
              <span className="round-evs">
                {evs.map((t) => (t.lose ? '⌛' : t.outcome.spawn?.length ? '👹' : t.outcome.reveal?.length ? '🚪' : t.outcome.win ? '🏆' : '❗')).join('')}
              </span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <b>Сила событий мифов</b>
        {p.mythos ? (
          <MythosPart m={p.mythos} />
        ) : (
          <>
            <p className="hint">Сценарий сделан в другом редакторе: силу событий мифов он задаёт сам.</p>
            <button onClick={() => set((q) => ({ ...q, mythos: { level: 1, rises: [] } }))}>Настроить здесь</button>
          </>
        )}
      </div>

      {p.mythos && <OwnMythos m={p.mythos} />}

      <div className="card">
        <b>👥 Баланс по числу сыщиков</b>
        <label className="check">
          <input type="checkbox" checked={!!p.moreMonsters} onChange={(e) => set((q) => ({ ...q, moreMonsters: e.target.checked || undefined }))} /> Больше монстров, если сыщиков
          больше
        </label>
        <p className="hint">При 4–5 сыщиках каждый обычный монстр приходит вдвоём. Монстр, после победы над которым сыщики выигрывают, остаётся один.</p>
        {p.mythos && (
          <>
            <label className="check">
              <input type="checkbox" checked={!!p.mythos.adapt} onChange={(e) => set((q) => ({ ...q, mythos: { ...q.mythos!, adapt: e.target.checked || undefined } }))} /> Таймер угрозы
              подстраивается сам
            </label>
            <p className="hint">
              Раунды на полосе рассчитаны на 3–4 сыщиков. Одному сыщику угроза и события по раундам приходят на {PACE[1]} раунда позже, двоим на {PACE[2]}, пятерым на{' '}
              {-PACE[5]} раньше. Так у маленькой команды хватает времени.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <b>События по раундам</b>
        <p className="hint">Происходят сами, в фазу мифов нужного раунда. Например: на 3-м раунде просыпается монстр, на 6-м открывается подвал, на 10-м время выходит.</p>
        <div className="presets">
          {PRESETS.map((pr) => (
            <button key={pr.title} onClick={() => add(pr)}>
              <span>{pr.icon}</span> {pr.title}
            </button>
          ))}
        </div>
        {timeline.map((t) => (
          <TimedPart key={t.id} p={p} t={t} />
        ))}
      </div>
      <NextRow />
    </div>
  );
}

function MythosPart({ m }: { m: Mythos }) {
  const put = (patch: Partial<Mythos>) => set((q) => ({ ...q, mythos: { ...m, ...patch } }));
  const rises = m.rises;
  return (
    <>
      <div className="field">
        <span className="hint">С первого раунда</span>
        <LevelPick value={m.level} onChange={(level) => put({ level })} />
      </div>
      {rises.map((r, i) => (
        <div key={i} className="rise">
          <Count label="С раунда" value={r.round} min={2} max={40} onChange={(round) => put({ rises: rises.map((x, k) => (k === i ? { ...x, round } : x)) })} />
          <LevelPick value={r.level} onChange={(level) => put({ rises: rises.map((x, k) => (k === i ? { ...x, level } : x)) })} />
          <button className="auto ghost" title="Убрать" onClick={() => put({ rises: rises.filter((_, k) => k !== i) })}>
            ✕
          </button>
        </div>
      ))}
      <div className="row">
        <button
          className="auto"
          disabled={(rises.length ? rises[rises.length - 1].level : m.level) === 3}
          title="Угроза уже максимальная"
          onClick={() => {
            const top = rises.length ? rises[rises.length - 1] : { round: 1, level: m.level };
            put({ rises: [...rises, { round: top.round + 3, level: Math.min(3, top.level + 1) as MythosLevel }] });
          }}
        >
          📈 Угроза растёт с раунда…
        </button>
      </div>
      <div className="hint">Сами события берутся из Valkyrie: у неё большой набор событий мифов для каждой силы.</div>
    </>
  );
}

const CARD_PRESETS: { icon: string; title: string; make: () => Pick<MythosCard, 'outcome'> }[] = [
  { icon: '🕯', title: 'Атмосфера', make: () => ({ outcome: { text: 'Сквозняк проносится по комнатам, и лампы на миг гаснут. В темноте кто-то тихо смеётся.', once: false } }) },
  {
    icon: '😱',
    title: 'Проверка воли',
    make: () => ({
      outcome: {
        text: 'Из стен доносится шёпот. Он знает ваши имена. Сыщик, ближайший к лестнице, прислушивается.',
        once: false,
        test: { skill: 'will', need: 1, pass: 'Вы заставляете себя не слушать.', fail: 'Шёпот проникает в мысли.', harm: { kind: 'horror', amount: 1, who: 'one' } },
      },
    }),
  },
  {
    icon: '💥',
    title: 'Ловушка',
    make: () => ({
      outcome: {
        text: 'Над головой трещит потолок. Сыщик с наименьшим здоровьем видит, как на него падает люстра.',
        once: false,
        test: { skill: 'agility', need: 1, pass: 'Вы успеваете отскочить.', fail: 'Осколки режут руки и лицо.', harm: { kind: 'damage', amount: 2, who: 'one' } },
      },
    }),
  },
];

// The author's own mythos events, picked at random by Valkyrie in the mythos phase.
function OwnMythos({ m }: { m: Mythos }) {
  const own = m.own ?? [];
  const put = (patch: Partial<Mythos>) => set((q) => ({ ...q, mythos: { ...q.mythos!, ...patch } }));
  const add = (pr: (typeof CARD_PRESETS)[number]) =>
    set((q) => {
      const [next, id] = takeId(q, 'Y');
      const card: MythosCard = { id, from: 1, once: false, ...pr.make() };
      return { ...next, mythos: { ...q.mythos!, own: [...(q.mythos?.own ?? []), card] } };
    });
  return (
    <div className="card">
      <b>📜 Свои события мифов</b>
      <p className="hint">Каждый раунд в фазе мифов Valkyrie вытягивает случайное событие. Добавьте свои: с проверкой навыка, уроном или ужасом, они подходят к вашей истории.</p>
      <div className="presets">
        {CARD_PRESETS.map((pr) => (
          <button key={pr.title} onClick={() => add(pr)}>
            <span>{pr.icon}</span> {pr.title}
          </button>
        ))}
      </div>
      {own.length > 0 && (
        <div className="field">
          <label className="check">
            <input type="radio" checked={(m.mode ?? 'mix') === 'mix'} onChange={() => put({ mode: 'mix' })} /> Вместе с событиями игры: мои выпадают примерно каждый второй раунд
          </label>
          <label className="check">
            <input type="radio" checked={m.mode === 'only'} onChange={() => put({ mode: 'only' })} /> Только мои: события игры не выпадают
          </label>
        </div>
      )}
      {own.map((c) => (
        <CardPart key={c.id} c={c} />
      ))}
    </div>
  );
}

function CardPart({ c }: { c: MythosCard }) {
  const put = (patch: Partial<MythosCard>, key?: string) =>
    set((q) => ({ ...q, mythos: { ...q.mythos!, own: (q.mythos?.own ?? []).map((x) => (x.id === c.id ? { ...x, ...patch } : x)) } }), key);
  const putOut = (patch: Partial<Outcome>, key?: string) => put({ outcome: { ...c.outcome, ...patch } }, key);
  const o = c.outcome;
  const sample: SkillTest = { skill: 'will', need: 1, pass: 'Вы справляетесь.', fail: '', harm: { kind: 'horror', amount: 1, who: 'one' } };
  return (
    <div className="timed">
      <div className="timed-head">
        <Count label="С раунда" value={c.from} min={1} max={40} onChange={(from) => put({ from })} />
        <label className="check">
          <input type="checkbox" checked={c.once} onChange={(e) => put({ once: e.target.checked })} /> только один раз за игру
        </label>
        <button
          className="auto ghost danger"
          title="Убрать событие"
          onClick={() => set((q) => ({ ...q, mythos: { ...q.mythos!, own: (q.mythos?.own ?? []).filter((x) => x.id !== c.id) } }))}
        >
          🗑
        </button>
      </div>
      <label className="field">
        <span>Что прочтут игроки</span>
        <textarea rows={2} value={o.text} onChange={(e) => putOut({ text: e.target.value }, 'my' + c.id)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={!!o.test} onChange={(e) => putOut({ test: e.target.checked ? sample : undefined })} /> 🎲 Проверка навыка
      </label>
      {o.test && <TestPart id={c.id} test={o.test} set={putOut} note="При провале сыщик теряет то, что выбрано выше." />}
    </div>
  );
}

function LevelPick({ value, onChange }: { value: MythosLevel; onChange: (l: MythosLevel) => void }) {
  return (
    <div className="skill-row">
      {LEVELS.map((l) => (
        <button key={l.level} className={value === l.level ? 'on' : ''} title={l.hint} onClick={() => onChange(l.level)}>
          {l.icon} {l.title}
        </button>
      ))}
    </div>
  );
}

function TimedPart({ p, t }: { p: Project; t: TimedEvent }) {
  const put = (patch: Partial<TimedEvent>, key?: string) =>
    set((q) => ({ ...q, timeline: (q.timeline ?? []).map((x) => (x.id === t.id ? { ...x, ...patch } : x)).sort((a, b) => a.round - b.round) }), key);
  const putOut = (patch: Partial<Outcome>, key?: string) => put({ outcome: { ...t.outcome, ...patch } }, key);
  const waiting = p.pieces.filter((m) => m.kind === 'monster' && m.when === 'event');
  const o = t.outcome;
  return (
    <div className="timed">
      <div className="timed-head">
        <Count label={t.every ? 'Каждый раунд, начиная с' : 'Раунд'} value={t.round} min={1} max={40} onChange={(round) => put({ round })} />
        <label className="check">
          <input type="checkbox" checked={t.every} disabled={t.lose} onChange={(e) => put({ every: e.target.checked })} /> повторять каждый раунд
        </label>
        <button className="auto ghost danger" title="Убрать событие" onClick={() => set((q) => ({ ...q, timeline: (q.timeline ?? []).filter((x) => x.id !== t.id) }))}>
          🗑
        </button>
      </div>
      <label className="field">
        <span>Что прочтут игроки</span>
        <textarea rows={2} value={o.text} onChange={(e) => putOut({ text: e.target.value }, 'tl' + t.id)} />
      </label>
      {waiting.length > 0 && (
        <div className="field">
          <span className="hint">Появятся монстры (те, что ждут сигнала)</span>
          {waiting.map((m) => (
            <label key={m.id} className="check">
              <input type="checkbox" checked={(o.spawn ?? []).includes(m.id)} onChange={(e) => putOut({ spawn: e.target.checked ? [...(o.spawn ?? []), m.id] : (o.spawn ?? []).filter((q) => q !== m.id) })} />
              {monsterTitle(m.look)} — {roomTitle(p, m.room)}
            </label>
          ))}
        </div>
      )}
      {o.spawn && !waiting.length && <div className="hint">Чтобы позвать монстра, положите его на карту и выберите «Позже, по сигналу».</div>}
      {p.rooms.length > 1 && (
        <div className="field">
          <span className="hint">Откроются комнаты</span>
          <RoomChecks p={p} rooms={p.rooms.map((r) => r.id)} value={o.reveal ?? []} onChange={(reveal) => putOut({ reveal })} />
        </div>
      )}
      <label className="check">
        <input type="checkbox" checked={!!t.lose} onChange={(e) => put({ lose: e.target.checked || undefined, every: e.target.checked ? false : t.every })} /> ⌛ Время вышло: сыщики проигрывают
      </label>
      <label className="check">
        <input type="checkbox" checked={!!o.win} onChange={(e) => putOut({ win: e.target.checked || undefined })} /> 🏆 Сыщики продержались: победа
      </label>
    </div>
  );
}

function NextRow() {
  const setStep = useBuilder((s) => s.setStep);
  return (
    <div className="next-row">
      <button className="primary" onClick={() => setStep('endings')}>
        Дальше: финалы →
      </button>
    </div>
  );
}
