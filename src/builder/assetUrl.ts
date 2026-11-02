// A browser address for a picture or sound the author added to the package.

import type { Assets } from '../build/project';

const urls = new WeakMap<Uint8Array, string>();
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav' };

export function assetUrl(assets: Assets, name: string): string | undefined {
  const bytes = name ? assets[name] : undefined;
  if (!bytes) return undefined;
  let url = urls.get(bytes);
  if (!url) {
    url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? '' }));
    urls.set(bytes, url);
  }
  return url;
}

