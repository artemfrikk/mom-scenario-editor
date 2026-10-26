import { describe, expect, it } from 'vitest';
import { condKind, factId, formatOps, formatTests, parseOps, parseTests, runOps, testsPass, withKind } from './facts';

describe('facts', () => {
  it('round-trips conditions', () => {
    const raw = 'VarOperation:rock,>,0 VarTestsLogicalOperator:OR VarOperation:key,==,0';
    const p = parseTests(raw);
    expect(p).toEqual({ conds: [{ name: 'rock', op: '>', value: '0' }, { name: 'key', op: '==', value: '0' }], join: 'OR', simple: true });
    expect(formatTests(p.conds, p.join)).toBe(raw);
  });
  it('flags conditions it cannot show', () => {
    expect(parseTests('VarTestsParenthesis:( VarOperation:a,>,0 VarTestsParenthesis:)').simple).toBe(false);
    expect(parseTests('VarOperation:a,>,0 VarTestsLogicalOperator:AND VarOperation:b,>,0 VarTestsLogicalOperator:OR VarOperation:c,>,0').simple).toBe(false);
  });
  it('keeps unknown operations', () => {
    const ops = parseOps('key,=,1 broken');
    expect(formatOps(ops)).toBe('key,=,1 broken');
  });
  it('makes latin ids from Russian names', () => {
    expect(factId('Есть ключ', [])).toBe('est_klyuch');
    expect(factId('Есть ключ', ['est_klyuch'])).toBe('est_klyuch_2');
    expect(factId('!!!', [])).toBe('fact');
  });
  it('evaluates', () => {
    const vars = runOps('key,=,1 coins,+,1 coins,+,1', {});
    expect(vars).toEqual({ key: 1, coins: 2 });
    expect(testsPass('VarOperation:key,>,0', vars)).toBe(true);
    expect(testsPass('VarOperation:coins,>=,3', vars)).toBe(false);
    expect(testsPass('VarOperation:door,==,0', vars)).toBe(true);
  });
  it('switches kinds', () => {
    const c = withKind({ name: 'a', op: '>', value: '0' }, 'ge');
    expect(c).toEqual({ name: 'a', op: '>=', value: '1' });
    expect(condKind(c)).toBe('ge');
    expect(condKind(withKind(c, 'no'))).toBe('no');
  });
});
