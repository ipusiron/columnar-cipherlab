import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { messageKeys, messageValue } from '../js/messages.js';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('index.html');
const JP = /[぀-ヿ㐀-鿿！-｠、。「」※]/;
const squash = s => s.replace(/\s+/g, ' ').trim();
const decode = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('日英の辞書のキーと差し込み名がそろっている', () => {
  const ja = messageKeys('ja');
  const en = messageKeys('en');
  assert.deepEqual([...en].sort(), [...ja].sort());
  assert.ok(ja.length >= 240, String(ja.length));
  const names = v => [...v.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  for (const k of ja) assert.deepEqual(names(messageValue('en', k)), names(messageValue('ja', k)), k);
});

test('英語の文言に日本語の文字が残っていない', () => {
  for (const k of messageKeys('en')) {
    if (k === 'lang.toJapanese') continue;
    assert.ok(!JP.test(messageValue('en', k)), `${k}: ${messageValue('en', k)}`);
  }
});

test('index.html の data-i18n の日本語は辞書と同じで、辞書の ui.* はすべて使われる', () => {
  const used = new Set();
  // 文字（要素の中身）
  for (const m of html.matchAll(/<(\w+)([^>]*)\sdata-i18n="(ui\.\d+)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
    used.add(m[3]);
    assert.equal(decode(squash(m[5])), messageValue('ja', m[3]), m[3]);
  }
  for (const m of html.matchAll(/<(\w+) data-i18n="(ui\.\d+)"([^>]*)>([^<]*)</g)) {
    used.add(m[2]);
    assert.equal(decode(squash(m[4])), messageValue('ja', m[2]), m[2]);
  }
  // 属性
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    for (const m of html.matchAll(new RegExp(`\\s${attr}="([^"]*)"\\s+data-i18n-${attr}="(ui\\.\\d+)"`, 'g'))) {
      used.add(m[2]);
      assert.equal(decode(m[1]), messageValue('ja', m[2]), `${attr} ${m[2]}`);
    }
  }
  const ui = messageKeys('ja').filter(k => k.startsWith('ui.'));
  for (const k of ui) assert.ok(used.has(k), `使われていないキー ${k}`);
  // HTML が指すキーはすべて辞書にある
  for (const m of html.matchAll(/data-i18n(?:-[a-z-]+)?="([\w.]+)"/g)) assert.ok(messageValue('ja', m[1]) !== undefined, m[1]);
});

test('座学・ヘルプ・起動時の案内に日本語版と英語版がある', () => {
  for (const cls of ['study-content']) {
    assert.match(html, new RegExp(`class="${cls}" data-lang="ja"`));
    assert.match(html, new RegExp(`class="${cls}" data-lang="en" hidden`));
  }
  assert.equal([...html.matchAll(/data-lang="ja"/g)].length, [...html.matchAll(/data-lang="en"/g)].length);
  const en = html.slice(html.indexOf('class="study-content" data-lang="en"'), html.indexOf('<!-- /study-content -->'));
  assert.ok(!JP.test(en.replace(/·/g, '')), '英語版の座学に日本語が残っている');
  // 例と練習問題の暗号文は日本語版と同じ
  for (const s of ['EORX HLOD LWLX', 'EMFR MTAE EETX', '"EEISV MERDC"', 'ciphertext OFX', 'SERVEDMICE', 'C=2, A=1, T=3']) {
    assert.ok(en.includes(s), s);
  }
  const helpEn = html.slice(html.indexOf('<div data-lang="en" hidden>', html.indexOf('modal-body')), html.indexOf('<!-- /modal-body -->'));
  assert.ok(helpEn.length > 3000);
  assert.ok(!JP.test(helpEn.replace(/日本語/g, '')), '英語版のヘルプに日本語が残っている');
  assert.ok(helpEn.includes('B=2, A=1, L=3, L=4, O=6, O=7, N=5'));
  assert.ok(helpEn.includes('4 3 2 1 4 3'));
});

test('サンプルの英語名と説明', () => {
  const presets = JSON.parse(read('data/presets.json')).presets;
  for (const p of presets) {
    assert.ok(p.name_en && !JP.test(p.name_en.replace(/[①-⑤]/g, '')), p.id);
    assert.ok(p.description_en && !JP.test(p.description_en), p.id);
  }
});

test('初期の言語は ?lang → 保存した選択 → ブラウザーの言語', () => {
  const src = read('js/i18n.js');
  assert.match(src, /get\('lang'\)/);
  assert.match(src, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(src, /navigator\.language/);
});
