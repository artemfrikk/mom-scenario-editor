// A text field that hides Valkyrie markup: <color=…>…</color>, <b>, <i> show as coloured, bold and italic text,
// and {will}, {c:TileDock}, {qst:KEY} show as small blocks that can be moved or deleted but not broken.
// What is stored is still the plain Valkyrie text.

import { useLayoutEffect, useRef } from 'react';
import { fromDom, toHtml, type Lookup } from '../translate/markup';

export function TokenEditor({
  value,
  onChange,
  placeholder,
  lookup,
  onCtrlEnter,
  lang,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  lookup?: Lookup;
  onCtrlEnter?: (el: HTMLElement) => void;
  lang?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);

  // Rewrite the field only when the text changed from outside (machine translation, undo, replace).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || last.current === value) return;
    el.innerHTML = toHtml(value, lookup);
    last.current = value;
  }, [value, lookup]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const text = fromDom(el);
    last.current = text;
    onChange(text);
  };

  return (
    <div
      ref={ref}
      className={'tr-edit' + (value ? '' : ' empty')}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      lang={lang}
      data-placeholder={placeholder}
      onInput={emit}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onCtrlEnter?.(e.currentTarget);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          document.execCommand('insertLineBreak');
        }
      }}
    />
  );
}
