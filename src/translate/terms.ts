// Words of the Russian edition of Mansions of Madness that machine translators get wrong,
// and a small helper to find and replace words across all translations.

export const GLOSSARY: [string, string][] = [
  ['Investigator', 'сыщик'],
  ['Damage', 'урон'],
  ['Horror', 'ужас'],
  ['Clue', 'улика'],
  ['Test', 'проверка'],
  ['Mythos phase', 'фаза мифа'],
  ['Investigation phase', 'фаза сыщиков'],
  ['Health', 'здоровье'],
  ['Sanity', 'рассудок'],
  ['Willpower', 'воля'],
  ['Lore', 'знания'],
  ['Observation', 'наблюдательность'],
  ['Agility', 'ловкость'],
  ['Strength', 'сила'],
  ['Influence', 'влияние'],
  ['Common item', 'обычный предмет'],
  ['Unique item', 'уникальный предмет'],
  ['Spell', 'заклинание'],
  ['Condition', 'состояние'],
];

// Google calls investigators "следователи" or "исследователи". Rewrite every case form to "сыщик".
const ENDING: Record<string, string> = { ь: '', я: 'а', ю: 'у', ем: 'ом', е: 'е', и: 'и', ей: 'ов', ям: 'ам', ями: 'ами', ях: 'ах' };
const INVESTIGATOR = /(?<!\p{L})([СсИи])(?:сследовател|ледовател)(ями|ям|ях|ей|ем|ь|я|ю|е|и)(?!\p{L})/gu;

export function fixInvestigator(text: string): string {
  return text.replace(INVESTIGATOR, (_m, first: string, ending: string) => (first === first.toUpperCase() ? 'С' : 'с') + 'ыщик' + (ENDING[ending] ?? ''));
}

// Fixes machine translation of one text, knowing the original.
export function fixTerms(source: string, translation: string): string {
  return /investigator/i.test(source) ? fixInvestigator(translation) : translation;
}

export function countMatches(text: string, find: string, caseSensitive: boolean): number {
  if (!find) return 0;
  const a = caseSensitive ? text : text.toLowerCase();
  const b = caseSensitive ? find : find.toLowerCase();
  let n = 0;
  for (let i = a.indexOf(b); i !== -1; i = a.indexOf(b, i + b.length)) n++;
  return n;
}

export function replaceAll(text: string, find: string, replacement: string, caseSensitive: boolean): string {
  if (!find) return text;
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, caseSensitive ? 'g' : 'gi'), () => replacement);
}
