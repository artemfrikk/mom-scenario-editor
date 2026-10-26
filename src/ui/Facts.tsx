import { useState } from 'react';
import {
  COND_KINDS,
  condKind,
  factId,
  factLabel,
  formatOps,
  formatTests,
  knownFacts,
  OP_KINDS,
  opKind,
  parseOps,
  parseTests,
  withKind,
  withOpKind,
  type Cond,
  type Op,
} from '../model/facts';
import { useStore } from '../store';

const NEW = '__new__';

// Choose a fact ("Есть ключ") or invent a new one by typing its name.
export function FactPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const s = useStore((st) => st.scenario);
  const facts = useStore((st) => st.facts);
  const setFact = useStore((st) => st.setFact);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const known = knownFacts(s, facts);
  if (value && !known.includes(value)) known.push(value);

  const create = () => {
    const name = label.trim();
    if (!name) return;
    const id = factId(name, known);
    setFact(id, name);
    onChange(id);
    setCreating(false);
    setLabel('');
  };

  if (creating) {
    return (
      <div className="row">
        <input
          autoFocus
          value={label}
          placeholder="Например: Есть ключ"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create();
            if (e.key === 'Escape') setCreating(false);
          }}
        />
        <button className="small auto" onClick={create}>
          Создать
        </button>
      </div>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => (e.target.value === NEW ? setCreating(true) : onChange(e.target.value))}
    >
      {!value && <option value="">Выберите, что запоминать…</option>}
      {known.map((id) => (
        <option key={id} value={id}>
          {factLabel(facts, id)}
        </option>
      ))}
      <option value={NEW}>＋ Новый факт…</option>
    </select>
  );
}

// "Показать, только если…": a list of simple conditions on facts.
export function CondEditor({ raw, onChange, empty }: { raw: string | undefined; onChange: (next: string | undefined) => void; empty: string }) {
  const parsed = parseTests(raw);
  const set = (conds: Cond[], join = parsed.join) => onChange(formatTests(conds, join));
  if (!parsed.simple) {
    return (
      <div className="hint">
        Условие записано сложнее, чем умеет простой редактор: <code>{raw}</code>{' '}
        <button className="small ghost" onClick={() => onChange(undefined)}>
          Очистить
        </button>
      </div>
    );
  }
  return (
    <div className="cond-list">
      {!parsed.conds.length && <div className="hint">{empty}</div>}
      {parsed.conds.map((c, i) => {
        const kind = condKind(c);
        const numeric = COND_KINDS.find((k) => k.kind === kind)?.numeric;
        return (
          <div className="cond-row" key={i}>
            <FactPicker value={c.name} onChange={(name) => set(parsed.conds.map((x, n) => (n === i ? { ...x, name } : x)))} />
            <select value={kind} onChange={(e) => set(parsed.conds.map((x, n) => (n === i ? withKind(x, e.target.value as never) : x)))}>
              {COND_KINDS.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            {numeric && (
              <input
                style={{ width: 64 }}
                value={c.value}
                onChange={(e) => set(parsed.conds.map((x, n) => (n === i ? { ...x, value: e.target.value.replace(/[\s,:]/g, '') } : x)))}
              />
            )}
            <button className="small ghost danger" title="Убрать условие" onClick={() => set(parsed.conds.filter((_, n) => n !== i))}>
              ✕
            </button>
          </div>
        );
      })}
      <div className="row">
        <button className="small" onClick={() => set([...parsed.conds, { name: knownFactsFirst(), op: '>', value: '0' }])}>
          + условие
        </button>
        {parsed.conds.length > 1 && (
          <select value={parsed.join} onChange={(e) => set(parsed.conds, e.target.value as 'AND' | 'OR')} style={{ width: 'auto' }}>
            <option value="AND">должны выполняться все</option>
            <option value="OR">достаточно любого</option>
          </select>
        )}
      </div>
    </div>
  );
}

function knownFactsFirst(): string {
  const { scenario, facts } = useStore.getState();
  return knownFacts(scenario, facts)[0] ?? '';
}

// "Игра запомнит": what changes when the event fires.
export function OpsEditor({ raw, onChange }: { raw: string | undefined; onChange: (next: string | undefined) => void }) {
  const ops = parseOps(raw);
  const set = (next: (Op | { raw: string })[]) => onChange(formatOps(next));
  const update = (i: number, fn: (o: Op) => Op) => set(ops.map((o, n) => (n === i && !('raw' in o) ? fn(o) : o)));
  return (
    <div className="cond-list">
      {!ops.length && <div className="hint">Событие ничего не запоминает.</div>}
      {ops.map((o, i) => {
        if ('raw' in o) {
          return (
            <div className="cond-row" key={i}>
              <code style={{ flex: 1 }}>{o.raw}</code>
              <button className="small ghost danger" onClick={() => set(ops.filter((_, n) => n !== i))}>
                ✕
              </button>
            </div>
          );
        }
        const kind = opKind(o);
        const isEnd = o.name === '$end' && o.op === '=' && o.value === '1';
        return (
          <div className="cond-row" key={i}>
            {isEnd ? (
              <b style={{ flex: 1 }}>🏁 Игра заканчивается</b>
            ) : kind ? (
              <>
                <FactPicker value={o.name} onChange={(name) => update(i, (x) => ({ ...x, name }))} />
                <select value={kind} onChange={(e) => update(i, (x) => withOpKind(x, e.target.value as never))}>
                  {OP_KINDS.map((k) => (
                    <option key={k.kind} value={k.kind}>
                      {k.label}
                    </option>
                  ))}
                </select>
                {kind === 'set' && <input style={{ width: 64 }} value={o.value} onChange={(e) => update(i, (x) => ({ ...x, value: e.target.value.replace(/[\s,:]/g, '') }))} />}
              </>
            ) : (
              <code style={{ flex: 1 }}>{`${o.name},${o.op},${o.value}`}</code>
            )}
            <button className="small ghost danger" title="Убрать" onClick={() => set(ops.filter((_, n) => n !== i))}>
              ✕
            </button>
          </div>
        );
      })}
      <button className="small" onClick={() => set([...ops, { name: knownFactsFirst(), op: '=', value: '1' }])}>
        + запомнить
      </button>
    </div>
  );
}
