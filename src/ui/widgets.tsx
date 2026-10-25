import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}

export interface Option {
  value: string;
  label: string;
  note?: string;
}

// A searchable drop-down. Shows the chosen option's label; typing filters the list.
export function Picker({
  options,
  value,
  onChange,
  placeholder = 'Выберите…',
  allowCustom = false,
  autoFocus = false,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => (o.label + ' ' + o.value + ' ' + (o.note ?? '')).toLowerCase().includes(q))
      : options;
    return list.slice(0, 200);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="picker" ref={ref}>
      <input
        value={open ? query : current ? current.label : value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => {
          setOpen(true);
          setHl(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHl(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setHl((h) => Math.min(h + 1, filtered.length - 1));
          else if (e.key === 'ArrowUp') setHl((h) => Math.max(h - 1, 0));
          else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[hl]) choose(filtered[hl].value);
            else if (allowCustom && query.trim()) choose(query.trim());
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <div className="picker-list">
          {filtered.map((o, i) => (
            <div key={o.value} className={i === hl ? 'hl' : ''} onMouseDown={() => choose(o.value)}>
              <span>{o.label}</span>
              {o.note && <small>{o.note}</small>}
            </div>
          ))}
          {allowCustom && query.trim() && !options.some((o) => o.value === query.trim()) && (
            <div onMouseDown={() => choose(query.trim())}>
              <span>Использовать «{query.trim()}»</span>
            </div>
          )}
          {!filtered.length && !allowCustom && (
            <div>
              <small>Ничего не найдено</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A list of chips with a picker to add more.
export function ChipList({
  values,
  options,
  onChange,
  onClickChip,
  addLabel = '+ добавить',
}: {
  values: string[];
  options: Option[];
  onChange: (v: string[]) => void;
  onClickChip?: (v: string) => void;
  addLabel?: string;
}) {
  const [adding, setAdding] = useState(false);
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div>
      <div>
        {values.map((v, i) => (
          <span key={v + i} className="chip" onClick={() => onClickChip?.(v)} title={v}>
            {label(v)}
            <span
              className="x"
              onClick={(e) => {
                e.stopPropagation();
                onChange(values.filter((_, j) => j !== i));
              }}
            >
              ✕
            </span>
          </span>
        ))}
        {!adding && (
          <button className="small ghost" onClick={() => setAdding(true)}>
            {addLabel}
          </button>
        )}
      </div>
      {adding && (
        <div style={{ marginTop: 6 }}>
          <Picker
            options={options.filter((o) => !values.includes(o.value))}
            value=""
            placeholder="Начните вводить…"
            autoFocus
            onChange={(v) => {
              onChange([...values, v]);
              setAdding(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
