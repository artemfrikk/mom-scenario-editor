import { describe, expect, it } from 'vitest';
import { newScenario } from '../format/scenario';
import { newGame, touch } from './game';
import { hasIntro, readIntro, removeIntro, setIntro } from './intro';
import { addComponent, getComponent, updateData } from './ops';

const L = 'Russian';
const rng = () => 0;

describe('intro', () => {
  it('puts a cutscene before the story and the first room appears after Continue', () => {
    let s = newScenario(L);
    let tile: string;
    [s, tile] = addComponent(s, 'Tile', { side: 'TileSideHall', xposition: '0', yposition: '0' }, 'Hall');
    s = updateData(s, 'EventStart', { add: tile });
    s = setIntro(s, L, { text: 'Давным-давно…', button: 'Начать', image: 'cover.jpg' });
    expect(hasIntro(s)).toBe(true);
    expect(readIntro(s, L)).toEqual({ text: 'Давным-давно…', button: 'Начать', image: 'cover.jpg' });
    let st = newGame(s, ['А'], rng);
    expect(st.current).toBeNull(); // the screen is up, no window
    expect(st.visible).toContain('UIIntroductionText');
    expect(st.visible).toContain('UIIntroductionImage');
    expect(st.visible).not.toContain(tile);
    st = touch(s, st, 'UIIntroductionContinueText', rng);
    expect(st.visible).toContain(tile);
    expect(st.visible).not.toContain('UIIntroductionText');
    expect(st.visible).not.toContain('UIIntroductionImage');
  });

  it('changes and drops the picture, and can be removed', () => {
    let s = setIntro(newScenario(L), L, { text: 'A', button: '', image: 'a.jpg' });
    s = setIntro(s, L, { text: 'B', button: '', image: '' });
    expect(getComponent(s, 'UIIntroductionImage')).toBeUndefined();
    expect(getComponent(s, 'UIIntroductionContinueText')?.data.remove).not.toContain('UIIntroductionImage');
    expect(readIntro(s, L).text).toBe('B');
    expect(readIntro(s, L).button).toBe('Продолжить');
    s = removeIntro(s);
    expect(hasIntro(s)).toBe(false);
    expect(newGame(s, ['А'], rng).current).toBe('EventStart');
  });
});
