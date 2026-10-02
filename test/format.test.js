import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// 1行に詰め込んだ（minify した）ファイルを検出する
const ROOT = new URL('../', import.meta.url);
const list = dir => readdirSync(new URL(dir, ROOT)).filter(f => /\.(js|css)$/.test(f)).map(f => dir + f);
const files = [...list('js/'), ...list('css/'), ...list('test/')];

test('JS・CSS・テストの最長行は160文字以下', () => {
  for (const f of files) {
    const longest = Math.max(...readFileSync(new URL(f, ROOT), 'utf8').split('\n').map(l => l.length));
    assert.ok(longest <= 160, `${f}: ${longest}`);
  }
});

test('index.html の最長行は250文字以下', () => {
  const longest = Math.max(...readFileSync(new URL('index.html', ROOT), 'utf8').split('\n').map(l => l.length));
  assert.ok(longest <= 250, String(longest));
});

test('主要なファイルの行数の下限', () => {
  const min = {
    'index.html': 500, 'js/columnar-core.js': 150, 'js/encryption.js': 250, 'js/decryption.js': 200,
    'css/base.css': 150, 'css/cipher.css': 150, 'css/components.css': 250, 'README.md': 300
  };
  for (const [f, n] of Object.entries(min)) {
    const lines = readFileSync(new URL(f, ROOT), 'utf8').split('\n').length;
    assert.ok(lines >= n, `${f}: ${lines}`);
  }
});
