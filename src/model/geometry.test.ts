import { describe, expect, it } from 'vitest';
import { junction, overlaps, placeBeside, tileBox } from './geometry';

describe('geometry', () => {
  it('computes boxes for unrotated and turned tiles', () => {
    expect(tileBox(0, 0, 7, 3.5, 0)).toEqual({ minX: 0, maxX: 7, minY: -3.5, maxY: 0 });
    const turned = tileBox(0, 0, 7, 3.5, 90);
    expect(turned.maxX - turned.minX).toBeCloseTo(3.5);
    expect(turned.maxY - turned.minY).toBeCloseTo(7);
  });
  it('places beside and avoids taken sides', () => {
    const a = tileBox(0, 0, 7, 3.5, 0);
    const right = placeBeside(a, 7, 3.5, 'right', [a])!;
    expect(right).toMatchObject({ x: 7, y: 0, side: 'right' });
    const blocked = placeBeside(a, 7, 3.5, 'right', [a, tileBox(7, 0, 7, 3.5, 0)])!;
    expect(blocked.side).toBe('down');
    expect(overlaps(a, tileBox(blocked.x, blocked.y, 7, 3.5, 0))).toBe(false);
  });
  it('finds the shared wall', () => {
    const a = tileBox(0, 0, 7, 3.5, 0);
    expect(junction(a, tileBox(7, 0, 7, 3.5, 0))).toEqual({ x: 7, y: -1.75, rot: 0 });
    expect(junction(a, tileBox(0, -3.5, 7, 3.5, 0))).toEqual({ x: 3.5, y: -3.5, rot: 90 });
    expect(junction(a, tileBox(20, 0, 7, 3.5, 0))).toBeNull();
  });
});
