// What the investigators begin with: chosen items, or random ones of a kind (Valkyrie picks them at the start).

import catalog from '../content/catalog.json';
import { useOwned } from '../build/owned';
import { takeId, type StartItem } from '../build/project';
import { useBuilder } from '../build/store';
import { labelOf } from '../ui/options';
import { Picker, type Option } from '../ui/widgets';

const KINDS: { kind: NonNullable<StartItem['kind']>; label: string }[] = [
  { kind: 'common', label: 'любой обычный предмет' },
  { kind: 'weapon', label: 'случайное оружие' },
  { kind: 'lightsource', label: 'случайный источник света' },
  { kind: 'tome', label: 'случайная книга' },
  { kind: 'spell', label: 'случайное заклинание' },
];
const RANDOM = 'random:';
const NONE: StartItem[] = [];

export function StartItems() {
  const items = useBuilder((s) => s.project.startItems) ?? NONE;
  const change = useBuilder((s) => s.change);
  const owned = useOwned((s) => s.packs);
  const options: Option[] = [
    ...KINDS.map((k) => ({ value: RANDOM + k.kind, label: '🎲 ' + k.label, note: 'Valkyrie выберет сама' })),
    ...catalog.items
      .filter((i) => owned.includes(i.pack))
      .map((i) => ({
        value: i.id,
        get label() {
          return labelOf(i.name, i.nameKey);
        },
        note: i.traits.includes('unique') ? 'особый предмет' : 'обычный предмет',
        image: i.image,
      })),
  ];
  const put = (id: string, v: string) =>
    change((q) => ({
      ...q,
      startItems: (q.startItems ?? []).map((x) => (x.id === id ? (v.startsWith(RANDOM) ? { id, kind: v.slice(RANDOM.length) as StartItem['kind'] } : { id, item: v }) : x)),
    }));
  return (
    <div className="card start-items">
      <b>🎒 Предметы на старте</b>
      <p className="hint">Сыщики начнут игру с этими предметами. Случайный Valkyrie выберет в начале каждой партии.</p>
      {items.map((x) => (
        <div key={x.id} className="row">
          <Picker options={options} value={x.item ?? (x.kind ? RANDOM + x.kind : '')} onChange={(v) => put(x.id, v)} />
          <button className="auto ghost" title="Убрать" onClick={() => change((q) => ({ ...q, startItems: (q.startItems ?? []).filter((y) => y.id !== x.id) }))}>
            ✕
          </button>
        </div>
      ))}
      <div className="row">
        <button
          className="auto"
          onClick={() =>
            change((q) => {
              const [next, id] = takeId(q, 'T');
              return { ...next, startItems: [...(q.startItems ?? []), { id: id.slice(1), kind: 'common' }] };
            })
          }
        >
          + Предмет
        </button>
      </div>
    </div>
  );
}
