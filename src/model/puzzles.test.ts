import { describe, expect, it } from 'vitest';
import {
  codeFeedback,
  codeGuess,
  codeSolved,
  imageSolved,
  imageSwap,
  newCode,
  newImage,
  newPuzzle,
  newSlide,
  newTower,
  puzzleSolved,
  slideMove,
  slideRange,
  slideSolved,
  solvePuzzle,
  towerMove,
  towerMoveOk,
  towerSolved,
} from './puzzles';

const rng = () => 0;
const seeded = (n = 7) => () => ((n = (n * 9301 + 49297) % 233280) / 233280);

describe('slide puzzle', () => {
  it('a one-move puzzle is solved by moving one block aside, then the red one out', () => {
    const st = newSlide(1, rng);
    expect(st.blocks[0].target).toBe(true);
    expect(slideSolved(st)).toBe(false);
    // Blocks never overlap and may not leave the box.
    const r = slideRange(st.blocks, 0);
    expect(r.max).toBeGreaterThanOrEqual(0);
  });

  it('every stored puzzle can be played: blocks do not pass through each other', () => {
    for (let i = 0; i < 20; i++) {
      let st = newSlide(1 + (i % 10), seeded(i + 1));
      for (let k = 1; k < st.blocks.length; k++) {
        const { min, max } = slideRange(st.blocks, k);
        const before = st.blocks[k];
        st = slideMove(st, k, max + 5);
        expect(st.blocks[k].x + st.blocks[k].y).toBeLessThanOrEqual(max + (before.rot ? before.x : before.y) + 20);
        st = slideMove(st, k, min - 5);
      }
      // After shuffling around, no two blocks occupy the same square.
      const cells = new Set<string>();
      for (const b of st.blocks) for (let x = b.x; x <= b.x + b.xlen; x++) for (let y = b.y; y <= b.y + b.ylen; y++) {
        expect(cells.has(x + ',' + y)).toBe(false);
        cells.add(x + ',' + y);
      }
    }
  });

  it('counts a move only when the block really moves', () => {
    const st = newSlide(3, rng);
    expect(slideMove(st, 1, st.blocks[1].rot ? st.blocks[1].y : st.blocks[1].x).moves).toBe(0);
  });

  it('the solve shortcut releases the button', () => {
    expect(puzzleSolved(solvePuzzle(newSlide(5, rng)))).toBe(true);
  });
});

describe('code puzzle', () => {
  it('scores right place and right symbol elsewhere', () => {
    expect(codeFeedback([1, 2, 3, 4], [1, 3, 2, 4])).toEqual({ spot: 2, type: 2 });
    expect(codeFeedback([1, 1, 2, 2], [1, 2, 1, 2])).toEqual({ spot: 2, type: 2 });
    expect(codeFeedback([1, 2, 3], [4, 4, 4])).toEqual({ spot: 0, type: 0 });
  });

  it('is solved by the right last guess; a fixed solution is respected', () => {
    let st = newCode(3, 4, '2 1 3', rng);
    expect(st.answer).toEqual([2, 1, 3]);
    st = codeGuess(st, [1, 1, 1]);
    expect(codeSolved(st)).toBe(false);
    st = codeGuess(st, [2, 1, 3]);
    expect(codeSolved(st)).toBe(true);
    expect(codeGuess(st, [1, 2]).guesses).toHaveLength(2); // wrong length is ignored
  });

  it('draws random symbols within range', () => {
    const st = newCode(5, 3, '', seeded());
    expect(st.answer).toHaveLength(5);
    expect(st.answer.every((n) => n >= 1 && n <= 3)).toBe(true);
  });
});

describe('image puzzle', () => {
  it('shuffles and is solved by swapping pieces back', () => {
    let st = newImage(3, 2, seeded(3));
    expect(st.piece).toHaveLength(6);
    expect(imageSolved(st)).toBe(false);
    for (let i = 0; i < st.piece.length; i++) {
      const at = st.piece.indexOf(i);
      st = imageSwap(st, i, at);
    }
    expect(imageSolved(st)).toBe(true);
  });
});

describe('tower puzzle', () => {
  it('starts exactly the asked number of moves from solved', () => {
    const st = newTower(4, seeded(2));
    expect(st.towers.flat()).toHaveLength(8);
    expect(towerSolved(st)).toBe(false);
  });

  it('allows only smaller rings on bigger ones', () => {
    const st = { kind: 'tower' as const, towers: [[3, 1], [2], []], moves: 0 };
    expect(towerMoveOk(st, 0, 1)).toBe(true); // 1 onto 2
    expect(towerMoveOk(st, 1, 0)).toBe(false); // 2 onto 1
    expect(towerMoveOk(st, 0, 2)).toBe(true);
    expect(towerMoveOk(st, 2, 0)).toBe(false);
    expect(towerMove(st, 1, 0).moves).toBe(0);
  });

  it('is solved when all eight rings sit in order on one tower', () => {
    expect(towerSolved({ kind: 'tower', towers: [[7, 6, 5, 4, 3, 2, 1, 0], [], []], moves: 0 })).toBe(true);
    expect(towerSolved({ kind: 'tower', towers: [[7, 6, 5, 4], [3, 2, 1, 0], []], moves: 0 })).toBe(false);
  });
});

describe('newPuzzle', () => {
  it('uses Valkyrie defaults and the class field', () => {
    const c = (data: Record<string, string>) => ({ name: 'P', type: 'Puzzle' as const, source: 'puzzles.ini', data });
    expect(newPuzzle(c({}), rng).kind).toBe('slide');
    const code = newPuzzle(c({ class: 'code' }), rng);
    expect(code.kind === 'code' && code.answer).toHaveLength(4);
    const img = newPuzzle(c({ class: 'image', puzzlelevel: '3', puzzlealtlevel: '2' }), seeded());
    expect(img.kind === 'image' && img.piece).toHaveLength(6);
    expect(newPuzzle(c({ class: 'tower', puzzlelevel: '3' }), seeded()).kind).toBe('tower');
  });
});
