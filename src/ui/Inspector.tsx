import { useMemo, useState } from 'react';
import catalog from '../content/catalog.json';
import { isEventLike, type QComponent, type Scenario } from '../format/scenario';
import {
  addButton,
  addedBy,
  BOARD_TYPES,
  setAddedBy,
  buttonLabel,
  buttonsOf,
  deleteComponent,
  duplicateComponent,
  getComponent,
  getText,
  removeButton,
  renameComponent,
  resolveText,
  setButtonTargets,
  setText,
  updateData,
} from '../model/ops';
import { BUILTIN_TRIGGERS } from '../model/validate';
import { useStore } from '../store';
import { TRIGGER_LABEL, TYPE_ICON, TYPE_LABEL } from './labels';
import { describeComponent, triggerHelp, TYPE_EXPLAIN } from './help';
import { AUDIO_OPTIONS, ITEM_OPTIONS, MONSTER_OPTIONS, previewHtml, TILE_OPTIONS, TOKEN_OPTIONS } from './options';
import { ChipList, Field, Guide, Picker, Thumb, type Option } from './widgets';

function componentOptions(s: Scenario, filter: (c: QComponent) => boolean = () => true): Option[] {
  return s.components.filter(filter).map((c) => ({ value: c.name, label: c.name, note: TYPE_LABEL[c.type] }));
}

function triggerOptions(s: Scenario): Option[] {
  const out: Option[] = BUILTIN_TRIGGERS.map((t) => ({ value: t, label: TRIGGER_LABEL[t] ?? t }));
  out.unshift({ value: '', label: TRIGGER_LABEL[''] });
  for (const c of s.components) {
    if (c.type === 'Spawn' || c.type === 'CustomMonster') {
      out.push({ value: 'Defeated' + c.name, label: `Побеждён монстр ${c.name}` });
      out.push({ value: 'DefeatedUnique' + c.name, label: `Побеждён уникальный ${c.name}` });
    }
  }
  for (const m of catalog.monsters) out.push({ value: 'Defeated' + m.id, label: `Побеждён любой: ${m.name}`, note: 'монстр' });
  return out;
}

export function Inspector() {
  const selected = useStore((st) => st.selected);
  const s = useStore((st) => st.scenario);
  const c = selected ? getComponent(s, selected) : undefined;
  if (!c) {
    return (
      <aside className="inspector">
        <div className="hint" style={{ marginTop: 40, textAlign: 'center' }}>
          Выберите событие, жетон или тайл,
          <br />
          чтобы изменить его здесь.
        </div>
      </aside>
    );
  }
  return (
    <aside className="inspector" key={c.name}>
      <Header c={c} />
      {BOARD_TYPES.includes(c.type) && <AppearsWhen c={c} />}
      {c.type === 'Tile' && <TileFields c={c} />}
      {(c.type === 'Token' || c.type === 'Door') && <TokenFields c={c} />}
      {c.type === 'Spawn' && <SpawnFields c={c} />}
      {c.type === 'QItem' && <ItemFields c={c} />}
      {isEventLike(c.type) && <EventFields c={c} />}
      <RawFields c={c} key={rawText(c)} />
    </aside>
  );
}

function useChange() {
  return useStore((st) => st.change);
}

function Header({ c }: { c: QComponent }) {
  const change = useChange();
  const select = useStore((st) => st.select);
  const [name, setName] = useState(c.name.substring(c.type.length));
  const s = useStore((st) => st.scenario);
  const full = c.type + name.replace(/[^A-Za-z0-9_]/g, '');
  const taken = full !== c.name && !!getComponent(s, full);

  return (
    <>
      <h2>
        <span>{TYPE_ICON[c.type]}</span> {TYPE_LABEL[c.type]}
      </h2>
      <div className="info">
        <b>Что это.</b> {TYPE_EXPLAIN[c.type]}
      </div>
      <Field label="Идентификатор" hint={taken ? 'Такое имя уже занято.' : 'Латиница и цифры. Все ссылки обновятся автоматически.'}>
        <div className="row">
          <span className="auto hint">{c.type}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!taken && full !== c.name && name) {
                change((sc) => renameComponent(sc, c.name, full));
                select(full);
              } else setName(c.name.substring(c.type.length));
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
      </Field>
      <div className="row" style={{ marginBottom: 8 }}>
        <button
          onClick={() => {
            let created = '';
            change((sc) => {
              const [next, n] = duplicateComponent(sc, c.name);
              created = n;
              return next;
            });
            if (created) select(created);
          }}
        >
          Дублировать
        </button>
        <button
          className="danger"
          onClick={() => {
            if (!confirm(`Удалить ${c.name}? Ссылки на него тоже удалятся.`)) return;
            change((sc) => deleteComponent(sc, c.name));
            select(null);
          }}
        >
          Удалить
        </button>
      </div>
    </>
  );
}

function TextArea({ textKey, label, hint, rows = 5 }: { textKey: string; label: string; hint?: string; rows?: number }) {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const change = useChange();
  return (
    <Field label={label} hint={hint}>
      <textarea
        rows={rows}
        value={getText(s, lang, textKey)}
        onChange={(e) => change((sc) => setText(sc, lang, textKey, e.target.value), 'text:' + textKey)}
      />
    </Field>
  );
}

function DataInput({ c, k, label, hint, type = 'text' }: { c: QComponent; k: string; label: string; hint?: string; type?: string }) {
  const change = useChange();
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        value={c.data[k] ?? ''}
        step={type === 'number' ? 'any' : undefined}
        onChange={(e) => change((sc) => updateData(sc, c.name, { [k]: e.target.value === '' ? undefined : e.target.value }), `data:${c.name}:${k}`)}
      />
    </Field>
  );
}

function DataCheck({ c, k, label, defaultOn = false }: { c: QComponent; k: string; label: string; defaultOn?: boolean }) {
  const change = useChange();
  const on = c.data[k] === undefined ? defaultOn : c.data[k].toLowerCase() === 'true';
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) =>
          change((sc) => updateData(sc, c.name, { [k]: e.target.checked === defaultOn ? undefined : String(e.target.checked) }))
        }
      />
      {label}
    </label>
  );
}

function Position({ c }: { c: QComponent }) {
  return (
    <div className="row">
      <DataInput c={c} k="xposition" label="X" type="number" />
      <DataInput c={c} k="yposition" label="Y" type="number" />
    </div>
  );
}

function Rotation({ c, steps = [0, 90, 180, 270] }: { c: QComponent; steps?: number[] }) {
  const change = useChange();
  return (
    <Field label="Поворот">
      <div className="row">
        {steps.map((r) => (
          <button
            key={r}
            className={String(r) === (c.data.rotation ?? '0') ? 'primary small' : 'small'}
            onClick={() => change((sc) => updateData(sc, c.name, { rotation: r ? String(r) : undefined }))}
          >
            {r}°
          </button>
        ))}
      </div>
    </Field>
  );
}

function AppearsWhen({ c }: { c: QComponent }) {
  const s = useStore((st) => st.scenario);
  const change = useChange();
  const select = useStore((st) => st.select);
  const lang = useStore((st) => st.lang);
  const events = useMemo(() => componentOptions(s, (x) => isEventLike(x.type) && x.name !== c.name), [s, c.name]);
  const by = addedBy(s, c.name);
  return (
    <>
      <h3>Когда появляется на карте</h3>
      <Field
        label="Показывается после события"
        hint={by.length ? undefined : 'Пока ни одно событие не показывает этот объект, игроки его не увидят. Для стартовой комнаты выберите стартовое событие.'}
      >
        <ChipList values={by} options={events} onClickChip={select} addLabel="+ выбрать событие" describe={(n) => describeComponent(s, lang, n)} onChange={(v) => change((sc) => setAddedBy(sc, c.name, v))} />
      </Field>
    </>
  );
}

function TileFields({ c }: { c: QComponent }) {
  const change = useChange();
  return (
    <>
      <h3>Тайл</h3>
      <Field label="Какой тайл">
        <Picker options={TILE_OPTIONS} value={c.data.side ?? ''} onChange={(v) => change((sc) => updateData(sc, c.name, { side: v }))} />
      </Field>
      <Rotation c={c} />
      <Position c={c} />
      <div className="hint">Тайлы можно двигать мышкой на вкладке «Карта».</div>
    </>
  );
}

function TokenFields({ c }: { c: QComponent }) {
  const change = useChange();
  return (
    <>
      <h3>{c.type === 'Door' ? 'Дверь' : 'Жетон'}</h3>
      {c.type === 'Token' && (
        <Field label="Вид жетона">
          <Picker options={TOKEN_OPTIONS} value={c.data.type ?? ''} onChange={(v) => change((sc) => updateData(sc, c.name, { type: v }))} />
        </Field>
      )}
      {c.type === 'Door' && <DataInput c={c} k="color" label="Цвет двери" hint="Например: white, red, blue, yellow." />}
      <Rotation c={c} steps={c.type === 'Door' ? [0, 90] : [0, 90, 180, 270]} />
      <Position c={c} />
    </>
  );
}

function SpawnFields({ c }: { c: QComponent }) {
  const change = useChange();
  const s = useStore((st) => st.scenario);
  const options = useMemo(
    () => [
      ...MONSTER_OPTIONS,
      ...s.components.filter((x) => x.type === 'CustomMonster').map((x) => ({ value: x.name, label: x.name, note: 'свой монстр' })),
    ],
    [s.components],
  );
  const monsters = (c.data.monster ?? '').split(/\s+/).filter(Boolean);
  return (
    <>
      <h3>Монстр</h3>
      <Field label="Какой монстр" hint="Если выбрать несколько, игра возьмёт одного случайного.">
        <ChipList values={monsters} options={options} onChange={(v) => change((sc) => updateData(sc, c.name, { monster: v.join(' ') || undefined }))} />
      </Field>
      {monsters[0] && <Thumb path={catalog.monsters.find((m) => m.id === monsters[0])?.image} className="preview-img" />}
      <DataCheck c={c} k="unique" label="Уникальный монстр (со своим именем и описанием)" />
      {c.data.unique === 'true' && (
        <>
          <TextArea textKey={c.name + '.uniquetitle'} label="Имя уникального монстра" rows={1} />
          <TextArea textKey={c.name + '.uniquetext'} label="Описание" rows={3} />
          <DataInput c={c} k="uniquehealth" label="Дополнительное здоровье" type="number" />
          <DataInput c={c} k="uniquehealthhero" label="Здоровье за каждого сыщика" type="number" />
        </>
      )}
    </>
  );
}

function ItemFields({ c }: { c: QComponent }) {
  const change = useChange();
  const items = (c.data.itemname ?? '').split(/\s+/).filter(Boolean);
  return (
    <>
      <h3>Предмет</h3>
      <Field label="Конкретные предметы" hint="Если выбрать несколько, игра возьмёт один случайный.">
        <ChipList values={items} options={ITEM_OPTIONS} onChange={(v) => change((sc) => updateData(sc, c.name, { itemname: v.join(' ') || undefined }))} />
      </Field>
      <DataInput c={c} k="traits" label="Или любой предмет с признаками" hint="Например: weapon, common, spell." />
      <DataCheck c={c} k="starting" label="Сыщики получают его в начале" />
    </>
  );
}

function EventFields({ c }: { c: QComponent }) {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const change = useChange();
  const select = useStore((st) => st.select);
  const buttons = buttonsOf(c);
  const shown = c.data.display !== 'false';
  const targets = useMemo(() => componentOptions(s, (x) => isEventLike(x.type)), [s]);
  const all = useMemo(() => componentOptions(s, (x) => x.name !== c.name), [s, c.name]);
  const triggers = useMemo(() => triggerOptions(s), [s]);
  const list = (k: string) => (c.data[k] ?? '').split(/\s+/).filter(Boolean);
  const describe = (n: string) => describeComponent(s, lang, n);

  return (
    <>
      <Guide id="event" title="Как собрать событие">
        <ol>
          <li>
            <b>Текст</b>: что прочитают игроки в окне.
          </li>
          <li>
            <b>Кнопки</b>: варианты, которые выбирают игроки. Каждая кнопка ведёт к следующему событию. Если кнопка никуда не ведёт, сценарий на ней закончится.
          </li>
          <li>
            <b>Показать на карте</b>: комнаты, жетоны и монстры, которые появятся, когда событие сработает.
          </li>
          <li>
            <b>Запуск</b>: нужен, только если событие должно сработать само, без кнопки. Например, вступление в начале игры.
          </li>
        </ol>
      </Guide>
      <h3>Что видят игроки</h3>
      <DataCheck c={c} k="display" label="Показывать окно с текстом" defaultOn />
      {shown && (
        <TextArea
          textKey={c.name + '.text'}
          label="Текст"
          rows={6}
          hint="Можно использовать <b>жирный</b>, <i>курсив</i> и значки игры: {will}, {lore}, {action}…"
        />
      )}

      <h3>Кнопки и переходы</h3>
      {buttons.map((b) => (
        <div className="btn-card" key={b.index}>
          <div className="head">
            Кнопка {b.index}
            <span style={{ flex: 1 }} />
            {buttons.length > 1 && (
              <button className="small ghost danger" onClick={() => change((sc) => removeButton(sc, c.name, b.index))}>
                Удалить
              </button>
            )}
          </div>
          {shown &&
            (b.labelRaw !== undefined ? (
              <Field label="Надпись (общая)">
                <input
                  value={b.labelRaw}
                  onChange={(e) => change((sc) => updateData(sc, c.name, { ['button' + b.index]: e.target.value }), `btn:${c.name}:${b.index}`)}
                />
              </Field>
            ) : (
              <Field label="Надпись" hint={/\{qst:/.test(getText(s, lang, b.labelKey)) ? `Сейчас: «${buttonLabel(s, lang, b)}»` : undefined}>
                <input
                  value={getText(s, lang, b.labelKey)}
                  placeholder="Продолжить"
                  onChange={(e) => change((sc) => setText(sc, lang, b.labelKey, e.target.value), `btn:${c.name}:${b.index}`)}
                />
              </Field>
            ))}
          <Field label="Ведёт к">
            <ChipList
              values={b.targets}
              options={targets}
              onClickChip={select}
              addLabel={b.targets.length ? '+ ещё' : '+ выбрать событие'}
              describe={describe}
              onChange={(v) => change((sc) => setButtonTargets(sc, c.name, b.index, v))}
            />
          </Field>
          {b.condition && <div className="hint">Условие: {b.condition}</div>}
        </div>
      ))}
      <button className="small" onClick={() => change((sc) => addButton(sc, c.name, '', lang))}>
        + Кнопка
      </button>
      {buttons.some((b) => b.targets.length > 1) && (
        <div className="hint" style={{ marginTop: 8 }}>
          Если кнопка ведёт к нескольким событиям, сработает первое, чьи условия выполнены.
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <DataCheck c={c} k="randomevents" label="Выбирать следующее событие случайно" />
      </div>

      {shown && (
        <>
          <h3>Предпросмотр</h3>
          <div className="preview">
            <div dangerouslySetInnerHTML={{ __html: previewHtml(resolveText(s, lang, getText(s, lang, c.name + '.text'))) }} />
            <div className="pbtns">
              {buttons.map((b) => (
                <span key={b.index}>{buttonLabel(s, lang, b) || 'Продолжить'}</span>
              ))}
            </div>
          </div>
        </>
      )}

      <h3>Что происходит</h3>
      <Field label="Запуск" hint="Когда событие срабатывает само, без кнопки.">
        <Picker options={triggers} value={c.data.trigger ?? ''} describe={triggerHelp} allowCustom onChange={(v) => change((sc) => updateData(sc, c.name, { trigger: v || undefined }))} />
      </Field>
      <Field label="Показать на карте" hint="Тайлы, жетоны и монстры, которые появятся.">
        <ChipList values={list('add')} options={all} onClickChip={select} describe={describe} onChange={(v) => change((sc) => updateData(sc, c.name, { add: v.join(' ') || undefined }))} />
      </Field>
      <Field label="Убрать с карты">
        <ChipList values={list('remove')} options={all} onClickChip={select} describe={describe} onChange={(v) => change((sc) => updateData(sc, c.name, { remove: v.join(' ') || undefined }))} />
      </Field>
      <Field label="Звук">
        <Picker options={[{ value: '', label: 'Без звука' }, ...AUDIO_OPTIONS]} value={c.data.audio ?? ''} allowCustom onChange={(v) => change((sc) => updateData(sc, c.name, { audio: v || undefined }))} />
      </Field>
      <DataCheck c={c} k="highlight" label="Подсветить место на карте" />

      <details>
        <summary className="hint" style={{ cursor: 'pointer', margin: '14px 0 10px' }}>
          Переменные и условия (для опытных)
        </summary>
        <DataInput c={c} k="operations" label="Операции" hint="Через пробел: имя,операция,значение. Например: clues,+,1 $end,=,1" />
        <DataInput c={c} k="vartests" label="Условия срабатывания" hint="Например: VarOperation:clues,>=,3" />
        <DataInput c={c} k="quota" label="Квота" hint="Сколько раз надо активировать, прежде чем сработают кнопки." />
        <div className="row">
          <DataInput c={c} k="minhero" label="Мин. сыщиков" type="number" />
          <DataInput c={c} k="maxhero" label="Макс. сыщиков" type="number" />
        </div>
      </details>
    </>
  );
}

function rawText(c: QComponent): string {
  return Object.entries(c.data)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

function RawFields({ c }: { c: QComponent }) {
  const change = useChange();
  const raw = rawText(c);
  const [text, setTextValue] = useState(raw);
  return (
    <details style={{ marginTop: 16 }}>
      <summary className="hint" style={{ cursor: 'pointer' }}>
        Все параметры (как в файле Valkyrie)
      </summary>
      <textarea
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, marginTop: 8 }}
        rows={10}
        value={text}
        onChange={(e) => setTextValue(e.target.value)}
        onBlur={() => {
          if (text === raw) return;
          const data: Record<string, string> = {};
          for (const line of text.split('\n')) {
            const i = line.indexOf('=');
            if (!line.trim()) continue;
            if (i === -1) data[line.trim()] = '';
            else data[line.substring(0, i).trim()] = line.substring(i + 1).trim();
          }
          change((sc) => ({ ...sc, components: sc.components.map((x) => (x.name === c.name ? { ...x, data } : x)) }));
        }}
      />
      <div className="hint">Изменения применяются, когда вы убираете курсор из поля.</div>
    </details>
  );
}
