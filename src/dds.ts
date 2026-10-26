// Valkyrie keeps the game's pictures as .dds files, which browsers cannot show.
// This reads the top level of a DDS file (DXT1, DXT3, DXT5 or plain 32/24-bit) into RGBA pixels.

export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, top row first
}

const fourCC = (s: string) => s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24);

function expand565(c: number): [number, number, number] {
  const r = (c >> 11) & 31;
  const g = (c >> 5) & 63;
  const b = c & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

// Writes one 4x4 colour block. `fourColor` forces the opaque 4-colour mode that DXT3/DXT5 always use.
function colorBlock(src: Uint8Array, at: number, out: Uint8ClampedArray, bx: number, by: number, w: number, h: number, fourColor: boolean) {
  const c0 = src[at] | (src[at + 1] << 8);
  const c1 = src[at + 2] | (src[at + 3] << 8);
  const a = expand565(c0);
  const b = expand565(c1);
  const palette: number[][] = [[...a, 255], [...b, 255], [], []];
  if (fourColor || c0 > c1) {
    palette[2] = [0, 1, 2].map((i) => Math.floor((2 * a[i] + b[i]) / 3)).concat(255);
    palette[3] = [0, 1, 2].map((i) => Math.floor((a[i] + 2 * b[i]) / 3)).concat(255);
  } else {
    palette[2] = [0, 1, 2].map((i) => (a[i] + b[i]) >> 1).concat(255);
    palette[3] = [0, 0, 0, 0];
  }
  const bits = (src[at + 4] | (src[at + 5] << 8) | (src[at + 6] << 16) | (src[at + 7] << 24)) >>> 0;
  for (let i = 0; i < 16; i++) {
    const x = bx + (i & 3);
    const y = by + (i >> 2);
    if (x >= w || y >= h) continue;
    const p = palette[(bits >>> (2 * i)) & 3];
    const o = (y * w + x) * 4;
    out[o] = p[0];
    out[o + 1] = p[1];
    out[o + 2] = p[2];
    out[o + 3] = p[3];
  }
}

function alphaBlock5(src: Uint8Array, at: number, out: Uint8ClampedArray, bx: number, by: number, w: number, h: number) {
  const a0 = src[at];
  const a1 = src[at + 1];
  const table = [a0, a1];
  if (a0 > a1) for (let i = 1; i <= 6; i++) table.push(Math.floor(((7 - i) * a0 + i * a1) / 7));
  else {
    for (let i = 1; i <= 4; i++) table.push(Math.floor(((5 - i) * a0 + i * a1) / 5));
    table.push(0, 255);
  }
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 3; i++) lo |= src[at + 2 + i] << (8 * i);
  for (let i = 0; i < 3; i++) hi |= src[at + 5 + i] << (8 * i);
  for (let i = 0; i < 16; i++) {
    const x = bx + (i & 3);
    const y = by + (i >> 2);
    if (x >= w || y >= h) continue;
    const idx = i < 8 ? (lo >> (3 * i)) & 7 : (hi >> (3 * (i - 8))) & 7;
    out[(y * w + x) * 4 + 3] = table[idx];
  }
}

function alphaBlock3(src: Uint8Array, at: number, out: Uint8ClampedArray, bx: number, by: number, w: number, h: number) {
  for (let i = 0; i < 16; i++) {
    const x = bx + (i & 3);
    const y = by + (i >> 2);
    if (x >= w || y >= h) continue;
    const nibble = (src[at + (i >> 1)] >> ((i & 1) * 4)) & 15;
    out[(y * w + x) * 4 + 3] = nibble * 17;
  }
}

// `flip` turns the picture over: Unity stores textures bottom row first.
export function decodeDds(buffer: ArrayBuffer, flip = true): Pixels | null {
  const src = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (src.length < 128 || view.getUint32(0, true) !== 0x20534444) return null; // "DDS "
  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  if (!width || !height || width > 8192 || height > 8192) return null;
  const pfFlags = view.getUint32(80, true);
  const cc = view.getUint32(84, true);
  const bitCount = view.getUint32(88, true);
  let offset = 128;
  let kind: 'dxt1' | 'dxt3' | 'dxt5' | 'raw' | null = null;
  let masks = [view.getUint32(92, true), view.getUint32(96, true), view.getUint32(100, true), view.getUint32(104, true)];

  if (pfFlags & 4) {
    if (cc === fourCC('DXT1')) kind = 'dxt1';
    else if (cc === fourCC('DXT3')) kind = 'dxt3';
    else if (cc === fourCC('DXT5')) kind = 'dxt5';
    else if (cc === fourCC('DX10')) {
      const dxgi = view.getUint32(128, true);
      offset = 148;
      if (dxgi === 71 || dxgi === 72) kind = 'dxt1';
      else if (dxgi === 74 || dxgi === 75) kind = 'dxt3';
      else if (dxgi === 77 || dxgi === 78) kind = 'dxt5';
      else if (dxgi === 28 || dxgi === 29) {
        kind = 'raw';
        masks = [0xff, 0xff00, 0xff0000, 0xff000000];
      } else if (dxgi === 87 || dxgi === 91) {
        kind = 'raw';
        masks = [0xff0000, 0xff00, 0xff, 0xff000000];
      }
    }
  } else if (pfFlags & 0x40 && (bitCount === 32 || bitCount === 24)) kind = 'raw';
  if (!kind) return null;

  const data = new Uint8ClampedArray(width * height * 4);
  if (kind === 'raw') {
    const bytes = kind === 'raw' && (pfFlags & 4) ? 4 : bitCount / 8;
    const shift = masks.map((m) => (m ? 31 - Math.clz32(m & -m) : 0));
    for (let i = 0; i < width * height; i++) {
      const at = offset + i * bytes;
      if (at + bytes > src.length) return null;
      let v = 0;
      for (let k = 0; k < bytes; k++) v |= src[at + k] << (8 * k);
      v >>>= 0;
      data[i * 4] = (v & masks[0]) >>> shift[0];
      data[i * 4 + 1] = (v & masks[1]) >>> shift[1];
      data[i * 4 + 2] = (v & masks[2]) >>> shift[2];
      data[i * 4 + 3] = masks[3] ? (v & masks[3]) >>> shift[3] : 255;
    }
  } else {
    const size = kind === 'dxt1' ? 8 : 16;
    let at = offset;
    for (let by = 0; by < height; by += 4) {
      for (let bx = 0; bx < width; bx += 4) {
        if (at + size > src.length) return null;
        if (kind === 'dxt1') colorBlock(src, at, data, bx, by, width, height, false);
        else {
          colorBlock(src, at + 8, data, bx, by, width, height, true);
          if (kind === 'dxt3') alphaBlock3(src, at, data, bx, by, width, height);
          else alphaBlock5(src, at, data, bx, by, width, height);
        }
        at += size;
      }
    }
  }

  if (flip) {
    const row = width * 4;
    const tmp = new Uint8ClampedArray(row);
    for (let y = 0; y < height >> 1; y++) {
      const a = y * row;
      const b = (height - 1 - y) * row;
      tmp.set(data.subarray(a, a + row));
      data.copyWithin(a, b, b + row);
      data.set(tmp, b);
    }
  }
  return { width, height, data };
}

// A DDS file as a PNG the browser can show. Null when the file is not one this reader understands.
export async function ddsToPng(file: Blob): Promise<Blob | null> {
  const pixels = decodeDds(await file.arrayBuffer());
  if (!pixels) return null;
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height), 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}
