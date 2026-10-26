import { existsSync, readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseLocalization } from '../format/localization';
import { aiPrompt, parseAiAnswer } from './ai';
import { translateAll, type Fetch } from './machine';
import { addQuestText, buildPackage, openPackage, setQuestKey } from './package';
import { buildGroups } from './rows';
import { fixInvestigator } from './terms';
import { needsNoTranslation, protect, restore, tokenProblems } from './tokens';

describe('tokens', () => {
  it('protects and restores game marks', () => {
    const m = protect('Test {will} <b>now</b> and see {c:QItemKey}. [1]');
    expect(m.text).toBe('Test [1] [2]now[3] and see [4]. [5]');
    expect(restore('Проверьте [ 1 ] [2]сейчас[3 ] и [4]. [5]', m.tokens)).toEqual({
      text: 'Проверьте {will} <b>сейчас</b> и {c:QItemKey}. [1]',
      ok: true,
    });
    expect(restore('Проверьте [1]', m.tokens).ok).toBe(false);
  });

  it('finds lost and added marks', () => {
    expect(tokenProblems('Gain {clue}', 'Получите улику')).toEqual({ missing: ['{clue}'], extra: [] });
    expect(tokenProblems('Gain {clue}', 'Получите {clue}')).toBeNull();
  });

  it('knows what needs no translation', () => {
    expect(needsNoTranslation('{qst:CONTINUE}')).toBe(true);
    expect(needsNoTranslation(' - 3 ')).toBe(true);
    expect(needsNoTranslation('Continue')).toBe(false);
  });
});

describe('terms', () => {
  it('turns machine "следователь" into "сыщик" in every case', () => {
    expect(fixInvestigator('Следователи должны помочь следователю. Каждый исследователь и нет следователей.')).toBe(
      'Сыщики должны помочь сыщику. Каждый сыщик и нет сыщиков.',
    );
  });
});

describe('machine translation', () => {
  const fakeGoogle = (translate: (q: string) => string): Fetch =>
    (async (_url: string, init?: RequestInit) => {
      const q = decodeURIComponent(String(init!.body).substring(2));
      return new Response(JSON.stringify([[[translate(q), q]]]), { status: 200 });
    }) as unknown as Fetch;

  it('sends texts in one batch and puts marks back', async () => {
    let calls = 0;
    const out: string[] = [];
    await translateAll(
      ['Gain {clue}.', 'Line one\nLine two'],
      'English',
      'Russian',
      (i, r) => (out[i] = r.text),
      {
        fetchImpl: fakeGoogle((q) => {
          calls++;
          return q.replace('Gain', 'Получите').replace('Line', 'Строка').replace('Line', 'Строка');
        }),
      },
    );
    expect(calls).toBe(1);
    expect(out).toEqual(['Получите {clue}.', 'Строка one\nСтрока two']);
  });

  it('falls back to one text per request when the batch does not split back', async () => {
    let calls = 0;
    const out: string[] = [];
    await translateAll(['A', 'B'], 'English', 'Russian', (i, r) => (out[i] = r.text), {
      fetchImpl: fakeGoogle((q) => {
        calls++;
        return q.replace(/\s*⁂\s*/, ' ') + '!';
      }),
    });
    expect(calls).toBe(3);
    expect(out).toEqual(['A!', 'B!']);
  });
});

describe('chat assistant', () => {
  it('builds a request and reads a fenced answer', () => {
    expect(aiPrompt([{ key: 'a.text', text: 'Hi' }], 'Russian')).toContain('"a.text": "Hi"');
    expect(parseAiAnswer('Вот:\n```json\n{"a.text": "Привет\\nмир"}\n```')).toEqual({ 'a.text': 'Привет\nмир' });
    expect(() => parseAiAnswer('нет')).toThrow();
  });
});

describe('quest.ini edits', () => {
  it('adds the language file once and keeps the rest', () => {
    const ini = '[Quest]\r\nformat=18\r\n\r\n[QuestText]\r\nLocalization.English.txt\r\n\r\n[QuestData]\r\nevents.ini\r\n';
    const once = addQuestText(ini, 'Localization.Russian.txt');
    expect(once).toBe('[Quest]\r\nformat=18\r\n\r\n[QuestText]\r\nLocalization.Russian.txt\r\nLocalization.English.txt\r\n\r\n[QuestData]\r\nevents.ini\r\n');
    expect(addQuestText(once, 'Localization.Russian.txt')).toBe(once);
    expect(addQuestText('[Quest]\nformat=18\n', 'L.txt')).toBe('[Quest]\nformat=18\n\n[QuestText]\nL.txt\n');
  });

  it('sets a [Quest] key', () => {
    expect(setQuestKey('[Quest]\nname.English=A\nname.Russian=Б\n[X]\n', 'name.Russian', 'В\nГ')).toBe('[Quest]\nname.English=A\nname.Russian=В Г\n[X]\n');
    expect(setQuestKey('[Quest]\nformat=18\n', 'name.Russian', 'В')).toBe('[Quest]\nname.Russian=В\nformat=18\n');
  });
});

async function makePackage(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('quest.ini', '[Quest]\r\nformat=18\r\ndefaultlanguage=English\r\nname.English=Lighthouse\r\n\r\n[QuestText]\r\nLocalization.English.txt\r\n\r\n[QuestData]\r\nevents.ini\r\n');
  zip.file('events.ini', '[EventStart]\r\nbuttons=1\r\n\r\n[TokenSearch]\r\nx=1\r\n');
  zip.file(
    'Localization.English.txt',
    '.,English\r\nquest.name,Lighthouse\r\nEventStart.text,"He said ""run"",\\nthen left."\r\nEventStart.button1,{qst:CONTINUE}\r\nCONTINUE,Continue\r\nTokenSearch.text,Search {will}',
  );
  zip.file('picture.png', new Uint8Array([1, 2, 3]));
  return zip.generateAsync({ type: 'uint8array' });
}

describe('package', () => {
  it('groups texts by scenario part', async () => {
    const pkg = await openPackage(await makePackage(), 'test.valkyrie');
    const groups = buildGroups(pkg, 'English', 'Russian');
    expect(groups.map((g) => [g.type, g.title, g.rows.map((r) => r.field)])).toEqual([
      ['quest', 'О сценарии', ['Название сценария']],
      ['Event', 'Start', ['Текст', 'Кнопка 1']],
      ['Token', 'Search', ['Текст']],
      ['other', 'Прочее', ['CONTINUE']],
    ]);
    expect(groups[1].rows[0].source).toBe('He said "run",\nthen left.');
  });

  it('writes the translation in a form Valkyrie reads, and leaves other files alone', async () => {
    const pkg = await openPackage(await makePackage(), 'test.valkyrie');
    const blob = await buildPackage(
      pkg,
      'English',
      'Russian',
      new Map([
        ['quest.name', 'Маяк'],
        ['EventStart.text', 'Он сказал "беги",\nи ушёл.'],
        ['CONTINUE', ''],
      ]),
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const ru = parseLocalization(await zip.file('Localization.Russian.txt')!.async('string'));
    expect(ru.language).toBe('Russian');
    expect([...ru.entries]).toEqual([
      ['quest.name', 'Маяк'],
      ['EventStart.text', 'Он сказал "беги",\nи ушёл.'],
    ]);
    const ini = await zip.file('quest.ini')!.async('string');
    expect(ini).toContain('[QuestText]\r\nLocalization.Russian.txt\r\nLocalization.English.txt');
    expect(ini).toContain('name.Russian=Маяк');
    expect([...(await zip.file('picture.png')!.async('uint8array'))]).toEqual([1, 2, 3]);

    // A second build (after more work) replaces the file instead of adding a second one.
    const again = await JSZip.loadAsync(await (await buildPackage(pkg, 'English', 'Russian', new Map([['quest.name', 'Маяк 2']]))).arrayBuffer());
    expect(Object.keys(again.files).filter((f) => f.includes('Russian'))).toEqual(['Localization.Russian.txt']);
    expect((await again.file('quest.ini')!.async('string')).match(/Localization\.Russian/g)).toHaveLength(1);
  });

  // Real published scenario, downloaded by hand: VALKYRIE_SAMPLE=/path/TheFallofHouseLynch.valkyrie npm test
  const sample = process.env.VALKYRIE_SAMPLE;
  it.skipIf(!sample || !existsSync(sample))('opens and rebuilds a real scenario', async () => {
    const pkg = await openPackage(readFileSync(sample!), 'sample.valkyrie');
    const groups = buildGroups(pkg, 'English', 'Russian');
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.length).toBe(pkg.texts.English.size);
    const map = new Map(rows.map((r) => [r.key, r.source + ' (ru)']));
    const zip = await JSZip.loadAsync(await (await buildPackage(pkg, 'English', 'Russian', map)).arrayBuffer());
    const ru = parseLocalization(await zip.file('Localization.Russian.txt')!.async('string'));
    for (const r of rows) expect(ru.entries.get(r.key)).toBe(r.source + ' (ru)');
  });
});

describe('markup for the text field', () => {
  it('shows colours as styled text and game marks as blocks', async () => {
    const { toHtml, tokenLabel } = await import('./markup');
    expect(toHtml('Сыщик на <color=Cyan>{c:TileDock}</color> и {clue}\nдальше', (k) => (k === 'TileDock.name' ? 'Пирс' : undefined))).toBe(
      'Сыщик на <span class="tk-color" data-color="Cyan" style="color:Cyan"><span class="tk" contenteditable="false" data-t="{c:TileDock}" title="{c:TileDock}">Пирс</span></span> и <span class="tk" contenteditable="false" data-t="{clue}" title="{clue}">🔎</span><br>дальше',
    );
    // an unpaired tag stays a visible block instead of swallowing the rest of the text
    expect(toHtml('a </b> b')).toContain('data-t="&lt;/b&gt;"');
    expect(tokenLabel('{qst:CONTINUE}', () => 'Продолжить')).toBe('«Продолжить»');
  });
});
