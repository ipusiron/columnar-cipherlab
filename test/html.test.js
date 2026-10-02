import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const html = read('index.html');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

test('CSP は meta で設定し、インラインと eval を許さない', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'CSP の meta がない');
  const csp = m[1];
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp.includes(d), d);
  }
  assert.ok(!csp.includes('unsafe-inline'), 'unsafe-inline');
  assert.ok(!csp.includes('unsafe-eval'), 'unsafe-eval');
  // frame-ancestors は meta では効かないので書かない
  assert.ok(!csp.includes('frame-ancestors'));
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
});

test('インラインのスクリプト・スタイル・イベント属性がない', () => {
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'src のない script');
  assert.ok(!/<style[\s>]/.test(html), 'style 要素');
  assert.ok(!/\sstyle="/.test(html), 'style 属性');
  assert.ok(!/\son[a-z]+="/i.test(html), 'イベント属性');
  assert.match(html, /<script type="module" src="js\/main\.js"><\/script>/);
  assert.match(html, /<noscript>/);
});

test('新しいタブで開くリンクは rel="noopener noreferrer"', () => {
  const links = [...html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)].map(m => m[0]);
  assert.ok(links.length >= 1);
  for (const a of links) assert.match(a, /rel="noopener noreferrer"/, a);
});

test('ボタンはすべて type を持つ', () => {
  for (const b of html.matchAll(/<button\b[^>]*>/g)) assert.match(b[0], /\stype="button"/, b[0]);
});

test('スクリプトが参照する id は index.html にある', () => {
  const jsFiles = readdirSync(new URL('../js/', import.meta.url)).filter(f => f.endsWith('.js'));
  let count = 0;
  for (const f of jsFiles) {
    const src = read(`js/${f}`);
    for (const m of src.matchAll(/(?:getElementById|\$)\('([\w-]+)'\)/g)) {
      assert.ok(ids.has(m[1]), `${f}: ${m[1]}`);
      count++;
    }
  }
  assert.ok(count >= 60, `参照の件数 ${count}`);
});

test('ラベルの for とタブの aria-controls の行き先がある', () => {
  for (const m of html.matchAll(/<label[^>]*\sfor="([^"]+)"/g)) assert.ok(ids.has(m[1]), m[1]);
  const tabs = [...html.matchAll(/role="tab"[^>]*aria-controls="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ['tab-enc', 'tab-dec', 'tab-double', 'tab-lab', 'tab-study']);
  for (const id of tabs) assert.ok(ids.has(id), id);
  assert.equal([...html.matchAll(/role="tabpanel"/g)].length, tabs.length);
  assert.match(html, /id="help-modal"[^>]*role="dialog"[^>]*aria-modal="true"/);
});

test('ビューポートと file:// の案内', () => {
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1.0" \/>/);
  assert.ok(!/user-scalable=no|maximum-scale=1/.test(html));
  assert.ok(ids.has('file-notice'));
  assert.match(read('js/file-check.js'), /protocol === 'file:'/);
});
