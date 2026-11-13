import { describe, expect, it } from 'vitest';
import { getComponent } from '../model/ops';
import { newGame } from '../model/game';
import { usedAssets } from './campaign';
import { compile } from './compile';
import { newProject, type Project } from './project';

function sample(): Project {
  return {
    ...newProject(),
    title: 'Звук',
    rooms: [
      { id: 'R1', tile: 'TileSideHall1', x: 0, y: 0, rot: 0, enterText: '', sound: 'AudioClock', music: 'AudioAtmosphere3' },
      { id: 'R2', tile: 'TileSideStudy', x: 7, y: 0, rot: 0, enterText: 'Кабинет.', sound: 'creak.ogg', music: 'AudioAtmosphere5' },
    ],
    pieces: [
      { id: 'P1', room: 'R1', kind: 'start', look: 'TokenInvestigators', x: 1, y: -1, title: '', outcome: { text: '', once: true } },
      { id: 'P3', room: 'R1', kind: 'explore', look: 'TokenExplore', x: 2, y: -1, title: '', outcome: { text: 'Дверь.', once: true, reveal: ['R2'], sound: 'AudioDoorCreak1' } },
      { id: 'P4', room: 'R2', kind: 'monster', look: 'MonsterCultist', x: 8, y: -1, title: '', appear: 'roar.ogg', outcome: { text: '', once: true, win: true } },
    ],
    endSound: { win: 'AudioFinale1', lose: 'AudioGameOver' },
    startItems: [
      { id: '7', item: 'ItemCommonKnife' },
      { id: '8', kind: 'weapon' },
      { id: '9', kind: 'spell' },
    ],
    nextId: 10,
  };
}

describe('sounds', () => {
  it('rooms, tokens, monsters and endings play their sounds; rooms switch the music', () => {
    const s = compile(sample());
    expect(getComponent(s, 'EventStart')!.data).toMatchObject({ music: 'AudioAtmosphere3', audio: 'AudioClock' });
    expect(getComponent(s, 'EventOpenR2')!.data).toMatchObject({ audio: 'creak.ogg', music: 'AudioAtmosphere5' });
    expect(getComponent(s, 'EventP3')!.data.audio).toBe('AudioDoorCreak1');
    expect(getComponent(s, 'SpawnP4')!.data.audio).toBe('roar.ogg');
    expect(getComponent(s, 'EventWin')!.data.audio).toBe('AudioFinale1');
    expect(getComponent(s, 'EventLose')!.data.audio).toBe('AudioGameOver');
  });

  it('own sound files are packed', () => {
    const used = usedAssets(sample());
    expect(used.has('creak.ogg')).toBe(true);
    expect(used.has('roar.ogg')).toBe(true);
  });
});

describe('start items', () => {
  it('chosen and random items are starting QItems', () => {
    const s = compile(sample());
    expect(getComponent(s, 'QItemStart7')!.data).toMatchObject({ itemname: 'ItemCommonKnife', starting: 'True' });
    expect(getComponent(s, 'QItemStart8')!.data).toMatchObject({ traits: 'common weapon', starting: 'True' });
    expect(getComponent(s, 'QItemStart9')!.data.traits).toBe('spell');
    expect(newGame(s, ['A'], () => 0).items).toEqual(['QItemStart7', 'QItemStart8', 'QItemStart9']);
  });
});
