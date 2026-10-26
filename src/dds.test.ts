import { describe, expect, it } from 'vitest';
import { decodeDds } from './dds';

function header(w: number, h: number, cc: string): Uint8Array {
  const b = new Uint8Array(128);
  const v = new DataView(b.buffer);
  v.setUint32(0, 0x20534444, true);
  v.setUint32(4, 124, true);
  v.setUint32(12, h, true);
  v.setUint32(16, w, true);
  v.setUint32(76, 32, true);
  v.setUint32(80, 4, true);
  for (let i = 0; i < 4; i++) b[84 + i] = cc.charCodeAt(i);
  return b;
}

describe('dds', () => {
  it('decodes a solid red DXT1 block', () => {
    const file = new Uint8Array([...header(4, 4, 'DXT1'), 0x00, 0xf8, 0x00, 0xf8, 0, 0, 0, 0]);
    const p = decodeDds(file.buffer)!;
    expect([...p.data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect(p.width).toBe(4);
  });
  it('reads DXT5 alpha', () => {
    const file = new Uint8Array([...header(4, 4, 'DXT5'), 128, 128, 0, 0, 0, 0, 0, 0, 0x1f, 0x00, 0x1f, 0x00, 0, 0, 0, 0]);
    const p = decodeDds(file.buffer)!;
    expect(p.data[3]).toBe(128);
  });
  it('flips rows', () => {
    // 4x8 picture: top block red, bottom block blue
    const file = new Uint8Array([...header(4, 8, 'DXT1'), 0x00, 0xf8, 0x00, 0xf8, 0, 0, 0, 0, 0x1f, 0x00, 0x1f, 0x00, 0, 0, 0, 0]);
    const p = decodeDds(file.buffer, true)!;
    expect([...p.data.slice(0, 3)]).toEqual([0, 0, 255]);
  });
  it('rejects junk', () => {
    expect(decodeDds(new ArrayBuffer(200))).toBeNull();
  });
});
