import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { t, tr, messageKeys } from '../js/messages.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const jsFiles = readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js'));

test('中核ロジックが返すキーはすべて文言がある', () => {
  const src = read('js/columnar-core.js');
  const keys = [...src.matchAll(/err\('([\w.]+)'/g)].map(m => m[1]);
  assert.ok(keys.length >= 15, `キーの件数 ${keys.length}`);
  const known = new Set(messageKeys('ja'));
  for (const k of keys) assert.ok(known.has(k), k);
});

test('画面のスクリプトが t() で指すキーはすべて文言がある', () => {
  const known = new Set(messageKeys('ja'));
  for (const f of jsFiles) {
    for (const m of read(`js/${f}`).matchAll(/\bt\('([\w.]+)'/g)) assert.ok(known.has(m[1]), `${f}: ${m[1]}`);
  }
});

test('差し込み', () => {
  assert.equal(t('key.keywordShort', { min: 2 }), 'キーワードは2文字以上にしてください。');
  assert.equal(tr({ key: 'key.numericDuplicate', params: { value: 3 } }), '鍵数列に3が重複しています。');
  assert.equal(t('no.such.key'), 'no.such.key');
  assert.equal(tr(null), '');
});
