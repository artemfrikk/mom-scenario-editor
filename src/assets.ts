// Pictures and sounds that travel inside the .valkyrie package, made ready for the browser.

import type { Scenario } from './format/scenario';

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav' };
const urls = new WeakMap<Uint8Array, string>();

// The file named by a scenario field such as `image=cover.jpg`, wherever it sits in the package.
export function assetBytes(s: Scenario, name: string): Uint8Array | undefined {
  if (!name) return undefined;
  if (s.assets[name]) return s.assets[name];
  const key = Object.keys(s.assets).find((k) => k.split('/').pop()?.toLowerCase() === name.toLowerCase());
  return key ? s.assets[key] : undefined;
}

export function assetUrl(s: Scenario, name: string): string | undefined {
  const bytes = assetBytes(s, name);
  if (!bytes) return undefined;
  let url = urls.get(bytes);
  if (!url) {
    const type = MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
    url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
    urls.set(bytes, url);
  }
  return url;
}

// A sound named by an event. Language folders (English/intro.ogg) are tried for the scenario's language first.
export function soundUrl(s: Scenario, name: string, lang: string): string | undefined {
  if (!name || !/\.(ogg|mp3|wav)$/i.test(name)) return undefined; // Valkyrie's own sounds (AudioImportant2) are not in the package
  const keys = Object.keys(s.assets);
  const same = (k: string) => k.split('/').pop()?.toLowerCase() === name.toLowerCase();
  const key = keys.find((k) => same(k) && k.toLowerCase().startsWith(lang.toLowerCase() + '/')) ?? keys.find(same);
  return key ? assetUrl(s, key) : undefined;
}
