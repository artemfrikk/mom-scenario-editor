import { describe, expect, it } from 'vitest';
import { roomsOf } from './rooms';
import { sampleScenario } from './sample';

describe('rooms', () => {
  it('lists the room of the sample with its start event', () => {
    const rooms = roomsOf(sampleScenario('Russian').scenario);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].shownBy).toContain('EventStart');
  });
});
