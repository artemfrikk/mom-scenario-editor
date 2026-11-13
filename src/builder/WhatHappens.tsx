// The "What happens?" window: opens when a piece is put on the map or tapped.
// The author picks a ready answer and writes the words; the constructor does the rest.

import { useMemo, useRef, useState } from 'react';
import catalog from '../content/catalog.json';
import { useImages } from '../images';
import type { Sizes } from '../build/board';
import { roomBehindDoor } from '../build/edit';
import { useOwned } from '../build/owned';
import { deletePiece, pieceOf, updateOutcome, updatePiece, type Harm, type HarmKind, type Choice, type Lock, type Outcome, type Piece, type Project, type PuzzleKind, type PuzzleSpec, type Skill, type SkillTest } from '../build/project';
import { assetUrl } from './assetUrl';
import { harmText } from '../build/compile';
import { useBuilder } from '../build/store';
import { itemTitle, kindInfo, tilesFree, monsterTitle, NPC_TOKENS, packOf, roomTitle, tokenTitle } from './names';
import { Picker, type Option } from '../ui/widgets';
import { labelOf } from '../ui/options';

type Preset = { id: string; icon: string; title: string; apply: (o: Outcome) => Partial<Outcome> };

const clear: Partial<Outcome> = { item: undefined, clues: undefined, win: undefined };

// Ready answers for each kind of piece; each only fills the fields, everything stays editable.
const PRESETS: Partial<Record<Piece['kind'], Preset[]>> = {
  search: [
    { id: 'item', icon: '🗝', title: 'Находят предмет', apply: (o) => ({ ...clear, item: o.item || 'ItemCommonKnife', text: o.text || 'Среди старых вещей вы находите кое-что полезное.' }) },
    { id: 'key', icon: '🗝', title: 'Находят ключ', apply: (o) => ({ ...clear, item: 'ItemUniqueBrassKey', text: o.text || 'Под ворохом бумаг лежит тяжёлый латунный ключ.' }) },
    { id: 'clue', icon: '❓', title: 'Находят улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || 'Обрывок письма. Кто-то здесь явно что-то искал до вас.' }) },
    { id: 'nothing', icon: '🕸', title: 'Ничего', apply: (o) => ({ ...clear, text: o.text || 'Пыль, паутина и ничего больше.' }) },
    { id: 'danger', icon: '⚠', title: 'Опасность', apply: (o) => ({ ...clear, text: o.text || 'Из ящика выскальзывает что-то холодное и склизкое. Каждый сыщик здесь получает 1 ужас.' }) },
    { id: 'win', icon: '🏆', title: 'Главная находка: победа', apply: (o) => ({ ...clear, win: true, text: o.text || 'Вот оно! То, ради чего вы пришли.' }) },
  ],
  interact: [
    { id: 'text', icon: '📜', title: 'Записка или надпись', apply: (o) => ({ ...clear, text: o.text || 'На стене выцарапано: «Не спускайтесь в подвал».' }) },
    { id: 'key', icon: '🗝', title: 'Тайник с ключом', apply: (o) => ({ ...clear, item: 'ItemUniqueBrassKey', text: o.text || 'В тайнике за панелью висит ключ.' }) },
    { id: 'clue', icon: '❓', title: 'Даёт улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || 'Вы замечаете то, что упустили остальные.' }) },
    { id: 'monster', icon: '👹', title: 'Будит монстра', apply: (o) => ({ ...clear, text: o.text || 'Где-то в доме раздаётся вой.' }) },
    { id: 'win', icon: '🏆', title: 'Завершает ритуал: победа', apply: (o) => ({ ...clear, win: true, text: o.text || 'Последний знак начерчен. Тьма отступает.' }) },
  ],
  sight: [
    { id: 'text', icon: '👁', title: 'Что-то странное', apply: (o) => ({ ...clear, text: o.text || 'В зеркале мелькает чужое отражение.' }) },
    { id: 'clue', icon: '❓', title: 'Даёт улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || 'Следы ведут к камину.' }) },
  ],
  npc: [
    { id: 'talk', icon: '💬', title: 'Рассказывает', apply: (o) => ({ ...clear, text: o.text || '«Хозяин не выходил из кабинета три дня», — шепчет он.' }) },
    { id: 'key', icon: '🗝', title: 'Отдаёт ключ', apply: (o) => ({ ...clear, item: 'ItemUniqueBrassKey', text: o.text || '«Это ключ от подвала. Будьте осторожны».' }) },
    { id: 'give', icon: '🎁', title: 'Отдаёт предмет', apply: (o) => ({ ...clear, item: o.item || 'ItemCommonKnife', text: o.text || '«Возьмите. Вам это нужнее».' }) },
    { id: 'clue', icon: '❓', title: 'Даёт улику', apply: (o) => ({ ...clear, clues: 1, text: o.text || '«Я видел, кто приходил ночью».' }) },
    { id: 'win', icon: '🏆', title: 'Спасён: победа', apply: (o) => ({ ...clear, win: true, text: o.text || 'Вы выводите его из проклятого дома.' }) },
  ],
};

const ITEMS: Option[] = catalog.items.map((i) => ({
  value: i.id,
  get label() {
    return labelOf(i.name, i.nameKey);
  },
  note: i.traits.join(', '),
  image: i.image,
}));

export function WhatHappens({ id, sizes, onClose }: { id: string; sizes: Sizes; onClose: () => void }) {
  const p = useBuilder((s) => s.project);
  const change = useBuilder((s) => s.change);
  const select = useBuilder((s) => s.select);
  useImages((s) => s.names); // names in Russian arrive later
  const x = pieceOf(p, id);
  if (!x) return null;
  const info = kindInfo(x.kind);
  const o = x.outcome;
  const set = (patch: Partial<Outcome>, key?: string) => change((q) => updateOutcome(q, id, patch), key);
  const setPiece = (patch: Partial<Piece>, key?: string) => change((q) => updatePiece(q, id, patch), key);
  const presets = PRESETS[x.kind] ?? [];

  if (x.kind === 'start' || x.kind === 'mark') {
    return (
      <Dialog title={info.title} icon={info.icon} onClose={onClose} onDelete={() => (change((q) => deletePiece(q, id)), onClose())}>
        <p className="hint">{x.kind === 'start' ? 'Здесь сыщики ставят свои фигурки в начале игры. Эта комната видна сразу.' : 'Метка просто лежит на карте и ничего не делает. Её видно вместе с комнатой.'}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={x.kind === 'monster' ? `Монстр: ${monsterTitle(x.look)}` : `Что произойдёт? · ${info.title}`}
      icon={info.icon}
      onClose={onClose}
      onDelete={() => (change((q) => deletePiece(q, id)), onClose())}
    >
      <div className="wh">
        <div className="wh-form">
          <div className="hint">Комната: {roomTitle(p, x.room)}</div>

          {x.kind === 'npc' && (
            <label className="field">
              <span>Кто это</span>
              <div className="row">
                <input value={x.title} placeholder="Дворецкий, вдова, полицейский…" onChange={(e) => setPiece({ title: e.target.value }, 'title' + id)} />
                <Picker options={NPC_TOKENS.map((t) => ({ value: t, label: tokenTitle(t), image: catalog.tokens.find((k) => k.id === t)?.image }))} value={x.look} onChange={(v) => setPiece({ look: v })} />
              </div>
            </label>
          )}
          {(x.kind === 'search' || x.kind === 'interact' || x.kind === 'sight') && (
            <label className="field">
              <span>Что это (видите только вы)</span>
              <input value={x.title} placeholder="Письменный стол, камин, сундук…" onChange={(e) => setPiece({ title: e.target.value }, 'title' + id)} />
            </label>
          )}

          {x.kind === 'monster' && <MonsterPart p={p} x={x} setPiece={setPiece} />}

          {x.kind === 'explore' && <DoorPart p={p} x={x} sizes={sizes} set={set} onNewRoom={(r) => select({ kind: 'room', id: r })} />}

          {presets.length > 0 && (
            <div className="presets">
              {presets.map((pr) => (
                <button key={pr.id} onClick={() => set(pr.apply(o))}>
                  <span>{pr.icon}</span> {pr.title}
                </button>
              ))}
            </div>
          )}

          <label className="field">
            <span>
              {x.kind === 'monster'
                ? 'Что игроки прочтут, когда монстр побеждён'
                : o.test
                  ? 'Что игроки прочтут перед проверкой'
                  : o.puzzle
                    ? 'Что игроки прочтут перед головоломкой'
                    : o.choices?.length
                      ? 'Вопрос или ситуация, на которую игроки отвечают'
                  : x.kind === 'explore'
                    ? 'Что игроки прочтут, открыв дверь'
                    : 'Что игроки прочтут'}
            </span>
            <textarea rows={5} value={o.text} placeholder={x.kind === 'explore' ? 'Дверь со скрипом поддаётся…' : 'Напишите текст для игроков'} onChange={(e) => set({ text: e.target.value }, 'text' + id)} />
          </label>

          {x.kind !== 'monster' && <ChallengePart p={p} x={x} set={set} />}
          {x.kind !== 'monster' && <LockPart p={p} x={x} set={set} />}

          {!o.choices?.length && <Gifts p={p} o={o} set={set} here={x.room} rooms={x.kind !== 'explore'} self={id} />}
          {x.kind !== 'monster' && (
            <label className="check">
              <input type="checkbox" checked={o.once} onChange={(e) => set({ once: e.target.checked })} /> Жетон исчезает после использования
            </label>
          )}
        </div>
        <Preview p={p} x={x} />
      </div>
    </Dialog>
  );
}

// What the investigators get: an item, clues, rooms that open, monsters that come, victory.
function Gifts({ p, o, set, here, rooms, self }: { p: Project; o: Outcome; set: (o: Partial<Outcome>, key?: string) => void; here: string; rooms: boolean; self: string }) {
  const [more, setMore] = useState(false);
  const owned = useOwned((s) => s.packs);
  const items = ITEMS.filter((i) => owned.includes(packOf(i.value) ?? 'MoMBase'));
  const others = p.rooms.filter((r) => r.id !== here);
  const waiting = p.pieces.filter((m) => m.kind === 'monster' && m.when === 'event' && m.id !== self);
  return (
    <>
      {o.item !== undefined && (
        <label className="field">
          <span>Предмет, который получат сыщики</span>
          <div className="row">
            <Picker options={items} value={o.item} onChange={(v) => set({ item: v })} />
            <button className="auto ghost" onClick={() => set({ item: undefined })} title="Без предмета">
              ✕
            </button>
          </div>
        </label>
      )}
      {!!o.clues && (
        <label className="field">
          <span>Сколько улик</span>
          <div className="row">
            <input type="number" min={1} max={5} value={o.clues} onChange={(e) => set({ clues: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
            <button className="auto ghost" onClick={() => set({ clues: undefined })} title="Без улик">
              ✕
            </button>
          </div>
        </label>
      )}
      <button className="link" onClick={() => setMore(!more)}>
        {more ? '▾' : '▸'} Ещё: предмет, улика, открыть комнату, позвать монстра, победа
      </button>
      {more && (
        <div className="more">
          {o.item === undefined && <button onClick={() => set({ item: 'ItemCommonKnife' })}>🗝 Дать предмет</button>}
          {!o.clues && <button onClick={() => set({ clues: 1 })}>❓ Дать улику</button>}
          {rooms && others.length > 0 && (
            <div className="field">
              <span className="hint">Откроются комнаты</span>
              <RoomChecks p={p} rooms={others.map((r) => r.id)} value={o.reveal ?? []} onChange={(reveal) => set({ reveal })} />
            </div>
          )}
          {waiting.length > 0 && (
            <div className="field">
              <span className="hint">Появятся монстры (те, что ждут сигнала)</span>
              {waiting.map((m) => (
                <label key={m.id} className="check">
                  <input
                    type="checkbox"
                    checked={(o.spawn ?? []).includes(m.id)}
                    onChange={(e) => set({ spawn: e.target.checked ? [...(o.spawn ?? []), m.id] : (o.spawn ?? []).filter((q) => q !== m.id) })}
                  />
                  {monsterTitle(m.look)} — {roomTitle(p, m.room)}
                </label>
              ))}
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={!!o.win} onChange={(e) => set({ win: e.target.checked || undefined })} /> 🏆 После этого сыщики побеждают
          </label>
        </div>
      )}
    </>
  );
}

const SAMPLE_CHOICES: Choice[] = [
  { id: 'c1', label: 'Расспросить', outcome: { text: '«Хозяин заперся в кабинете три дня назад. С тех пор оттуда слышен шёпот».', once: false } },
  { id: 'c2', label: 'Пригрозить', outcome: { text: 'Он бледнеет и молча указывает на лестницу в подвал.', once: false } },
];

// A conversation: the players pick an answer, each answer leads to its own result.
function ChoicePart({ p, x, choices, set }: { p: Project; x: Piece; choices: Choice[]; set: (o: Partial<Outcome>, key?: string) => void }) {
  const put = (id: string, patch: Partial<Choice>, key?: string) => set({ choices: choices.map((c) => (c.id === id ? { ...c, ...patch } : c)) }, key);
  const nextId = () => 'c' + (Math.max(0, ...choices.map((c) => Number(c.id.slice(1)) || 0)) + 1);
  return (
    <div className="challenge">
      <span className="hint">Ответы игроков (кнопки в окне). Каждый ведёт к своему итогу, и игра запоминает выбор: его можно отметить в замке другого жетона.</span>
      {choices.map((c, i) => (
        <div key={c.id} className="answer">
          <div className="row">
            <span className="answer-num">{i + 1}</span>
            <input value={c.label} placeholder="Надпись на кнопке" onChange={(e) => put(c.id, { label: e.target.value }, 'clabel' + x.id + c.id)} />
            <button className="auto ghost danger" title="Убрать ответ" disabled={choices.length <= 2} onClick={() => set({ choices: choices.filter((q) => q.id !== c.id) })}>
              🗑
            </button>
          </div>
          <textarea rows={2} value={c.outcome.text} placeholder="Что прочтут, выбрав этот ответ" onChange={(e) => put(c.id, { outcome: { ...c.outcome, text: e.target.value } }, 'ctext' + x.id + c.id)} />
          <Gifts p={p} o={c.outcome} set={(patch, key) => put(c.id, { outcome: { ...c.outcome, ...patch } }, key)} here={x.room} rooms self={x.id} />
        </div>
      ))}
      {choices.length < 4 && (
        <div className="row">
          <button className="auto" onClick={() => set({ choices: [...choices, { id: nextId(), label: '', outcome: { text: '', once: false } }] })}>
            ➕ Ещё ответ
          </button>
        </div>
      )}
    </div>
  );
}

const SKILLS: { id: Skill; icon: string; label: string }[] = [
  { id: 'strength', icon: '💪', label: 'Сила' },
  { id: 'agility', icon: '🏃', label: 'Ловкость' },
  { id: 'observation', icon: '👁', label: 'Наблюдательность' },
  { id: 'lore', icon: '📚', label: 'Знания' },
  { id: 'influence', icon: '🗣', label: 'Влияние' },
  { id: 'will', icon: '🧠', label: 'Воля' },
];

const HARMS: { kind: HarmKind; label: string }[] = [
  { kind: 'damage', label: '🩸 Урон' },
  { kind: 'horror', label: '😱 Ужас' },
];

const PUZZLES: { kind: PuzzleKind; icon: string; label: string; hint: string; level: [string, number, number, number]; alt?: [string, number, number, number] }[] = [
  { kind: 'slide', icon: '🧱', label: 'Пятнашки (засов)', hint: 'Сдвигайте бруски, чтобы вытащить выделенный наружу.', level: ['Сложность', 1, 30, 4] },
  { kind: 'code', icon: '🔢', label: 'Кодовый замок', hint: 'Подберите комбинацию символов: игра подсказывает, сколько угадано.', level: ['Символов в коде', 2, 6, 4], alt: ['Разных символов', 2, 6, 3] },
  { kind: 'image', icon: '🖼', label: 'Картинка', hint: 'Картинка разрезана на части, их надо поменять местами.', level: ['Столбцов', 2, 6, 4], alt: ['Рядов', 2, 6, 3] },
  { kind: 'tower', icon: '🗼', label: 'Башня', hint: 'Перенесите кольца на одну башню, большое кольцо нельзя класть на маленькое.', level: ['Сложность', 1, 20, 4] },
];

type Mode = 'none' | 'test' | 'puzzle' | 'choice';

// What stands between the investigators and the result: nothing, a skill test or a puzzle.
function ChallengePart({ p, x, set }: { p: Project; x: Piece; set: (o: Partial<Outcome>, key?: string) => void }) {
  const o = x.outcome;
  const id = x.id;
  const mode: Mode = o.choices?.length ? 'choice' : o.puzzle ? 'puzzle' : o.test ? 'test' : 'none';
  const choose = (m: Mode) => {
    if (m === 'none') set({ test: undefined, puzzle: undefined, choices: undefined });
    if (m === 'choice' && !o.choices?.length)
      set({ test: undefined, puzzle: undefined, choices: SAMPLE_CHOICES, text: o.text || '«Кто вы такие? Что вам здесь нужно?» — спрашивает он.' });
    if (m === 'test' && !o.test) set({ puzzle: undefined, choices: undefined, test: { skill: 'observation', need: 1, pass: 'Получилось!', fail: 'Ничего не выходит. Можно попробовать ещё раз.' } });
    if (m === 'puzzle' && !o.puzzle) set({ test: undefined, choices: undefined, puzzle: { kind: 'code', skill: 'lore', level: 4, alt: 3, pass: 'Замок щёлкает и открывается.' } });
  };
  return (
    <div className="field wh-test">
      <span>Чтобы получить результат</span>
      <div className="skill-row">
        <button className={mode === 'none' ? 'on' : ''} onClick={() => choose('none')}>
          Ничего не нужно
        </button>
        <button className={mode === 'test' ? 'on' : ''} onClick={() => choose('test')}>
          🎲 Проверка навыка
        </button>
        <button className={mode === 'puzzle' ? 'on' : ''} onClick={() => choose('puzzle')}>
          🧩 Головоломка
        </button>
        <button className={mode === 'choice' ? 'on' : ''} onClick={() => choose('choice')}>
          💬 Выбор ответа
        </button>
      </div>
      {o.choices?.length ? <ChoicePart p={p} x={x} choices={o.choices} set={set} /> : null}
      {o.test && <TestPart id={id} test={o.test} set={set} />}
      {o.puzzle && <PuzzlePart puzzle={o.puzzle} set={set} id={id} />}
    </div>
  );
}

function SkillPick({ value, onChange }: { value: Skill; onChange: (s: Skill) => void }) {
  return (
    <div className="skill-row">
      {SKILLS.map((k) => (
        <button key={k.id} className={value === k.id ? 'on' : ''} onClick={() => onChange(k.id)}>
          {k.icon} {k.label}
        </button>
      ))}
    </div>
  );
}

export function Count({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="row skill-need">
      <span className="hint">{label}</span>
      <button className="small" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>
        −
      </button>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value)) || min)))} />
      <button className="small" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        +
      </button>
    </label>
  );
}

// The skill test: players roll the dice for the chosen skill and press "Успех" or "Провал".
function TestPart({ id, test, set }: { id: string; test: SkillTest; set: (o: Partial<Outcome>, key?: string) => void }) {
  const put = (patch: Partial<SkillTest>, key?: string) => set({ test: { ...test, ...patch } }, key);
  const harm = test.harm;
  const putHarm = (patch: Partial<Harm>) => put({ harm: { kind: 'damage', amount: 1, who: 'one', ...harm, ...patch } });
  return (
    <div className="challenge">
      <span className="hint">Какой навык проверяют</span>
      <SkillPick value={test.skill} onChange={(skill) => put({ skill })} />
      <Count label="Нужно успехов:" value={test.need} min={1} max={20} onChange={(need) => put({ need })} />
      <label className="field">
        <span>✅ Если успех</span>
        <textarea rows={2} value={test.pass} onChange={(e) => put({ pass: e.target.value }, 'pass' + id)} />
      </label>
      <label className="field">
        <span>❌ Если провал</span>
        <textarea rows={2} value={test.fail} onChange={(e) => put({ fail: e.target.value }, 'fail' + id)} />
      </label>
      <div className="field">
        <span className="hint">Что теряют при провале</span>
        <div className="skill-row">
          <button className={!harm ? 'on' : ''} onClick={() => put({ harm: undefined })}>
            Ничего
          </button>
          {HARMS.map((h) => (
            <button key={h.kind} className={harm?.kind === h.kind ? 'on' : ''} onClick={() => putHarm({ kind: h.kind })}>
              {h.label}
            </button>
          ))}
        </div>
        {harm && (
          <>
            <Count label="Сколько:" value={harm.amount} min={1} max={10} onChange={(amount) => putHarm({ amount })} />
            <label className="check">
              <input type="radio" checked={harm.who === 'one'} onChange={() => putHarm({ who: 'one' })} /> Только сыщик, который проходил проверку
            </label>
            <label className="check">
              <input type="radio" checked={harm.who === 'all'} onChange={() => putHarm({ who: 'all' })} /> Каждый сыщик в этой комнате
            </label>
          </>
        )}
      </div>
      <div className="hint">Награду из этого окна сыщики получат только при успехе. При провале жетон остаётся, можно попробовать снова.</div>
    </div>
  );
}

// One of Valkyrie's puzzle windows; it can be put aside and finished later.
function PuzzlePart({ id, puzzle, set }: { id: string; puzzle: PuzzleSpec; set: (o: Partial<Outcome>, key?: string) => void }) {
  const put = (patch: Partial<PuzzleSpec>, key?: string) => set({ puzzle: { ...puzzle, ...patch } }, key);
  const info = PUZZLES.find((k) => k.kind === puzzle.kind)!;
  const assets = useBuilder((s) => s.assets);
  const img = puzzle.image ? assetUrl(assets, puzzle.image) : undefined;
  return (
    <div className="challenge">
      <span className="hint">Какая головоломка</span>
      <div className="skill-row">
        {PUZZLES.map((k) => (
          <button
            key={k.kind}
            className={puzzle.kind === k.kind ? 'on' : ''}
            onClick={() => put({ kind: k.kind, level: k.level[3], alt: k.alt?.[3] ?? puzzle.alt })}
          >
            {k.icon} {k.label}
          </button>
        ))}
      </div>
      <div className="hint">{info.hint}</div>
      <Count label={info.level[0] + ':'} value={puzzle.level} min={info.level[1]} max={info.level[2]} onChange={(level) => put({ level })} />
      {info.alt && <Count label={info.alt[0] + ':'} value={puzzle.alt} min={info.alt[1]} max={info.alt[2]} onChange={(alt) => put({ alt })} />}
      {puzzle.kind === 'image' && (
        <div className="field">
          <span className="hint">Картинка для головоломки</span>
          {img && <img className="puzzle-pic" src={img} alt="" />}
          <ImageButton label={img ? 'Заменить картинку' : 'Выбрать картинку'} onFile={(name) => put({ image: name })} />
        </div>
      )}
      <span className="hint">Навык, которым сыщик может помочь себе</span>
      <SkillPick value={puzzle.skill} onChange={(skill) => put({ skill })} />
      <label className="field">
        <span>✅ Когда решили</span>
        <textarea rows={2} value={puzzle.pass} onChange={(e) => put({ pass: e.target.value }, 'ppass' + id)} />
      </label>
      <div className="hint">Награду из этого окна сыщики получат, когда решат головоломку. Её можно отложить и вернуться позже.</div>
    </div>
  );
}

function ImageButton({ label, onFile }: { label: string; onFile: (name: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const addAsset = useBuilder((s) => s.addAsset);
  return (
    <>
      <button onClick={() => ref.current?.click()}>{label}</button>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(addAsset(f.name, new Uint8Array(await f.arrayBuffer())));
        }}
      />
    </>
  );
}

// Closed until something else happened: a key found, a test passed, a monster defeated.
function LockPart({ p, x, set }: { p: Project; x: Piece; set: (o: Partial<Outcome>, key?: string) => void }) {
  const lock = x.outcome.lock;
  const others = p.pieces.filter((q) => q.id !== x.id && q.kind !== 'start' && q.kind !== 'mark');
  const put = (patch: Partial<Lock>, key?: string) => set({ lock: { needs: [], text: 'Заперто. Нужен ключ.', ...lock, ...patch } }, key);
  return (
    <div className="field wh-test">
      <label className="check">
        <input type="checkbox" checked={!!lock} onChange={(e) => (e.target.checked ? put({}) : set({ lock: undefined }))} /> 🔒 Заперто, пока сыщики не сделают другое
      </label>
      {lock && (
        <div className="challenge">
          {others.length ? (
            <>
              <span className="hint">Откроется, когда будет всё отмеченное (найден ключ, пройдена проверка, побеждён монстр)</span>
              {others.flatMap((q) => [
                { key: q.id, label: pieceLabel(p, q), sub: false },
                ...(q.outcome.choices ?? []).filter((c) => c.label.trim()).map((c) => ({ key: `${q.id}.${c.id}`, label: `↳ выбран ответ «${c.label.trim()}»`, sub: true })),
              ]).map((n) => (
                <label key={n.key} className={'check' + (n.sub ? ' sub' : '')}>
                  <input type="checkbox" checked={lock.needs.includes(n.key)} onChange={(e) => put({ needs: e.target.checked ? [...lock.needs, n.key] : lock.needs.filter((k) => k !== n.key) })} />
                  {n.label}
                </label>
              ))}
            </>
          ) : (
            <div className="hint">Сначала положите на карту то, что открывает замок: например, обыск, где лежит ключ.</div>
          )}
          <label className="field">
            <span>Что прочтут, пока заперто</span>
            <textarea rows={2} value={lock.text} onChange={(e) => put({ text: e.target.value }, 'lock' + x.id)} />
          </label>
        </div>
      )}
    </div>
  );
}

function pieceLabel(p: Project, q: Piece): string {
  const info = kindInfo(q.kind);
  const name = q.kind === 'monster' ? `${monsterTitle(q.look)} побеждён` : q.title || info.title;
  const gift = q.outcome.item ? ` → ${itemTitle(q.outcome.item)}` : q.outcome.test ? ' (после проверки)' : q.outcome.puzzle ? ' (после головоломки)' : q.outcome.choices?.length ? ' (любой ответ)' : '';
  return `${info.icon} ${name}${gift} · ${roomTitle(p, q.room)}`;
}

function MonsterPart({ p, x, setPiece }: { p: Project; x: Piece; setPiece: (patch: Partial<Piece>, key?: string) => void }) {
  const owned = useOwned((s) => s.packs);
  const options: Option[] = catalog.monsters
    .filter((m) => owned.includes(m.pack))
    .map((m) => ({
      value: m.id,
      get label() {
        return labelOf(m.name, m.nameKey);
      },
      image: m.image,
    }));
  const callers = [
    ...p.pieces.filter((q) => (q.outcome.spawn ?? []).includes(x.id)).map((c) => c.title || kindInfo(c.kind).title),
    ...(p.timeline ?? []).filter((t) => (t.outcome.spawn ?? []).includes(x.id)).map((t) => `раунд ${t.round}`),
  ];
  return (
    <>
      <label className="field">
        <span>Какой монстр</span>
        <Picker options={options} value={x.look} onChange={(v) => setPiece({ look: v })} />
      </label>
      <div className="field">
        <span className="hint">Когда он появится</span>
        <label className="check">
          <input type="radio" checked={(x.when ?? 'room') === 'room'} onChange={() => setPiece({ when: 'room' })} /> Сразу, как только сыщики откроют эту комнату
        </label>
        <label className="check">
          <input type="radio" checked={x.when === 'event'} onChange={() => setPiece({ when: 'event' })} /> Позже, по сигналу (обыск, разговор, рычаг, раунд)
        </label>
        {x.when === 'event' && (
          <div className="hint">{callers.length ? `Позовёт: ${callers.join(', ')}.` : 'Откройте нужный жетон и в «Ещё» отметьте этого монстра, или выберите раунд на шаге «Угроза».'}</div>
        )}
      </div>
    </>
  );
}

function DoorPart({ p, x, sizes, set, onNewRoom }: { p: Project; x: Piece; sizes: Sizes; set: (o: Partial<Outcome>) => void; onNewRoom: (id: string) => void }) {
  const change = useBuilder((s) => s.change);
  const owned = useOwned((s) => s.packs);
  const others = p.rooms.filter((r) => r.id !== x.room);
  const free = useMemo(() => tilesFree(p, owned), [p, owned]);
  return (
    <div className="field">
      <span className="hint">Куда ведёт дверь</span>
      {others.length > 0 && <RoomChecks p={p} rooms={others.map((r) => r.id)} value={x.outcome.reveal ?? []} onChange={(reveal) => set({ reveal })} />}
      <div className="row" style={{ marginTop: 6 }}>
        <Picker
          options={free}
          value=""
          placeholder="➕ Новая комната за этой дверью…"
          onChange={(tile) => {
            let room = '';
            change((q) => {
              const [next, id] = roomBehindDoor(q, x.id, tile, sizes);
              room = id;
              return next;
            });
            if (room) onNewRoom(room);
          }}
        />
      </div>
      <div className="hint">Новая комната встанет вплотную к этой. Пока дверь не открыта, сыщики её не видят.</div>
    </div>
  );
}

export function RoomChecks({ p, rooms, value, onChange }: { p: Project; rooms: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="checks">
      {rooms.map((r) => (
        <label key={r} className="check">
          <input type="checkbox" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((q) => q !== r))} />
          {roomTitle(p, r)}
        </label>
      ))}
    </div>
  );
}

// The window as the players will see it.
function giftLines(p: Project, o: Outcome): string[] {
  const lines: string[] = [];
  if (o.item) lines.push(`Сыщики получают: ${itemTitle(o.item)}`);
  if (o.clues) lines.push(o.clues > 1 ? `Улики: ${o.clues}` : 'Сыщик получает улику');
  for (const r of o.reveal ?? []) lines.push(`На карте появляется: ${roomTitle(p, r)}`);
  for (const m of o.spawn ?? []) {
    const q = pieceOf(p, m);
    if (q) lines.push(`Появляется: ${monsterTitle(q.look)}`);
  }
  if (o.win) lines.push('Победа!');
  return lines;
}

function Preview({ p, x }: { p: Project; x: Piece }) {
  const o = x.outcome;
  const lines = giftLines(p, o);
  const locked = o.lock && (
    <>
      <div className="hint">Пока заперто</div>
      <div className="wh-card">
        <div className="wh-text">🔒 {o.lock.text || 'Заперто.'}</div>
        <div className="wh-btn">Далее</div>
      </div>
    </>
  );
  const answers = o.choices?.filter((c) => c.label.trim()) ?? [];
  if (o.choices?.length) {
    return (
      <div className="wh-preview">
        <div className="hint">Так увидят игроки</div>
        <div className="wh-card">
          <div className="wh-text">{o.text || <span className="hint">Напишите вопрос</span>}</div>
          <div className="wh-btns col">
            {answers.map((c) => (
              <div key={c.id} className="wh-btn">
                {c.label}
              </div>
            ))}
          </div>
        </div>
        {answers.map((c) => (
          <div key={c.id}>
            <div className="hint">После «{c.label.trim()}»</div>
            <div className="wh-card">
              <div className="wh-text">{c.outcome.text || <span className="hint">Без текста</span>}</div>
              {giftLines(p, c.outcome).length > 0 && (
                <ul className="wh-effects">
                  {giftLines(p, c.outcome).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
              <div className="wh-btn">Далее</div>
            </div>
          </div>
        ))}
        {locked}
      </div>
    );
  }
  const t = o.test;
  const skill = t && SKILLS.find((k) => k.id === t.skill);
  const effects = lines.length > 0 && (
    <ul className="wh-effects">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
  if (t && skill) {
    return (
      <div className="wh-preview">
        <div className="hint">Так увидят игроки</div>
        <div className="wh-card">
          {o.text && <div className="wh-text">{o.text}</div>}
          <div className="wh-text">
            <b>
              Проверка {skill.icon} {skill.label}
              {t.need > 1 ? `, нужно успехов: ${t.need}` : ''}
            </b>
          </div>
          <div className="wh-btns">
            <div className="wh-btn pass">Успех</div>
            <div className="wh-btn fail">Провал</div>
          </div>
        </div>
        <div className="hint">После «Успех»</div>
        <div className="wh-card">
          <div className="wh-text">{t.pass || <span className="hint">Без текста</span>}</div>
          {effects}
          <div className="wh-btn">Далее</div>
        </div>
        <div className="hint">После «Провал»</div>
        <div className="wh-card">
          <div className="wh-text">{t.fail || <span className="hint">Без текста</span>}</div>
          {t.harm && <div className="wh-effects">{harmText(t.harm)}</div>}
          <div className="wh-btn">Далее</div>
        </div>
        {locked}
      </div>
    );
  }
  const pz = o.puzzle;
  if (pz) {
    const info = PUZZLES.find((k) => k.kind === pz.kind)!;
    return (
      <div className="wh-preview">
        <div className="hint">Так увидят игроки</div>
        {o.text && (
          <div className="wh-card">
            <div className="wh-text">{o.text}</div>
            <div className="wh-btn">К головоломке</div>
          </div>
        )}
        <div className="wh-card">
          <div className="wh-text">
            <b>
              {info.icon} {info.label}
            </b>
            {'\n'}
            {info.hint}
          </div>
        </div>
        <div className="hint">Когда решили</div>
        <div className="wh-card">
          <div className="wh-text">{pz.pass || <span className="hint">Без текста</span>}</div>
          {effects}
          <div className="wh-btn">Далее</div>
        </div>
        {locked}
      </div>
    );
  }
  return (
    <div className="wh-preview">
      <div className="hint">Так увидят игроки</div>
      <div className="wh-card">
        <div className="wh-text">{o.text || <span className="hint">Текст пока пуст. Если оставить так, окно не появится.</span>}</div>
        {effects}
        <div className="wh-btn">Далее</div>
      </div>
      {locked}
    </div>
  );
}

export function Dialog({ title, icon, children, onClose, onDelete }: { title: string; icon: string; children: React.ReactNode; onClose: () => void; onDelete?: () => void }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal builder-modal" role="dialog" aria-label={title}>
        <div className="modal-head">
          <span className="modal-icon">{icon}</span>
          <h2>{title}</h2>
          {onDelete && (
            <button className="danger ghost" onClick={onDelete}>
              Убрать с карты
            </button>
          )}
          <button className="primary" onClick={onClose}>
            Готово
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
