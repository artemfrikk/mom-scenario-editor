// Pieces of a Valkyrie text that must survive translation unchanged:
// {will}, {c:Component}, {var:x}, {rnd:hero}, {ffg:KEY}, <b>, <color=#f00>, </i> and the like.
// Machine translators mangle them ({will} becomes {будет}, < 1 > gets spaces), so they are swapped
// for numbered [N] marks before translating and put back afterwards.

const TOKEN = /\{[^{}\n]+\}|<\/?[a-zA-Z][^<>\n]*>|\[\d+\]/g;

export function tokensOf(text: string): string[] {
  return text.match(TOKEN) ?? [];
}

export interface Masked {
  text: string;
  tokens: string[];
}

export function protect(text: string): Masked {
  const tokens: string[] = [];
  const masked = text.replace(TOKEN, (t) => {
    tokens.push(t);
    return `[${tokens.length}]`;
  });
  return { text: masked, tokens };
}

// Puts the tokens back. Translators sometimes write "[ 1 ]" or "[1 ]", so spacing is forgiven.
export function restore(translated: string, tokens: string[]): { text: string; ok: boolean } {
  const used = new Array<number>(tokens.length).fill(0);
  const text = translated.replace(/\[\s*(\d+)\s*\]/g, (m, n: string) => {
    const i = Number(n) - 1;
    if (i < 0 || i >= tokens.length) return m;
    used[i]++;
    return tokens[i];
  });
  return { text, ok: used.every((u) => u === 1) };
}

export interface TokenProblem {
  missing: string[];
  extra: string[];
}

// Compares the special pieces of the original and the translation, as multisets.
export function tokenProblems(source: string, translation: string): TokenProblem | null {
  const count = (list: string[]) => {
    const m = new Map<string, number>();
    for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  };
  const a = count(tokensOf(source));
  const b = count(tokensOf(translation));
  const missing: string[] = [];
  const extra: string[] = [];
  for (const [t, n] of a) for (let i = b.get(t) ?? 0; i < n; i++) missing.push(t);
  for (const [t, n] of b) for (let i = a.get(t) ?? 0; i < n; i++) extra.push(t);
  return missing.length || extra.length ? { missing, extra } : null;
}

// Texts with nothing to translate: empty, a dash, numbers, or only special pieces.
export function needsNoTranslation(text: string): boolean {
  return !/\p{L}/u.test(text.replace(TOKEN, ''));
}
