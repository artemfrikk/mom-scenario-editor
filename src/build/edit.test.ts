import { describe, expect, it } from 'vitest';
import { reverseOf } from '../model/tiles';
import { addPiece, addRoom, flipRoom } from './edit';
import { newProject } from './project';

describe('flipRoom', () => {
  it('turns the card over and keeps the room and its pieces in place', () => {
    let [p, room] = addRoom(newProject(), 'TileSideAlley1');
    [p] = addPiece(p, room, 'search', 'TokenSearch');
    const before = p.rooms[0];
    const flipped = flipRoom(p, room);
    expect(flipped.rooms[0].tile).toBe(reverseOf('TileSideAlley1'));
    expect(flipped.rooms[0]).toMatchObject({ x: before.x, y: before.y, rot: before.rot });
    expect(flipped.pieces).toEqual(p.pieces);
    expect(flipRoom(flipped, room).rooms[0].tile).toBe('TileSideAlley1');
  });
});
