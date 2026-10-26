import { useStore } from '../store';
import { getComponent, getText, setText } from '../model/ops';
import {
  addDoorOn,
  addSearchOn,
  DOOR_MODES,
  doorModeOf,
  foundOf,
  foundText,
  placeInvestigators,
  removeInvestigators,
  roomText,
  setDoorMode,
  setFound,
  setFoundText,
  setRoomText,
  startsHere,
  tokenText,
  type DoorMode,
  type Found,
} from '../model/objects';
import { ITEM_OPTIONS, MONSTER_OPTIONS } from './options';
import { TextEditor } from './TextEditor';
import { Picker } from './widgets';

const FOUND: { id: Found; icon: string; title: string }[] = [
  { id: 'nothing', icon: '🫙', title: 'Ничего' },
  { id: 'weapon', icon: '🔫', title: 'Оружие' },
  { id: 'item', icon: '🎒', title: 'Предмет' },
  { id: 'clue', icon: '🔎', title: 'Улика' },
];

// The map constructor: click a room, a token or a door and say in plain words what it does.
// Events, links and texts are made behind the scenes.
export function ObjectPanel() {
  const s = useStore((st) => st.scenario);
  const lang = useStore((st) => st.lang);
  const selected = useStore((st) => st.selected);
  const change = useStore((st) => st.change);
  const select = useStore((st) => st.select);
  const setFact = useStore((st) => st.setFact);
  const flash = useStore((st) => st.flash);
  const c = selected ? getComponent(s, selected) : undefined;
  if (!c || !['Tile', 'Token', 'Door'].includes(c.type)) return null;
  const name = c.name;

  if (c.type === 'Tile') {
    const here = startsHere(s, name);
    return (
      <aside className="object-panel">
        <b>🧱 Комната</b>
        <label className="hint">Что прочтут игроки, когда комната появится на карте</label>
        <TextEditor rows={4} value={roomText(s, lang, name)} onChange={(v) => change((sc) => setRoomText(sc, lang, name, v), 'room:' + name)} />
        <button className={here ? 'primary' : ''} onClick={() => change((sc) => (here ? removeInvestigators(sc) : placeInvestigators(sc, lang, name)))}>
          {here ? '✓ Сыщики начинают здесь' : '👥 Поставить сюда сыщиков'}
        </button>
        <div className="hint">Что ещё можно положить в эту комнату:</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              let made = '';
              change((sc) => {
                const r = addSearchOn(sc, lang, name);
                made = r.name;
                return r.scenario;
              });
              select(made);
            }}
          >
            🔍 Жетон поиска
          </button>
          <button
            onClick={() => {
              let made = '';
              change((sc) => {
                const r = addDoorOn(sc, lang, name);
                made = r.name;
                return r.scenario;
              });
              select(made);
            }}
          >
            🚪 Дверь
          </button>
        </div>
      </aside>
    );
  }

  if (c.type === 'Token' && c.data.type === 'TokenInvestigators') {
    return (
      <aside className="object-panel">
        <b>👥 Сыщики</b>
        <div className="hint">Здесь сыщики начинают игру. Чтобы перенести их, нажмите на другую комнату и выберите «Поставить сюда сыщиков».</div>
      </aside>
    );
  }

  if (c.type === 'Token') {
    const found = foundOf(s, name);
    const pickFound = (kind: Found, item = '') => change((sc) => setFound(sc, lang, name, kind, item));
    return (
      <aside className="object-panel">
        <b>🔍 Жетон</b>
        <label className="hint">Что прочтут игроки, когда нажмут на жетон</label>
        <TextEditor rows={3} value={tokenText(s, lang, name)} onChange={(v) => change((sc) => setText(sc, lang, name + '.text', v), 'tok:' + name)} />
        <div className="hint">Что найдут под ним:</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {FOUND.map((f) => (
            <button key={f.id} className={found.kind === f.id ? 'primary' : ''} onClick={() => pickFound(f.id, f.id === 'item' ? found.item || ITEM_OPTIONS[0]?.value : '')}>
              {f.icon} {f.title}
            </button>
          ))}
        </div>
        {found.kind === 'weapon' && <div className="hint">Игроки возьмут случайное оружие из колоды.</div>}
        {found.kind === 'item' && <Picker options={ITEM_OPTIONS} value={found.item} placeholder="Какой предмет" onChange={(v) => v && pickFound('item', v)} />}
        {found.kind !== 'nothing' && (
          <>
            <label className="hint">Что прочтут про находку</label>
            <TextEditor rows={3} value={foundText(s, lang, name)} onChange={(v) => change((sc) => setFoundText(sc, lang, name, v), 'found:' + name)} />
          </>
        )}
      </aside>
    );
  }

  const mode = doorModeOf(s, name);
  const pick = (m: DoorMode, monster = '') => {
    let facts: Record<string, string> = {};
    change((sc) => {
      const r = setDoorMode(sc, lang, name, m, monster);
      facts = r.facts;
      return r.scenario;
    });
    for (const [id, label] of Object.entries(facts)) setFact(id, label);
    if (m === 'key') flash('Рядом с дверью появился жетон с ключом. Перенесите его в нужную комнату.');
  };
  const monster = s.components.find((x) => x.data.comment === 'Создано конструктором для ' + name && x.type === 'Spawn')?.data.monster ?? '';
  return (
    <aside className="object-panel">
      <b>🚪 Дверь</b>
      <label className="hint">Что прочтут игроки, когда нажмут на дверь</label>
      <TextEditor rows={3} value={getText(s, lang, name + '.text')} onChange={(v) => change((sc) => setText(sc, lang, name + '.text', v), 'door:' + name)} />
      <div className="hint">Как она открывается:</div>
      {DOOR_MODES.map((m) => (
        <button key={m.id} className={'door-mode' + (mode === m.id ? ' primary' : '')} title={m.what} onClick={() => pick(m.id)}>
          {m.icon} {m.title}
        </button>
      ))}
      <div className="hint">{DOOR_MODES.find((m) => m.id === mode)?.what}</div>
      {mode === 'monster' && <Picker options={MONSTER_OPTIONS} value={monster} placeholder="Какой монстр" onChange={(v) => v && pick('monster', v)} />}
    </aside>
  );
}
