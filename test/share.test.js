import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareHash, parseShareHash } from '../js/share.js';
import { MAX_INPUT_LENGTH } from '../js/columnar-core.js';

test('問題の共有リンクは暗号文とモードだけ（鍵を含めない）', () => {
  const hash = buildShareHash({ cipher: 'EVLNA CDTES', complete: false, keyType: 'keyword', key: 'ZEBRAS' });
  assert.equal(hash, '#tab=lab&c=EVLNA+CDTES&m=incomplete');
  assert.ok(!hash.includes('ZEBRAS'));
  assert.deepEqual(parseShareHash(hash), { tab: 'lab', cipher: 'EVLNA CDTES', complete: false });
});

test('解答つきの共有リンクは鍵も含め、往復する', () => {
  const cases = [
    { cipher: 'EVLNXACDTX', complete: true, keyType: 'keyword', key: 'ZEBRAS', myszkowski: false, padChar: 'Q' },
    { cipher: 'ROFOACDTED', complete: false, keyType: 'keyword', key: 'TOMATO', myszkowski: true, padChar: 'X' },
    { cipher: 'TANADXAKWT', complete: true, keyType: 'numeric', key: '3 1 4 2 5', myszkowski: false, padChar: 'X' },
    { cipher: '日本語&=#+%', complete: false, keyType: 'none', key: '4', myszkowski: false, padChar: 'X' }
  ];
  for (const c of cases) {
    const parsed = parseShareHash(buildShareHash({ ...c, withKey: true }));
    assert.equal(parsed.tab, 'dec');
    assert.equal(parsed.cipher, c.cipher);
    assert.equal(parsed.complete, c.complete);
    assert.equal(parsed.keyType, c.keyType);
    assert.equal(parsed.key, c.key);
    assert.equal(parsed.myszkowski, c.myszkowski);
    if (c.complete) assert.equal(parsed.padChar, c.padChar);
  }
});

test('ランダムな英字（ヌル）で埋めた暗号文の解答リンクは r=1 を持ち、埋字の文字を持たない', () => {
  const hash = buildShareHash({ cipher: 'EVLNEACDTK', complete: true, withKey: true, keyType: 'keyword', key: 'ZEBRAS', padChar: 'X', nulls: true });
  assert.equal(hash, '#tab=dec&c=EVLNEACDTK&m=complete&t=keyword&k=ZEBRAS&r=1');
  const parsed = parseShareHash(hash);
  assert.equal(parsed.nulls, true);
  // 不完全モードでは r を無視する
  assert.equal(parseShareHash('#tab=dec&c=ABC&m=incomplete&t=keyword&k=KEY&r=1').nulls, false);
  assert.equal(parseShareHash('#tab=dec&c=ABC&m=complete&t=keyword&k=KEY&p=X').nulls, false);
});

test('共有リンクに平文の欄はない', () => {
  const hash = buildShareHash({ cipher: 'X', complete: true, withKey: true, keyType: 'keyword', key: 'KEY', padChar: 'X' });
  const keys = [...new URLSearchParams(hash.slice(1)).keys()];
  assert.deepEqual(keys, ['tab', 'c', 'm', 't', 'k', 'p']);
});

test('読み込めない共有リンクは error、関係のない # は無視する', () => {
  assert.equal(parseShareHash(''), null);
  assert.equal(parseShareHash('#top'), null);
  assert.equal(parseShareHash('#tab=other&c=A'), null);
  const bad = [
    '#tab=lab&c=', '#tab=lab&c=ABC&m=zigzag', '#tab=dec&c=ABC&m=incomplete&t=keyword&k=AB1',
    '#tab=dec&c=ABC&m=incomplete&t=other&k=KEY', '#tab=dec&c=ABC&m=complete&t=keyword&k=KEY&p=1',
    '#tab=dec&c=ABC&m=incomplete&t=numeric&k=1+1', `#tab=lab&c=${'A'.repeat(MAX_INPUT_LENGTH + 1)}`
  ];
  for (const h of bad) assert.equal(parseShareHash(h).error.key, 'share.invalid', h.slice(0, 60));
  assert.equal(parseShareHash(`#tab=lab&c=${'A'.repeat(MAX_INPUT_LENGTH)}`).cipher.length, MAX_INPUT_LENGTH);
});
