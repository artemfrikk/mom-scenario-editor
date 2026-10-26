// Variables ("facts" in the editor's words) and the conditions on them.
// Valkyrie stores them as `operations=name,=,1` and `vartests=VarOperation:name,>,0`; here they are
// parsed into small objects the interface can show as plain sentences.

import type { Scenario } from '../format/scenario';

export interface Cond {
  name: string;
  op: string;
  value: string;
}

export interface ParsedTests {
  conds: Cond[];
  join: 'AND' | 'OR';
  // false when the text holds something the simple editor cannot show (parentheses, mixed AND/OR, broken parts)
  simple: boolean;
}

export function parseTests(raw: string | undefined): ParsedTests {
  const out: ParsedTests = { conds: [], join: 'AND', simple: true };
  const ops = new Set<string>();
  for (const token of (raw ?? '').split(/\s+/).filter(Boolean)) {
    const at = token.indexOf(':');
    const kind = token.slice(0, at);
    const body = token.slice(at + 1);
    if (kind === 'VarOperation') {
      const [name, op, value] = body.split(',');
      if (name && op && value !== undefined) out.conds.push({ name, op, value });
      else out.simple = false;
    } else if (kind === 'VarTestsLogicalOperator') {
      ops.add(body);
    } else {
      out.simple = false;
    }
  }
  if (ops.size > 1) out.simple = false;
  if (ops.has('OR')) out.join = 'OR';
  return out;
}

export function formatTests(conds: Cond[], join: 'AND' | 'OR'): string | undefined {
  if (!conds.length) return undefined;
  return conds.map((c) => `VarOperation:${c.name},${c.op},${c.value}`).join(` VarTestsLogicalOperator:${join} `);
}

export interface Op {
  name: string;
  op: string;
  value: string;
}

// Operations that fall outside name,op,value are kept as raw text so nothing is lost.
export function parseOps(raw: string | undefined): (Op | { raw: string })[] {
  return (raw ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const [name, op, value, ...rest] = token.split(',');
      return name && op && value !== undefined && !rest.length ? { name, op, value } : { raw: token };
    });
}

export function formatOps(ops: (Op | { raw: string })[]): string | undefined {
  const text = ops.map((o) => ('raw' in o ? o.raw : `${o.name},${o.op},${o.value}`)).join(' ');
  return text || undefined;
}

// --- names ------------------------------------------------------------------------------

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

// "Есть ключ" -> "est_klyuch". Names written in Latin letters stay readable in the .valkyrie file.
export function factId(label: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let base = label
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base) base = 'fact';
  if (/^\d/.test(base)) base = 'f_' + base;
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}_${i}`;
  return id;
}

const isSystem = (name: string) => name.startsWith('$') || name.startsWith('#');

// Every variable the scenario already talks about, plus the ones the author named.
export function knownFacts(s: Scenario, labels: Record<string, string>): string[] {
  const names = new Set(Object.keys(labels));
  const add = (n: string) => {
    if (n && !isSystem(n) && !/^-?\d+(\.\d+)?$/.test(n)) names.add(n);
  };
  for (const c of s.components) {
    for (const o of parseOps(c.data.operations)) if (!('raw' in o)) add(o.name);
    for (const key of Object.keys(c.data)) {
      if (key === 'vartests' || /^event\d+Condition$/.test(key)) for (const t of parseTests(c.data[key]).conds) add(t.name);
    }
  }
  return [...names].sort();
}

export const factLabel = (labels: Record<string, string>, id: string) => labels[id] ?? id;

// --- plain-language sentences ---------------------------------------------------------------

export type CondKind = 'yes' | 'no' | 'ge' | 'le' | 'gt' | 'lt' | 'eq';

export function condKind(c: Cond): CondKind {
  if ((c.op === '>' || c.op === '!=') && c.value === '0') return 'yes';
  if (c.op === '==' && c.value === '0') return 'no';
  if (c.op === '>=') return 'ge';
  if (c.op === '<=') return 'le';
  if (c.op === '>') return 'gt';
  if (c.op === '<') return 'lt';
  return 'eq';
}

export const COND_KINDS: { kind: CondKind; label: string; numeric: boolean }[] = [
  { kind: 'yes', label: 'уже известно (да)', numeric: false },
  { kind: 'no', label: 'ещё неизвестно (нет)', numeric: false },
  { kind: 'ge', label: 'число не меньше', numeric: true },
  { kind: 'le', label: 'число не больше', numeric: true },
  { kind: 'gt', label: 'число больше', numeric: true },
  { kind: 'lt', label: 'число меньше', numeric: true },
  { kind: 'eq', label: 'число ровно', numeric: true },
];

export function withKind(c: Cond, kind: CondKind): Cond {
  switch (kind) {
    case 'yes':
      return { ...c, op: '>', value: '0' };
    case 'no':
      return { ...c, op: '==', value: '0' };
    case 'ge':
      return { ...c, op: '>=', value: numeric(c.value, '1') };
    case 'le':
      return { ...c, op: '<=', value: numeric(c.value, '1') };
    case 'gt':
      return { ...c, op: '>', value: numeric(c.value, '0') };
    case 'lt':
      return { ...c, op: '<', value: numeric(c.value, '1') };
    case 'eq':
      return { ...c, op: '==', value: numeric(c.value, '1') };
  }
}

const numeric = (v: string, fallback: string) => (/^-?\d+(\.\d+)?$/.test(v) && v !== '0' ? v : fallback);

export function describeCond(c: Cond, labels: Record<string, string>): string {
  const name = `«${factLabel(labels, c.name)}»`;
  const kind = condKind(c);
  if (kind === 'yes') return `${name}: уже известно`;
  if (kind === 'no') return `${name}: ещё неизвестно`;
  const word = { ge: 'не меньше', le: 'не больше', gt: 'больше', lt: 'меньше', eq: 'ровно' }[kind];
  return `${name}: число ${word} ${c.value}`;
}

export type OpKind = 'true' | 'false' | 'inc' | 'dec' | 'set';

export const OP_KINDS: { kind: OpKind; label: string }[] = [
  { kind: 'true', label: 'становится известным (да)' },
  { kind: 'false', label: 'снова неизвестно (нет)' },
  { kind: 'inc', label: 'число растёт на 1' },
  { kind: 'dec', label: 'число уменьшается на 1' },
  { kind: 'set', label: 'записать число' },
];

export function opKind(o: Op): OpKind | null {
  if (o.op === '=' && o.value === '1') return 'true';
  if (o.op === '=' && o.value === '0') return 'false';
  if (o.op === '+' && o.value === '1') return 'inc';
  if (o.op === '-' && o.value === '1') return 'dec';
  if (o.op === '=' && /^-?\d+(\.\d+)?$/.test(o.value)) return 'set';
  return null;
}

export function withOpKind(o: Op, kind: OpKind): Op {
  switch (kind) {
    case 'true':
      return { ...o, op: '=', value: '1' };
    case 'false':
      return { ...o, op: '=', value: '0' };
    case 'inc':
      return { ...o, op: '+', value: '1' };
    case 'dec':
      return { ...o, op: '-', value: '1' };
    case 'set':
      return { ...o, op: '=', value: /^-?\d+(\.\d+)?$/.test(o.value) ? o.value : '2' };
  }
}

// --- evaluation (used by the play-through) ------------------------------------------------------

export type Vars = Record<string, number>;

const valueOf = (v: string, vars: Vars) => (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : (vars[v] ?? 0));

export function testCond(c: Cond, vars: Vars): boolean {
  const a = vars[c.name] ?? 0;
  const b = valueOf(c.value, vars);
  switch (c.op) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '>':
      return a > b;
    case '<':
      return a < b;
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
  }
  return false;
}

// Parentheses are not supported here: such conditions count as met, so the walk-through never gets stuck on them.
export function testsPass(raw: string | undefined, vars: Vars): boolean {
  const p = parseTests(raw);
  if (!p.conds.length || !p.simple) return true;
  return p.join === 'OR' ? p.conds.some((c) => testCond(c, vars)) : p.conds.every((c) => testCond(c, vars));
}

export function runOps(raw: string | undefined, vars: Vars): Vars {
  const next = { ...vars };
  for (const o of parseOps(raw)) {
    if ('raw' in o) continue;
    const v = valueOf(o.value, next);
    const a = next[o.name] ?? 0;
    if (o.op === '=') next[o.name] = v;
    else if (o.op === '+') next[o.name] = a + v;
    else if (o.op === '-') next[o.name] = a - v;
    else if (o.op === '*') next[o.name] = a * v;
    else if (o.op === '/' && v !== 0) next[o.name] = a / v;
  }
  return next;
}
