import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { imageUrl, useImages } from '../images';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </label>
  );
}

// A picture from the player's own game files, if they have been connected.
export function Thumb({ path, className = 'thumb' }: { path: string | undefined; className?: string }) {
  const urls = useImages((st) => st.urls);
  const url = imageUrl(urls, path);
  return url ? <img className={className} src={url} alt="" loading="lazy" /> : null;
}

export interface Option {
  value: string;
  label: string;
  note?: string;
  image?: string; // catalog image path; shown as a thumbnail once the game pictures are connected
}

// A searchable drop-down. Shows the chosen option's label; typing filters the list.
export function Picker({
  options,
  value,
  onChange,
  placeholder = 'Выберите…',
  allowCustom = false,
  autoFocus = false,
  describe,
}: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  autoFocus?: boolean;
  // Explains the highlighted option, so a beginner knows what they are choosing.
  describe?: (value: string) => string;
}) {
  const urls = useImages((st) => st.urls);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Names arrive later, when the player's texts are connected: redo the list then.
  const names = useImages((st) => st.names);
  const current = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    void names; // option labels read the names, so a change of names must redo the list
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => (o.label + ' ' + o.value + ' ' + (o.note ?? '')).toLowerCase().includes(q))
      : options;
    return list.slice(0, 200);
  }, [options, query, names]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Keep the highlighted option visible when moving with the arrow keys.
  useEffect(() => {
    (listRef.current?.children[hl] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [hl, open]);

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
        <div className="picker-pop">
        <div className="picker-list" ref={listRef}>
          {filtered.map((o, i) => {
            const thumb = imageUrl(urls, o.image);
            return (
              <div key={o.value} className={i === hl ? 'hl' : ''} onMouseDown={() => choose(o.value)} onMouseEnter={() => setHl(i)}>
                {thumb && <img className="thumb" src={thumb} alt="" loading="lazy" />}
                <span className="grow">{o.label}</span>
                {o.note && <small>{o.note}</small>}
              </div>
            );
          })}
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
          {describe && filtered[hl] && <div className="picker-help">{describe(filtered[hl].value)}</div>}
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
  describe,
}: {
  values: string[];
  options: Option[];
  onChange: (v: string[]) => void;
  onClickChip?: (v: string) => void;
  addLabel?: string;
  describe?: (value: string) => string;
}) {
  const [adding, setAdding] = useState(false);
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div>
      <div>
        {values.map((v, i) => (
          <span key={v + i} className="chip" onClick={() => onClickChip?.(v)} title={v}>
            <Thumb path={options.find((o) => o.value === v)?.image} className="chip-img" />
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
            describe={describe}
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

// A collapsible "how does this work" box. Remembers if the person has closed it.
export function Guide({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const key = 'mse-guide-' + id;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'closed';
    } catch {
      return true;
    }
  });
  return (
    <details
      className="info"
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(now);
        try {
          localStorage.setItem(key, now ? 'open' : 'closed');
        } catch {
          // remembering is optional
        }
      }}
    >
      <summary>{title}</summary>
      {children}
    </details>
  );
}
