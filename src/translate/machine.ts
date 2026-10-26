// Machine translation through Google Translate's free web endpoint (the one the browser extension uses).
// It needs no key and allows calls from any page. Several texts go in one request, split by a line
// with a mark that Google leaves alone; if the answer does not split back cleanly, each text is sent alone.

import { protect, restore } from './tokens';

export const GOOGLE_CODE: Record<string, string> = {
  English: 'en',
  Russian: 'ru',
  German: 'de',
  French: 'fr',
  Spanish: 'es',
  Italian: 'it',
  Polish: 'pl',
  Portuguese: 'pt',
  Chinese: 'zh-CN',
  Korean: 'ko',
  Czech: 'cs',
  Japanese: 'ja',
  Ukrainian: 'uk',
  Hungarian: 'hu',
  Dutch: 'nl',
};

const SEPARATOR = '⁂';
const BATCH_CHARS = 3000;

export type Fetch = typeof fetch;

export interface MachineResult {
  text: string;
  // false when some {special} piece got lost and the translation needs a look
  ok: boolean;
}

async function google(text: string, from: string, to: string, fetchImpl: Fetch, signal?: AbortSignal): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${from}&tl=${to}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'q=' + encodeURIComponent(text),
      signal,
    });
    if (res.ok) {
      const data = (await res.json()) as [[string, string][]];
      return (data[0] ?? []).map((part) => part[0] ?? '').join('');
    }
    if (attempt >= 3 || (res.status !== 429 && res.status < 500)) {
      throw new Error(res.status === 429 ? 'Google просит подождать: слишком много запросов. Попробуйте через несколько минут.' : `Google ответил ошибкой ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
}

function fromGoogle(text: string, original: string): string {
  // Google drops leading/trailing spaces and sometimes adds a space before a line break.
  const lead = original.match(/^\s*/)![0];
  const trail = original.match(/\s*$/)![0];
  return lead + text.replace(/ +\n/g, '\n').trim() + trail;
}

async function translateOne(text: string, from: string, to: string, fetchImpl: Fetch, signal?: AbortSignal): Promise<MachineResult> {
  const masked = protect(text);
  const out = await google(masked.text, from, to, fetchImpl, signal);
  return restore(fromGoogle(out, masked.text), masked.tokens);
}

// Translates texts in order. onDone is called after every finished text so the screen can fill in as it goes.
export async function translateAll(
  texts: string[],
  from: string,
  to: string,
  onDone: (index: number, result: MachineResult) => void,
  opts: { fetchImpl?: Fetch; signal?: AbortSignal } = {},
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch.bind(window);
  const sl = GOOGLE_CODE[from] ?? 'auto';
  const tl = GOOGLE_CODE[to] ?? 'ru';

  // Group neighbours into requests of a few thousand characters.
  const batches: number[][] = [];
  let current: number[] = [];
  let size = 0;
  texts.forEach((t, i) => {
    const len = t.length + 5;
    if (current.length && (size + len > BATCH_CHARS || t.includes(SEPARATOR))) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(i);
    size += len;
  });
  if (current.length) batches.push(current);

  const run = async (batch: number[]) => {
    if (opts.signal?.aborted) return;
    if (batch.length === 1) {
      onDone(batch[0], await translateOne(texts[batch[0]], sl, tl, fetchImpl, opts.signal));
      return;
    }
    const masked = batch.map((i) => protect(texts[i]));
    const joined = masked.map((m) => m.text).join(`\n${SEPARATOR}\n`);
    const out = await google(joined, sl, tl, fetchImpl, opts.signal);
    const parts = out.split(new RegExp(`\\s*${SEPARATOR}\\s*`));
    if (parts.length === batch.length) {
      batch.forEach((i, k) => onDone(i, restore(fromGoogle(parts[k], masked[k].text), masked[k].tokens)));
    } else {
      for (const i of batch) {
        if (opts.signal?.aborted) return;
        onDone(i, await translateOne(texts[i], sl, tl, fetchImpl, opts.signal));
      }
    }
  };

  // A few requests at a time: fast enough, and Google does not start refusing.
  let next = 0;
  const worker = async () => {
    while (next < batches.length && !opts.signal?.aborted) await run(batches[next++]);
  };
  await Promise.all([worker(), worker(), worker()]);
}
