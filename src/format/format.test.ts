import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIni } from './ini';
import { parseLocalization, serializeLocalization } from './localization';
import { newScenario } from './scenario';
import { loadValkyrie, saveValkyrieBytes, scenarioFromFiles, scenarioToFiles } from './valkyrie';

describe('ini', () => {
  it('reads sections like Valkyrie', () => {
    const ini = parseIni(
      '; comment\r\n[Quest]\r\nformat=18\r\nformat=19\r\nimage="a b.png"\r\n\r\n[QuestData]\r\nevents.ini\r\n[Quest]\r\nformat=1\r\n',
    );
    expect(ini.sections.get('Quest')).toEqual({ format: '18', image: 'a b.png' });
    expect(Object.keys(ini.sections.get('QuestData')!)).toEqual(['events.ini']);
  });
});

describe('localization', () => {
  it('round-trips newlines, quotes and commas', () => {
    const entries = new Map([
      ['a.text', 'plain'],
      ['b.text', 'line1\nline2, with comma'],
      ['c.text', 'He said "run"'],
      ['d.text', 'Кириллица'],
    ]);
    const text = serializeLocalization({ language: 'Russian', entries });
    const back = parseLocalization(text);
    expect(back.language).toBe('Russian');
    expect(back.entries).toEqual(entries);
  });

  it('reads multi-line quoted blocks', () => {
    const back = parseLocalization('.,English\n"x.text","first\nsecond"\ny.text,ok');
    expect(back.entries.get('y.text')).toBe('ok');
  });
});

describe('valkyrie package', () => {
  it('round-trips a new scenario', async () => {
    const s = newScenario('Russian');
    const back = await loadValkyrie(await saveValkyrieBytes(s));
    expect(back.quest).toEqual(s.quest);
    expect(back.components).toEqual(s.components);
    expect(back.texts).toEqual(s.texts);
  });

  // A real community scenario, if present locally (not committed).
  const fixture = new URL('../../test/fixtures/ExoticMaterial.valkyrie', import.meta.url);
  it.skipIf(!existsSync(fixture))('round-trips a real scenario without losing data', async () => {
    const original = await loadValkyrie(readFileSync(fixture));
    expect(original.components.length).toBeGreaterThan(100);
    expect(original.texts.English['EventStart.text']).toContain('meteorite');

    const again = scenarioFromFiles(scenarioToFiles(original));
    expect(again.quest).toEqual(original.quest);
    expect(again.components).toEqual(original.components);
    expect(again.texts).toEqual(original.texts);
    expect(Object.keys(again.assets).sort()).toEqual(Object.keys(original.assets).sort());
  });
});
