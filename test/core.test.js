import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_INPUT_LENGTH, MAX_KEY_LENGTH,
  normalizeText, parseKeyword, parseNumericKey, parseColumnCount, parseKey, validatePadChar,
  encrypt, decrypt, columnHeights, stripTrailingPadding, markTrailingPadding,
  stripWhitespace, displayRank, reorderGrid
} from '../js/columnar-core.js';

const kw = s => parseKeyword(s);
const num = s => parseNumericKey(s);
const WIKI = 'WEAREDISCOVEREDFLEEATONCE';

// 独立した参照実装（中核と別の書き方で、全組み合わせを突き合わせる）
function refRank(values) {
  const idx = values.map((v, i) => i).sort((a, b) => (values[a] < values[b] ? -1 : values[a] > values[b] ? 1 : a - b));
  const rank = [];
  idx.forEach((i, k) => { rank[i] = k; });
  return { order: idx, rank };
}
function refEncrypt(plain, order, complete, pad) {
  const n = order.length;
  const total = complete ? Math.ceil(plain.length / n) * n : plain.length;
  const text = plain + pad.repeat(total - plain.length);
  let out = '';
  for (const col of order) for (let i = col; i < total; i += n) out += text[i];
  return out;
}

test('キーワードの列順（既知解答）', () => {
  assert.deepEqual(displayRank(kw('ZEBRAS')), [6, 3, 2, 4, 1, 5]);
  assert.deepEqual(displayRank(kw('BALLOON')), [2, 1, 3, 4, 6, 7, 5]);
  assert.deepEqual(displayRank(kw('KEY')), [2, 1, 3]);
  assert.deepEqual(displayRank(kw('CAT')), [2, 1, 3]);
  assert.deepEqual(displayRank(kw('MOTHER')), [3, 4, 6, 2, 1, 5]);
  assert.deepEqual(displayRank(kw('ALBERTI')), [1, 5, 2, 3, 6, 7, 4]);
});

test('キーワードは大文字小文字を区別せず、同じ文字は左を先にする', () => {
  assert.deepEqual(displayRank(kw('Aa')), [1, 2]);
  assert.deepEqual(displayRank(kw('aA')), [1, 2]);
  assert.deepEqual(displayRank(kw('zebras')), displayRank(kw('ZEBRAS')));
  assert.deepEqual(displayRank(kw('ZeBrAs')), displayRank(kw('ZEBRAS')));
  assert.equal(kw('ｚｅｂｒａｓ').source, 'ZEBRAS');
  assert.equal(kw('  KEY  ').n, 3);
});

test('キーワードの不正な入力', () => {
  assert.equal(kw('').error.key, 'key.keywordEmpty');
  assert.equal(kw('   ').error.key, 'key.keywordEmpty');
  assert.equal(kw('A').error.key, 'key.keywordShort');
  assert.equal(kw('AB1').error.key, 'key.keywordChars');
  assert.equal(kw('暗号').error.key, 'key.keywordChars');
  assert.equal(kw('AB CD').error.key, 'key.keywordChars');
  assert.equal(kw('A'.repeat(MAX_KEY_LENGTH)).n, MAX_KEY_LENGTH);
  assert.equal(kw('A'.repeat(MAX_KEY_LENGTH + 1)).error.key, 'key.tooLong');
});

test('数列の受理', () => {
  for (const s of ['3 1 4 2 5', '3,1,4,2,5', '3, 1, 4, 2, 5', '31425', '３　１　４　２　５', '3、1、4、2、5', ' 3 1 4 2 5 ']) {
    assert.deepEqual(displayRank(num(s)), [3, 1, 4, 2, 5], s);
  }
  assert.deepEqual(displayRank(num('10 1 2 3 4 5 6 7 8 9')), [10, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(displayRank(num('12')), [1, 2]);
});

test('数列の不正な入力', () => {
  const cases = [
    ['', 'key.numericEmpty'], ['1.0 2', 'key.numericChars'], ['1e0 2', 'key.numericChars'],
    ['a b', 'key.numericChars'], ['-1 2', 'key.numericChars'], ['10', 'key.numericNeedSeparator'],
    ['0 1 2', 'key.numericMin'], ['1 2 2', 'key.numericDuplicate'], ['1 3', 'key.numericRange'],
    ['1', 'key.numericShort'], ['2 3', 'key.numericRange']
  ];
  for (const [s, key] of cases) assert.equal(num(s).error?.key, key, s);
  assert.deepEqual(num('1 2 2').error.params, { value: 2 });
  assert.deepEqual(num('1 3').error.params, { n: 2, missing: 2 });
  const long = Array.from({ length: MAX_KEY_LENGTH + 1 }, (_, i) => i + 1).join(' ');
  assert.equal(num(long).error.key, 'key.tooLong');
});

test('鍵なしの列数', () => {
  assert.equal(parseColumnCount('2').n, 2);
  assert.equal(parseColumnCount('20').n, 20);
  assert.equal(parseColumnCount('５').n, 5);
  for (const s of ['1', '21', '', 'abc', '2.5', '-3']) assert.equal(parseColumnCount(s).error?.key, 'key.columnsRange', s);
  assert.deepEqual(parseColumnCount('4').order, [0, 1, 2, 3]);
});

test('parseKey は画面の設定から鍵の種類を選ぶ', () => {
  assert.equal(parseKey({ useKey: true, keyType: 'keyword', keyword: 'KEY' }).type, 'keyword');
  assert.equal(parseKey({ useKey: true, keyType: 'numeric', numeric: '2 1 3' }).type, 'numeric');
  assert.equal(parseKey({ useKey: false, columns: '5' }).type, 'none');
});

test('埋字の検証', () => {
  assert.equal(validatePadChar('X').ok, true);
  assert.equal(validatePadChar('q').ok, true);
  for (const p of ['', 'XX', '1', 'Ｘ', ' ']) assert.equal(validatePadChar(p).error?.key, 'pad.invalid', p);
});

test('Wikipedia の ZEBRAS の例（既知解答）', () => {
  assert.equal(encrypt(WIKI, kw('ZEBRAS'), { complete: false }).cipher, 'EVLNACDTESEAROFODEECWIREE');
  assert.equal(encrypt(WIKI + 'QKJEU', kw('ZEBRAS'), { complete: false }).cipher, 'EVLNEACDTKESEAQROFOJDEECUWIREE');
  assert.equal(encrypt(WIKI, kw('ZEBRAS'), { complete: true, padChar: 'X' }).cipher, 'EVLNXACDTXESEAXROFOXDEECXWIREE');
  assert.equal(decrypt('EVLNACDTESEAROFODEECWIREE', kw('ZEBRAS'), { complete: false }).text, WIKI);
});

test('サンプル（プリセット）5件と座学の例', () => {
  const cases = [
    ['WHOKILLEDCOCKROBINISAIDTHESPARROW', kw('MOTHER'), 'IOIDAXKCBIPXWLKIHRHERSEOLCNTRXODOASW'],
    [WIKI, kw('ZEBRAS'), 'EVLNXACDTXESEAXROFOXDEECXWIREE'],
    ['ATTACKATDAWN', num('3 1 4 2 5'), 'TANADXAKWTTXCAX'],
    ['CRYPTOGRAPHYISTHEHEARTOFSECURITY', kw('ALBERTI'), 'CRTTRYPEFTPHHSYGSRUXRAHOITYEEXOIACX'],
    ['HELLOWORLD', num('2 1 3'), 'EORXHLODLWLX'],
    ['HELLOWORLD', kw('KEY'), 'EORXHLODLWLX'],
    ['MEETMEAFTER', kw('CAT'), 'EMFRMTAEEETX']
  ];
  for (const [plain, key, cipher] of cases) {
    const e = encrypt(plain, key, { complete: true, padChar: 'X' });
    assert.equal(e.cipher, cipher, plain);
    const d = decrypt(cipher, key, { complete: true });
    assert.equal(stripTrailingPadding(d.text, 'X', key.n).text, plain, plain);
  }
});

test('暗号化と復号の往復（参照実装と全組み合わせで一致）', () => {
  const alpha = 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOGPACKMYBOXWITHFIVEDOZENLIQUORJUGS';
  const keys = ['AB', 'BA', 'CAB', 'KEY', 'ZEBRAS', 'BALLOON', 'MOTHER', 'ALBERTI', 'QWERTYUIOP', 'ZYXWVUTSRQPONM'];
  let count = 0;
  for (const word of keys) {
    const key = kw(word);
    const ref = refRank([...word]);
    assert.deepEqual(key.order, ref.order, word);
    for (let L = 1; L <= 60; L++) {
      const plain = alpha.slice(0, L).replace(/Q$/, 'A');
      for (const complete of [false, true]) {
        const e = encrypt(plain, key, { complete, padChar: 'Q' });
        assert.equal(e.cipher, refEncrypt(plain, key.order, complete, 'Q'), `${word} ${L} ${complete}`);
        const d = decrypt(e.cipher, key, { complete });
        const back = complete ? stripTrailingPadding(d.text, 'Q', key.n).text : d.text;
        assert.equal(back, plain, `${word} ${L} ${complete}`);
        count++;
      }
    }
  }
  assert.equal(count, 1200);
});

test('コードポイント単位で扱う（日本語・絵文字・結合文字）', () => {
  const plain = 'こんにちは😀世界🇯🇵é';
  const key = kw('KEY');
  for (const complete of [false, true]) {
    const e = encrypt(plain, key, { complete, padChar: 'X' });
    assert.equal(Array.from(e.cipher).length, Array.from(plain).length + e.padCount);
    const d = decrypt(e.cipher, key, { complete });
    const back = complete ? stripTrailingPadding(d.text, 'X', key.n).text : d.text;
    assert.equal(back, plain);
  }
});

test('完全モードで長さが倍数でない暗号文はエラー', () => {
  const r = decrypt('EVLNACDTESEAROFODEECWIREE', kw('ZEBRAS'), { complete: true });
  assert.equal(r.error.key, 'dec.notMultiple');
  assert.deepEqual(r.error.params, { length: 25, n: 6, shorter: 24, longer: 30 });
  assert.equal(decrypt('', kw('KEY')).error.key, 'dec.empty');
  assert.equal(encrypt('', kw('KEY')).error.key, 'enc.empty');
  assert.equal(encrypt('ABC', kw('KEY'), { complete: true, padChar: '1' }).error.key, 'pad.invalid');
});

test('不完全モードの列の高さ（左から余りの本数だけ1行長い）', () => {
  assert.deepEqual(columnHeights(13, 5, false), [3, 3, 3, 2, 2]);
  assert.deepEqual(columnHeights(15, 5, false), [3, 3, 3, 3, 3]);
  assert.deepEqual(columnHeights(2, 5, false), [1, 1, 0, 0, 0]);
  assert.deepEqual(columnHeights(12, 3, true), [4, 4, 4]);
});

test('埋字の除去は最大「列数−1」文字まで', () => {
  assert.deepEqual(stripTrailingPadding('HELLOXX', 'X', 3), { text: 'HELLO', removed: 2 });
  assert.deepEqual(stripTrailingPadding('AXXXXXXX', 'X', 3), { text: 'AXXXXX', removed: 2 });
  assert.deepEqual(stripTrailingPadding('HELLO', 'X', 3), { text: 'HELLO', removed: 0 });
  assert.deepEqual(stripTrailingPadding('XX', 'X', 6), { text: '', removed: 2 });
  assert.deepEqual(stripTrailingPadding('HELLOx', 'X', 3), { text: 'HELLOx', removed: 0 });
});

test('平文の末尾が埋字と同じなら endsWithPad で知らせる（暗号文だけでは区別できない）', () => {
  const key = kw('KEY');
  const e = encrypt('FOX', key, { complete: true, padChar: 'X' });
  assert.equal(e.endsWithPad, true);
  assert.equal(e.padCount, 0);
  const d = decrypt(e.cipher, key, { complete: true });
  assert.equal(stripTrailingPadding(d.text, 'X', 3).text, 'FO');
  assert.equal(encrypt('FOX', key, { complete: false }).endsWithPad, false);
  assert.equal(encrypt('FOXY', key, { complete: true, padChar: 'X' }).endsWithPad, false);
});

test('暗号化の grid は位置で埋字を判定する（平文の X は平文のまま）', () => {
  const e = encrypt('FOXBOX', kw('KEYS'), { complete: true, padChar: 'X' });
  const kinds = e.grid.flat().map(c => c.kind);
  assert.deepEqual(kinds, ['plain', 'plain', 'plain', 'plain', 'plain', 'plain', 'pad', 'pad']);
  assert.equal(e.grid[0][2].ch, 'X');
  assert.equal(e.grid[0][2].kind, 'plain');
  const inc = encrypt('ABCDE', kw('KEY'), { complete: false });
  assert.deepEqual(inc.grid[1].map(c => c.kind), ['plain', 'plain', 'empty']);
});

test('暗号文の区切り（segments）は列ごとの読み出し範囲', () => {
  const e = encrypt('HELLOWORLD', kw('KEY'), { complete: true, padChar: 'X' });
  assert.deepEqual(e.segments, [{ col: 1, start: 0, length: 4 }, { col: 0, start: 4, length: 4 }, { col: 2, start: 8, length: 4 }]);
  const d = decrypt('EVLNACDTESEAROFODEECWIREE', kw('ZEBRAS'), { complete: false });
  assert.deepEqual(d.heights, [5, 4, 4, 4, 4, 4]);
  assert.deepEqual(d.segments.map(s => s.length), [4, 4, 4, 4, 4, 5]);
});

test('復号の grid に除いた埋字を印す', () => {
  const d = decrypt('EORXHLODLWLX', kw('KEY'), { complete: true });
  const { removed } = stripTrailingPadding(d.text, 'X', 3);
  const marked = markTrailingPadding(d.grid, removed);
  assert.deepEqual(marked[3].map(c => c.kind), ['plain', 'pad', 'pad']);
  assert.equal(d.grid[3][1].kind, 'plain');
});

test('並べ替えた grid は読み出し順の列', () => {
  const e = encrypt('HELLOWORLD', kw('KEY'), { complete: true, padChar: 'X' });
  const g = reorderGrid(e.grid, kw('KEY'));
  assert.deepEqual(g.map(row => row.map(c => c.ch).join('')), ['EHL', 'OLW', 'ROL', 'XDX']);
});

test('空白を含む平文も往復する（暗号文の空白を除かない場合）', () => {
  const key = kw('KEY');
  const e = encrypt('HELLO WORLD', key, { complete: false });
  assert.match(e.cipher, / /);
  assert.equal(decrypt(e.cipher, key, { complete: false }).text, 'HELLO WORLD');
  assert.equal(stripWhitespace('EORX HLOD\nLWLX　'), 'EORXHLODLWLX');
});

test('整形: 記号削除は全言語の文字と数字を残す', () => {
  const opt = { stripSpace: true, stripSymbol: true, uppercase: true };
  assert.equal(normalizeText('こんにちは 世界', opt).text, 'こんにちは世界');
  assert.equal(normalizeText('café naïve', opt).text, 'CAFÉNAÏVE');
  assert.equal(normalizeText('hello_world 123!?', opt).text, 'HELLOWORLD123');
  assert.equal(normalizeText('ＡＢＣ　ＤＥＦ', opt).text, 'ＡＢＣＤＥＦ');
  assert.equal(normalizeText('Who killed Cock Robin? I, said the Sparrow,', opt).text, 'WHOKILLEDCOCKROBINISAIDTHESPARROW');
  assert.equal(normalizeText('é', {}).text, 'é');
  assert.equal(normalizeText('A, B.', { stripSymbol: true }).text, 'A B');
  assert.equal(normalizeText('a b', { uppercase: true }).text, 'A B');
});

test('整形: 上限を超えた入力はコードポイント単位で切り詰め、そのことを返す', () => {
  const r = normalizeText('A'.repeat(MAX_INPUT_LENGTH + 5));
  assert.equal(r.truncated, true);
  assert.equal(r.inputLength, MAX_INPUT_LENGTH + 5);
  assert.equal(r.text.length, MAX_INPUT_LENGTH);
  const emoji = normalizeText('😀'.repeat(MAX_INPUT_LENGTH));
  assert.equal(emoji.truncated, false);
  assert.equal(Array.from(emoji.text).length, MAX_INPUT_LENGTH);
});
