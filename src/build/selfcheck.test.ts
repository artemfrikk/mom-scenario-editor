import { describe, expect, it } from 'vitest';
import { saveValkyrieBytes } from '../format/valkyrie';
import { chaptersOf, compileCampaign } from './campaign';
import { checkCampaign, checkProject } from './check';
import { compile } from './compile';
import { selfCheck } from './selfcheck';
import { solve } from './solver';

describe('the self-check campaign', () => {
  it('compiles, has no problems and can be won', async () => {
    const p = selfCheck();
    const chapters = chaptersOf(p);
    expect(chapters.length).toBe(2);
    chapters.forEach((c, i) => expect([...checkProject(c), ...checkCampaign(chapters, i)].filter((x) => x.level === 'error')).toEqual([]));
    const v = await solve(chapters[0], compile(chapters[0]), (x) => x.title);
    expect(v.win).toBe(true);
    expect(v.traps).toEqual([]);
    const s = compileCampaign(chapters, {});
    const bytes = await saveValkyrieBytes(s);
    expect(bytes.length).toBeGreaterThan(1000);
    const out = process.env.SELFCHECK_OUT;
    if (out) {
      const fs = await import('node:fs');
      fs.writeFileSync(out, bytes);
    }
  });
});
