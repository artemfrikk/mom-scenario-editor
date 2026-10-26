// Valkyrie markup <-> HTML of the translator's text field: <color=…>, <b>, <i> become styled text,
// {will}, {c:TileDock}, {qst:KEY} and other game marks become small blocks that cannot be broken by typing.

import { ICON_TEXT } from '../ui/options';

const TOKEN = /(\{[^{}\n]+\}|<\/?[a-zA-Z][^<>\n]*>|\n)/;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type Lookup = (key: string) => string | undefined;

export function tokenLabel(token: string, lookup?: Lookup): string {
  // {@City}: a name that differs from quest to quest in a big package
  if (token.startsWith('{@')) return '⟨' + token.slice(2, -1) + '⟩';
  const m = token.match(/^\{([a-z]+)(?::([^}]*))?\}$/i);
  if (!m) return token;
  const [, kind, arg = ''] = m;
  if (!arg && ICON_TEXT[kind]) return ICON_TEXT[kind];
  if (kind === 'c') return lookup?.(arg + '.name') || lookup?.(arg + '.text') || arg.replace(/^(Tile|Token|Door|QItem|Spawn|CustomMonster|MPlace|UI|Event|Puzzle)/, '') || arg;
  if (kind === 'qst') return '«' + (lookup?.(arg) ?? arg) + '»';
  if (kind === 'var') return `[число ${arg}]`;
  if (kind === 'rnd') return '[случайный сыщик]';
  if (kind === 'ffg') return arg.replace(/_MAD\d+$/, '').replace(/^TILE_/, '').toLowerCase().replace(/_/g, ' ');
  return token;
}

function chip(token: string, lookup?: Lookup): string {
  return `<span class="tk" contenteditable="false" data-t="${esc(token)}" title="${esc(token)}">${esc(tokenLabel(token, lookup))}</span>`;
}

// Valkyrie text -> HTML for the editable field.
export function toHtml(text: string, lookup?: Lookup): string {
  const parts = text.split(TOKEN).filter((p) => p !== '');
  // Pair opening and closing tags; a tag without its pair stays a block.
  const closeOf = new Map<number, number>();
  const stack: { name: string; at: number }[] = [];
  parts.forEach((p, i) => {
    const open = p.match(/^<(color|b|i)(=[^>]*)?>$/i);
    const close = p.match(/^<\/(color|b|i)>$/i);
    if (open) stack.push({ name: open[1].toLowerCase(), at: i });
    else if (close) {
      const j = stack.map((s) => s.name).lastIndexOf(close[1].toLowerCase());
      if (j !== -1) {
        closeOf.set(stack[j].at, i);
        stack.length = j;
      }
    }
  });
  const closing = new Set(closeOf.values());
  let html = '';
  parts.forEach((p, i) => {
    if (p === '\n') html += '<br>';
    else if (closeOf.has(i)) {
      const color = p.match(/^<color=([^>]*)>$/i);
      if (color) html += `<span class="tk-color" data-color="${esc(color[1])}" style="color:${esc(color[1])}">`;
      else html += p.toLowerCase() === '<b>' ? '<b>' : '<i>';
    } else if (closing.has(i)) html += p.toLowerCase() === '</color>' ? '</span>' : p.toLowerCase();
    else if (TOKEN.test(p)) html += chip(p, lookup);
    else html += esc(p);
  });
  // A trailing line break needs a second one to be visible in contenteditable.
  if (html.endsWith('<br>')) html += '<br>';
  return html;
}

// HTML of the field -> Valkyrie text.
export function fromDom(root: Node): string {
  let out = '';
  const walk = (node: Node, top: boolean) => {
    node.childNodes.forEach((n, index) => {
      if (n.nodeType === Node.TEXT_NODE) {
        out += (n.textContent ?? '').replace(/ /g, ' ').replace(/​/g, '');
        return;
      }
      if (!(n instanceof HTMLElement)) return;
      const tag = n.tagName;
      if (tag === 'BR') {
        out += '\n';
        return;
      }
      if (n.dataset.t !== undefined) {
        out += n.dataset.t;
        return;
      }
      if (n.dataset.color !== undefined) {
        out += `<color=${n.dataset.color}>`;
        walk(n, false);
        out += '</color>';
        return;
      }
      if (tag === 'B' || tag === 'STRONG' || tag === 'I' || tag === 'EM') {
        const t = tag === 'B' || tag === 'STRONG' ? 'b' : 'i';
        out += `<${t}>`;
        walk(n, false);
        out += `</${t}>`;
        return;
      }
      // Browsers sometimes wrap new lines in <div>.
      if ((tag === 'DIV' || tag === 'P') && top && index > 0 && !out.endsWith('\n')) out += '\n';
      walk(n, false);
    });
  };
  walk(root, true);
  // The last line break of a field is only there to keep the caret visible.
  return out.endsWith('\n') ? out.slice(0, -1) : out;
}
