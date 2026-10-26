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
// Google refuses anything over 5000 characters in one request.
const BATCH_CHARS = 4500;

export type Fetch = typeof fetch;
export type Engine = 'google' | 'browser';

export interface MachineResult {
  text: string;
  // false when some {special} piece got lost and the translation needs a look
  ok: boolean;
}

export interface MachineOptions {
  fetchImpl?: Fetch;
  signal?: AbortSignal;
  engine?: Engine;
  // Google limits how much one computer may translate in a row. It answers with an error (or a captcha page the
  // browser can't read), so the work pauses and tries again; onWait shows the pause on screen.
  onWait?: (seconds: number) => void;
  waits?: number[];
}

const WAITS = [10, 30, 60, 120, 300];

export class ThrottledError extends Error {
  constructor() {
    super(
      'Google временно ограничил перевод с вашего компьютера: слишком много текста подряд. Уже переведённое сохранено. Подождите полчаса и нажмите «Перевести» снова: перевод продолжится с того же места.',
    );
  }
}

const sleep = (seconds: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, seconds * 1000);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });

async function google(text: string, from: string, to: string, opts: MachineOptions & { fetchImpl: Fetch }): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${from}&tl=${to}`;
  const waits = opts.waits ?? WAITS;
  for (let attempt = 0; ; attempt++) {
    let status = 0;
    try {
      const res = await opts.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'q=' + encodeURIComponent(text),
        signal: opts.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as [[string, string][]];
        return (data[0] ?? []).map((part) => part[0] ?? '').join('');
      }
      status = res.status;
      if (status !== 429 && status < 500) throw new Error(`Google ответил ошибкой ${status}`);
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      // A network error here is almost always Google's "unusual traffic" page, which the browser is not allowed to read.
      if (!(e instanceof TypeError) && status === 0) throw e;
    }
    if (attempt >= waits.length) throw new ThrottledError();
    opts.onWait?.(waits[attempt]);
    await sleep(waits[attempt], opts.signal);
    opts.onWait?.(0);
    if (opts.signal?.aborted) throw new DOMException('Остановлено', 'AbortError');
  }
}

// Chrome's built-in translator (Chrome 138+): works on the computer itself, so there is no limit on how much.
interface BrowserTranslator {
  translate(text: string, o?: { signal?: AbortSignal }): Promise<string>;
}
interface TranslatorApi {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<BrowserTranslator>;
}
const browserApi = () => (globalThis as unknown as { Translator?: TranslatorApi }).Translator;
const shortCode = (lang: string) => (GOOGLE_CODE[lang] ?? 'en').split('-')[0];

export async function browserEngineAvailable(from: string, to: string): Promise<boolean> {
  const api = browserApi();
  if (!api) return false;
  try {
    const a = await api.availability({ sourceLanguage: shortCode(from), targetLanguage: shortCode(to) });
    return a !== 'unavailable' && a !== 'no';
  } catch {
    return false;
  }
}

const translators = new Map<string, Promise<BrowserTranslator>>();
// Chrome may need to download its language model first, which it allows only right after a click.
export function prepareBrowserEngine(from: string, to: string): void {
  if (browserApi()) void browserTranslator(from, to).catch(() => {});
}

function browserTranslator(from: string, to: string): Promise<BrowserTranslator> {
  const key = from + '>' + to;
  let t = translators.get(key);
  if (!t) {
    t = browserApi()!.create({ sourceLanguage: shortCode(from), targetLanguage: shortCode(to) });
    t.catch(() => translators.delete(key));
    translators.set(key, t);
  }
  return t;
}

function fromGoogle(text: string, original: string): string {
  // Google drops leading/trailing spaces and sometimes adds a space before a line break.
  const lead = original.match(/^\s*/)![0];
  const trail = original.match(/\s*$/)![0];
  return lead + text.replace(/ +\n/g, '\n').trim() + trail;
}

// Translates texts in order. onDone is called after every finished text so the screen can fill in as it goes.
export async function translateAll(
  texts: string[],
  from: string,
  to: string,
  onDone: (index: number, result: MachineResult) => void,
  opts: MachineOptions = {},
): Promise<void> {
  const o = { ...opts, fetchImpl: opts.fetchImpl ?? fetch.bind(window) };
  const sl = GOOGLE_CODE[from] ?? 'auto';
  const tl = GOOGLE_CODE[to] ?? 'ru';

  if (opts.engine === 'browser') {
    const t = await browserTranslator(from, to);
    let next = 0;
    const worker = async () => {
      while (next < texts.length && !opts.signal?.aborted) {
        const i = next++;
        const masked = protect(texts[i]);
        // Line by line: the built-in translator is made for sentences and may drop line breaks.
        const lines = await Promise.all(masked.text.split('\n').map((l) => (l.trim() ? t.translate(l, { signal: opts.signal }).then((r) => fromGoogle(r, l)) : l)));
        onDone(i, restore(lines.join('\n'), masked.tokens));
      }
    };
    await Promise.all([worker(), worker()]);
    return;
  }

  const translateOne = async (i: number) => {
    const masked = protect(texts[i]);
    const out = await google(masked.text, sl, tl, o);
    onDone(i, restore(fromGoogle(out, masked.text), masked.tokens));
  };

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
    if (batch.length === 1) return translateOne(batch[0]);
    const masked = batch.map((i) => protect(texts[i]));
    const joined = masked.map((m) => m.text).join(`\n${SEPARATOR}\n`);
    const out = await google(joined, sl, tl, o);
    const parts = out.split(new RegExp(`\\s*${SEPARATOR}\\s*`));
    if (parts.length === batch.length) {
      batch.forEach((i, k) => onDone(i, restore(fromGoogle(parts[k], masked[k].text), masked[k].tokens)));
    } else {
      for (const i of batch) {
        if (opts.signal?.aborted) return;
        await translateOne(i);
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
