import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  solve, createSolver, transpositionCheck, adjacentPairScores, completeKeyLengths, bigramScore, letterCodes,
  SOLVER_MAX_KEY, CHI_TRANSPOSITION, PAIR_GOOD, PAIR_BAD
} from '../js/columnar-solver.js';
import { BIGRAM_LOG10X100, BIGRAM_TOTAL, ENGLISH_FREQ } from '../js/english-stats.js';
import { encrypt, decrypt, parseKeyword, keyFromOrder } from '../js/columnar-core.js';

const W = 'WEAREDISCOVEREDFLEEATONCE';
const DICKENS = 'ITWASTHEBESTOFTIMESITWASTHEWORSTOFTIMESITWASTHEAGEOFWISDOMITWASTHEAGEOFFOOLISHNESS';
const rot13 = s => [...s].map(ch => String.fromCharCode(((ch.charCodeAt(0) - 65 + 13) % 26) + 65)).join('');

test('英語の統計の形', () => {
  assert.equal(BIGRAM_LOG10X100.length, 676);
  assert.ok(BIGRAM_LOG10X100.every(v => Number.isInteger(v) && v < 0));
  assert.equal(BIGRAM_TOTAL, 1148778);
  // 最も多い組は TH、最も少ない組の1つは QZ
  const ix = (a, b) => (a.charCodeAt(0) - 65) * 26 + (b.charCodeAt(0) - 65);
  assert.equal(Math.max(...BIGRAM_LOG10X100), BIGRAM_LOG10X100[ix('T', 'H')]);
  assert.equal(BIGRAM_LOG10X100[ix('Q', 'Z')], Math.min(...BIGRAM_LOG10X100));
  assert.equal(ENGLISH_FREQ.length, 26);
  assert.equal(Math.round(ENGLISH_FREQ.reduce((s, v) => s + v, 0)), 100);
  // 生成物の見出しに出典が書いてある
  const src = readFileSync(new URL('../js/english-stats.js', import.meta.url), 'utf8');
  assert.match(src, /Project Gutenberg #1342 Pride and Prejudice/);
  assert.match(src, /#98 A Tale of Two Cities/);
});

test('英字の符号化と英語らしさ', () => {
  assert.deepEqual([...letterCodes('aZ-é😀')], [0, 25, -1, -1, -1]);
  assert.equal(bigramScore('TH').score, -152);
  assert.equal(bigramScore('A').score, null);
  assert.ok(bigramScore('THEQUICKBROWNFOX').score > bigramScore('QXZJKVQXZJ').score);
});

test('総当たりで正解の鍵が1位になる（参照実装と同じ結果）', () => {
  const cases = [
    ['EVLNACDTESEAROFODEECWIREE', 'ZEBRAS', false, -224.4],
    ['EVLNXACDTXESEAXROFOXDEECXWIREE', 'ZEBRAS', true, -255.2],
    ['TCNMRZUOJVLGQRXOEOHKFPTYEBOSHDIWUEA', 'CIPHER', false, -288.9]
  ];
  for (const [cipher, word, complete, score] of cases) {
    const top = solve(cipher)[0];
    assert.equal(top.text, decrypt(cipher, parseKeyword(word), { complete }).text, word);
    assert.equal(top.n, word.length);
    assert.equal(top.complete, complete);
    assert.equal(top.score, score);
    assert.deepEqual(top.key.order, keyFromOrder(top.order).order);
  }
});

test('既知の単語（クリブ）で候補を絞る', () => {
  const cipher = encrypt('ATTACKATDAWN', keyFromOrder([3, 1, 0, 2, 4]), { complete: false }).cipher;
  assert.equal(cipher, 'ADTANAKWTTCA');
  assert.equal(solve(cipher, { limit: 50 }).findIndex(c => c.text === 'ATTACKATDAWN'), -1);
  const withCrib = solve(cipher, { limit: 50, crib: 'dawn' });
  assert.equal(withCrib.findIndex(c => c.text === 'ATTACKATDAWN') + 1, 12);
  assert.ok(withCrib.every(c => c.text.includes('DAWN')));
});

test('同じ平文になる候補はまとめ、鍵長の範囲を守る', () => {
  const r = solve(W, { limit: 30 });
  assert.equal(new Set(r.map(c => c.text)).size, r.length);
  assert.ok(r.every(c => c.n >= 2 && c.n <= SOLVER_MAX_KEY));
  const s = createSolver('ABCDEFGHIJKL', { minKey: 3, maxKey: 4, modes: ['complete'] });
  assert.equal(s.total, 2);
  while (s.step()) { /* 進める */ }
  assert.equal(s.tried, 6 + 24);
  assert.deepEqual(completeKeyLengths(30), [2, 3, 5, 6]);
  assert.deepEqual(completeKeyLengths(7), [7]);
});

test('転置か換字かの見分け方（Day034 と同じ基準）', () => {
  const t = transpositionCheck(encrypt(DICKENS, parseKeyword('KEY'), { complete: false }).cipher);
  assert.deepEqual(t, { verdict: 'transposition', letters: 82, chi: 47.8 });
  assert.equal(transpositionCheck(rot13(DICKENS)).verdict, 'substitution');
  assert.equal(transpositionCheck('ABC').verdict, 'short');
  assert.equal(CHI_TRANSPOSITION, 80);
});

test('作業台の色分け: 正しい並びは自然、でたらめな並びは不自然が多い', () => {
  const right = adjacentPairScores(decrypt('EVLNACDTESEAROFODEECWIREE', parseKeyword('ZEBRAS'), { complete: false }).grid);
  const wrong = adjacentPairScores(decrypt('EVLNACDTESEAROFODEECWIREE', parseKeyword('ABCDEF'), { complete: false }).grid);
  assert.equal(right.length, 5);
  assert.deepEqual(right.map(p => p.level), ['good', 'good', 'good', 'fair', 'good']);
  assert.deepEqual(wrong.map(p => p.level), ['bad', 'bad', 'bad', 'bad', 'good']);
  assert.ok(PAIR_GOOD > PAIR_BAD);
});
