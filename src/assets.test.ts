import { describe, expect, it } from 'vitest';
import { newScenario } from './format/scenario';
import { assetBytes, soundUrl } from './assets';

describe('package files', () => {
  const s = { ...newScenario('Russian'), assets: { 'English/intro.ogg': new Uint8Array([1]), 'Russian/intro.ogg': new Uint8Array([2]), 'door.ogg': new Uint8Array([3]), 'Cover.JPG': new Uint8Array([4]) } };

  it('finds a file by name wherever it sits, ignoring case', () => {
    expect(assetBytes(s, 'cover.jpg')?.[0]).toBe(4);
    expect(assetBytes(s, 'missing.jpg')).toBeUndefined();
  });

  it('prefers the language folder for sounds and skips Valkyrie\'s own sounds', () => {
    expect(soundUrl(s, 'intro.ogg', 'Russian')).toBeTruthy();
    expect(soundUrl(s, 'intro.ogg', 'Russian')).not.toBe(soundUrl(s, 'intro.ogg', 'English'));
    expect(soundUrl(s, 'door.ogg', 'Russian')).toBeTruthy();
    expect(soundUrl(s, 'AudioImportant2', 'Russian')).toBeUndefined();
    expect(soundUrl(s, 'nothere.ogg', 'Russian')).toBeUndefined();
  });
});
