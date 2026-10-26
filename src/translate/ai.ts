// Translating through a chat assistant (ChatGPT, Claude and the like): the page builds a request with
// a portion of texts, the person pastes the answer back. Usually better than Google for long story texts.

import { LANGUAGE_LABEL } from '../ui/labels';
import { GLOSSARY } from './terms';

const LANG_GENITIVE: Record<string, string> = {
  Russian: 'русский',
  English: 'английский',
  German: 'немецкий',
  French: 'французский',
  Spanish: 'испанский',
  Italian: 'итальянский',
  Polish: 'польский',
  Ukrainian: 'украинский',
};

export function aiPrompt(items: { key: string; text: string }[], target: string): string {
  const to = LANG_GENITIVE[target] ?? LANGUAGE_LABEL[target] ?? target;
  const data: Record<string, string> = {};
  for (const i of items) data[i.key] = i.text;
  const glossary = target === 'Russian' ? '\nТермины русского издания игры: ' + GLOSSARY.map(([a, b]) => `${a} — ${b}`).join('; ') + '.' : '';
  return [
    `Переведи на ${to} язык тексты сценария настольной игры «Особняки безумия» (Mansions of Madness, 2-я редакция).`,
    'Пиши художественно и атмосферно, в духе Лавкрафта, обращайся к игрокам на «вы».',
    'Ничего не меняй внутри фигурных скобок {…} и угловых скобок <…>: это значки и команды игры. Переносы строк сохрани.' + glossary,
    'Ответь только JSON-объектом с теми же ключами и переводами вместо значений, без пояснений.',
    '',
    JSON.stringify(data, null, 1),
  ].join('\n');
}

// Reads the assistant's answer: a JSON object, possibly wrapped in ```json fences or chatter.
export function parseAiAnswer(answer: string): Record<string, string> {
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('В ответе не нашлось JSON с переводом. Скопируйте ответ целиком.');
  let data: unknown;
  try {
    data = JSON.parse(answer.substring(start, end + 1));
  } catch {
    throw new Error('Ответ обрезан или испорчен: не получается прочитать JSON. Попросите ассистента повторить ответ целиком.');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
  return out;
}
