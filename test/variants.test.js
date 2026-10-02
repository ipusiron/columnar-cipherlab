import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseKeyword, parseNumericKey, parseAnyKey, keyFromOrder, encrypt, decrypt, encryptDouble, decryptDouble, randomNulls,
  displayRank, readOrder, stripTrailingPadding
} from '../js/columnar-core.js';

const W = 'WEAREDISCOVEREDFLEEATONCE';
const mysz = word => parseKeyword(word, { myszkowski: true });

// Myszkowski 式の独立した参照実装（同じ文字の列をまとめ、行ごとに左から読む）
function refMysz(plain, word, complete, pad = 'X') {
  const n = word.length;
  const total = complete ? Math.ceil(plain.length / n) * n : plain.length;
  const text = plain + pad.repeat(total - plain.length);
  let out = '';
  for (const ch of [...new Set(word)].sort()) {
    for (let r = 0; r * n < total; r++) {
      for (let c = 0; c < n; c++) if (word[c] === ch && r * n + c < total) out += text[r * n + c];
    }
  }
  return out;
}

test('Myszkowski式（Wikipedia の TOMATO の例）', () => {
  assert.deepEqual(displayRank(mysz('TOMATO')), [4, 3, 2, 1, 4, 3]);
  assert.equal(encrypt(W, mysz('TOMATO'), { complete: false }).cipher, 'ROFOACDTEDSEEEACWEIVRLENE');
  assert.equal(encrypt(W, mysz('TOMATO'), { complete: true, padChar: 'X' }).cipher, 'ROFOXACDTXEDSEEEACXXWEIVRLENEX');
  assert.equal(decrypt('ROFOACDTEDSEEEACWEIVRLENE', mysz('TOMATO'), { complete: false }).text, W);
  assert.deepEqual(displayRank(mysz('BALLOON')), [2, 1, 3, 3, 5, 5, 4]);
  assert.equal(encrypt('ATTACKATDAWN', mysz('BALLOON'), { complete: false }).cipher, 'TDATTAAWACKN');
});

test('同じ文字のないキーワードでは Myszkowski 式と標準は同じ', () => {
  for (const w of ['ZEBRAS', 'KEY', 'CIPHER']) {
    assert.equal(encrypt(W, mysz(w), { complete: false }).cipher, encrypt(W, parseKeyword(w), { complete: false }).cipher, w);
  }
});

test('Myszkowski式の往復（参照実装と全組み合わせで一致）', () => {
  const alpha = 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOGPACKMYBOXWITHFIVEDOZENLIQUORJUGS';
  let count = 0;
  for (const word of ['TOMATO', 'BALLOON', 'AAB', 'ABBA', 'MISSISSIPPI', 'AAAA']) {
    const key = mysz(word);
    for (let L = 1; L <= 40; L++) {
      const plain = alpha.slice(0, L).replace(/Q$/, 'A');
      for (const complete of [false, true]) {
        const e = encrypt(plain, key, { complete, padChar: 'Q' });
        assert.equal(e.cipher, refMysz(plain, word, complete, 'Q'), `${word} ${L} ${complete}`);
        const d = decrypt(e.cipher, key, { complete });
        assert.equal(complete ? stripTrailingPadding(d.text, 'Q', key.n).text : d.text, plain);
        assert.equal(e.segments.reduce((s, x) => s + x.length, 0), e.cipher.length);
        count++;
      }
    }
  }
  assert.equal(count, 480);
});

test('Myszkowski式の区切りは同じ文字の列のまとまりごと', () => {
  const e = encrypt(W, mysz('TOMATO'), { complete: false });
  assert.deepEqual(e.segments.map(s => [s.cols, s.length]), [[[3], 4], [[2], 4], [[1, 5], 8], [[0, 4], 9]]);
});

test('二重転置（Wikipedia の ZEBRAS→STRIPE の例）', () => {
  const r = encryptDouble(W, parseKeyword('ZEBRAS'), parseKeyword('STRIPE'));
  assert.equal(r.first.cipher, 'EVLNACDTESEAROFODEECWIREE');
  assert.equal(r.cipher, 'CAEENSOIAEDRLEFWEDREEVTOC');
  assert.deepEqual(displayRank(parseKeyword('STRIPE')), [5, 6, 4, 2, 3, 1]);
  const back = decryptDouble('CAEENSOIAEDRLEFWEDREEVTOC', parseKeyword('ZEBRAS'), parseKeyword('STRIPE'));
  assert.equal(back.second.text, 'EVLNACDTESEAROFODEECWIREE');
  assert.equal(back.text, W);
  assert.equal(encryptDouble('', parseKeyword('KEY'), parseKeyword('AB')).error.key, 'enc.empty');
  assert.equal(decryptDouble('', parseKeyword('KEY'), parseKeyword('AB')).error.key, 'dec.empty');
});

test('鍵の欄の値を見分ける・読み出し順から鍵を作る', () => {
  assert.equal(parseAnyKey('ZEBRAS').type, 'keyword');
  assert.equal(parseAnyKey('3 1 4 2').type, 'numeric');
  assert.equal(parseAnyKey('A1').error.key, 'key.mixed');
  assert.equal(parseAnyKey('3 1 X').error.key, 'key.mixed');
  const k = keyFromOrder([4, 2, 1, 3, 5, 0]);
  assert.deepEqual(k.order, parseKeyword('ZEBRAS').order);
  assert.deepEqual(displayRank(k), [6, 3, 2, 4, 1, 5]);
  assert.equal(k.source, '5 3 2 4 6 1');
});

test('readOrder は行優先の通し番号を読み出し順に並べる', () => {
  assert.deepEqual(readOrder(5, parseKeyword('KEY'), false), [1, 4, 0, 3, 2]);
  assert.deepEqual(readOrder(5, parseKeyword('KEY'), true), [1, 4, 0, 3, 2, 5]);
  assert.deepEqual(readOrder(6, mysz('AAB'), true), [0, 1, 3, 4, 2, 5]);
});

test('埋字を文字列で渡す（Wikipedia の QKJEU の例）', () => {
  const r = encrypt(W, parseKeyword('ZEBRAS'), { complete: true, padText: 'QKJEU' });
  assert.equal(r.cipher, 'EVLNEACDTKESEAQROFOJDEECUWIREE');
  assert.equal(r.padCount, 5);
  assert.equal(r.endsWithPad, false);
  assert.deepEqual(r.grid[4].map(c => c.kind), ['plain', 'pad', 'pad', 'pad', 'pad', 'pad']);
  assert.equal(encrypt(W, parseKeyword('ZEBRAS'), { complete: true, padText: 'QKJE' }).error.key, 'pad.invalid');
  assert.equal(encrypt(W, parseKeyword('ZEBRAS'), { complete: true, padText: 'QKJE1' }).error.key, 'pad.invalid');
  assert.equal(encrypt(W, parseKeyword('ZEBRAS'), { complete: false, padText: '' }).cipher, 'EVLNACDTESEAROFODEECWIREE');
});

test('ランダムな英字（ヌル）は A〜Z だけで、偏りの元になる値を捨てる', () => {
  assert.match(randomNulls(500), /^[A-Z]{500}$/);
  assert.equal(randomNulls(0), '');
  // 0〜233 は使い、234〜255 は捨てる（26 の倍数 234 までに限ると各文字の確率が等しい）
  let call = 0;
  const fake = buf => {
    if (call++ === 0) { buf.fill(255); buf.set([0, 25, 233, 234, 255]); } else { buf.fill(1); }
    return buf;
  };
  assert.equal(randomNulls(4, fake), 'AZZB');
});
