import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import {
  normalizeText, parseKeyword, parseNumericKey, encrypt, decrypt, columnHeights, displayRank
} from '../js/columnar-core.js';

const ROOT = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, ROOT), 'utf8').replace(/\r\n/g, '\n');
const readme = read('README.md');
const html = read('index.html');
const presets = JSON.parse(read('data/presets.json')).presets;
const group = (s, size) => s.match(new RegExp(`.{1,${size}}`, 'g')).join(' ');
const rankText = word => [...word].map((ch, i) => `${ch}=${displayRank(parseKeyword(word))[i]}`).join(', ');

// README の先頭の YAML（hackinglab.online が読む）
test('README の YAML メタデータの構造と値', () => {
  const m = readme.match(/^<!--\n---\n([\s\S]*?)\n---\n-->\n/);
  assert.ok(m, 'YAML のコメントブロックがない');
  const yaml = m[1];
  const keys = [...yaml.matchAll(/^([a-z_]+):/gm)].map(x => x[1]);
  assert.deepEqual(keys, ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en', 'description_ja', 'description_en',
    'category_ja', 'category_en', 'difficulty', 'tags', 'repo_url', 'demo_url', 'hub']);
  for (const k of ['category_ja', 'category_en', 'tags']) {
    assert.match(yaml, new RegExp(`^${k}:\\n  - `, 'm'), `${k} はブロック形式`);
  }
  assert.match(yaml, /^id: day043$/m);
  assert.match(yaml, /^slug: columnar-cipherlab$/m);
  assert.match(yaml, /^repo_url: "https:\/\/github\.com\/ipusiron\/columnar-cipherlab"$/m);
  assert.match(yaml, /^demo_url: "https:\/\/ipusiron\.github\.io\/columnar-cipherlab\/"$/m);
  assert.match(yaml, /^hub: true$/m);
});

test('シリーズの定型（100のプロジェクト）と節の順', () => {
  assert.match(readme, /^# .*Columnar CipherLab - /m);
  assert.ok(readme.includes('**Day043 - 生成AIで作るセキュリティツール100**'));
  assert.ok(readme.includes('https://akademeia.info/?page_id=42163'));
  const h2 = [...readme.matchAll(/^## (.+)$/gm)].map(m => m[1]);
  assert.deepEqual(h2.slice(0, 2), ['🌐 デモページ', '📸 スクリーンショット']);
  assert.deepEqual(h2.slice(-4), ['📁 ディレクトリー構造', '💻 動作環境', '📄 ライセンス', '🛠️ このツールについて']);
  for (const h of ['🎯 ユースケース', '🧪 テスト', '🔒 セキュリティ']) assert.ok(h2.includes(h), h);
});

test('README の暗号化・復号の例（KEY）', () => {
  const key = parseKeyword('KEY');
  const e = encrypt('HELLOWORLD', key, { complete: true, padChar: 'X' });
  assert.ok(readme.includes(`暗号文: ${group(e.cipher, 4)}`), e.cipher);
  const d = decrypt(e.cipher, key, { complete: true });
  assert.ok(readme.includes(`平文（埋字つき）: ${group(d.text, 3)}`), d.text);
  assert.ok(readme.includes('列: 2 1 3  (アルファベット順: E=1, K=2, Y=3)'));
  assert.deepEqual(displayRank(key), [2, 1, 3]);
  assert.ok(readme.includes('`行数 = ceil(暗号文長 ÷ 鍵長)=12÷3=4`'));
});

test('README の埋字の曖昧さ（FO と FOX）', () => {
  const key = parseKeyword('KEY');
  const fo = encrypt('FO', key, { complete: true, padChar: 'X' }).cipher;
  const fox = encrypt('FOX', key, { complete: true, padChar: 'X' }).cipher;
  assert.equal(fo, fox);
  assert.ok(readme.includes(`どちらも暗号文「${fo}」になります`));
});

test('README の鍵順の例と ceil の例', () => {
  assert.ok(readme.includes(`ZEBRAS → ${rankText('ZEBRAS')}`));
  assert.deepEqual(columnHeights(13, 5, false), [3, 3, 3, 2, 2]);
  assert.ok(readme.includes('→ 左から3列が高さ3、残り2列が高さ2'));
  const wiki = encrypt('WEAREDISCOVEREDFLEEATONCEQKJEU', parseKeyword('ZEBRAS'), { complete: false }).cipher;
  assert.ok(readme.includes(group(wiki, 5)));
});

test('README のサンプル表は presets.json と中核ロジックの結果に一致する', () => {
  const sec = readme.split('## 🎓 学習用のサンプルプリセット')[1].split('\n## ')[0];
  const rows = sec.split('\n').filter(l => /^\| [①-⑤]/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
  assert.equal(rows.length, presets.length);
  rows.forEach(([name, plain, keyText, cipher], i) => {
    const p = presets[i];
    assert.equal(name, p.name.replace(/"/g, '').replace('＋数列', '').replace('とシンプル数列', ''));
    assert.equal(plain, p.plaintext);
    assert.equal(keyText, p.keyType === 'keyword' ? p.keyword : p.numeric);
    const key = p.keyType === 'keyword' ? parseKeyword(p.keyword) : parseNumericKey(p.numeric);
    const text = normalizeText(p.plaintext, p.settings).text;
    assert.equal(cipher, encrypt(text, key, { complete: p.settings.complete, padChar: p.settings.padChar }).cipher, name);
  });
});

test('座学タブの例と練習問題を中核ロジックで検算する', () => {
  const key = parseKeyword('KEY');
  assert.ok(html.includes(`暗号文（縦読み）: ${group(encrypt('HELLOWORLD', key, { complete: true, padChar: 'X' }).cipher, 4)}`));
  const cat = parseKeyword('CAT');
  assert.ok(html.includes('キーワード: CAT → C=2, A=1, T=3'));
  assert.ok(html.includes(`暗号文: ${group(encrypt('MEETMEAFTER', cat, { complete: true, padChar: 'X' }).cipher, 4)}`));
  const m = html.match(/暗号文 "([A-Z ]+)" を数列 "([\d,]+)" で復号してみましょう（不完全モード）/);
  assert.ok(m, '練習問題2の暗号文');
  const plain = decrypt(m[1].replace(/ /g, ''), parseNumericKey(m[2]), { complete: false }).text;
  assert.ok(html.includes(`平文: ${plain}（SERVED MICE）`), plain);
  assert.ok(html.includes(`列の高さ: [${columnHeights(10, 3, false).join(',')}]`));
  const ofx = encrypt('FO', key, { complete: true, padChar: 'X' }).cipher;
  assert.ok(html.includes(`平文 "FO"  → F O X(埋字) → 暗号文 ${ofx}`));
  assert.ok(html.includes(`平文 "FOX" → F O X(平文) → 暗号文 ${encrypt('FOX', key, { complete: true, padChar: 'X' }).cipher}`));
});

test('ツールチップとヘルプの鍵順の例', () => {
  assert.ok(html.includes(`ZEBRAS → ${rankText('ZEBRAS').replace(/, /g, ',')}`));
  assert.ok(html.includes(`「BALLOON」→ ${rankText('BALLOON')}`));
});

test('README の画像参照が実在し、assets の PNG はすべて README から参照される', () => {
  const refs = [...(readme + readmeEn).matchAll(/\]\((assets\/[^)]+)\)/g)].map(m => m[1]);
  assert.ok(refs.length >= 9);
  for (const r of refs) assert.ok(existsSync(new URL(r, ROOT)), r);
  const pngs = [
    ...readdirSync(new URL('assets/', ROOT)).filter(f => f.endsWith('.png')).map(f => `assets/${f}`),
    ...readdirSync(new URL('assets/en/', ROOT)).filter(f => f.endsWith('.png')).map(f => `assets/en/${f}`)
  ];
  for (const f of pngs) assert.ok(refs.includes(f), `参照されていない画像 ${f}`);
});

// 英語版 README（README.en.md）
const readmeEn = read('README.en.md');
const headings = text => text.replace(/```[\s\S]*?```/g, '').split('\n').filter(l => /^#{1,4} /.test(l));
const shape = h => {
  const [, hashes, rest] = h.match(/^(#+) (.*)$/);
  const icon = rest.match(/^([^\sA-Za-z0-9぀-鿿（(]+)\s/);
  return `${hashes} ${icon ? icon[1] : ''}`;
};

test('英語版 README は日本語版と同じ見出しの構成で、相互にリンクする', () => {
  const ja = headings(readme);
  const en = headings(readmeEn);
  assert.equal(en.length, ja.length);
  assert.deepEqual(en.map(shape), ja.map(shape));
  assert.equal(readmeEn.split('\n')[2], 'English · [日本語](README.md)');
  assert.ok(readme.includes('[English](README.en.md) · 日本語'));
  assert.ok(!readmeEn.includes('<!--'), 'YAML は README.md だけに置く');
  assert.ok(readmeEn.includes('**Day043 - 100 Security Tools with Generative AI**'));
  assert.ok(readmeEn.includes('https://akademeia.info/?page_id=42163'));
});

test('英語版 README の例と表も中核ロジックの結果と同じ', () => {
  const key = parseKeyword('KEY');
  assert.ok(readmeEn.includes(`Ciphertext: ${group(encrypt('HELLOWORLD', key, { complete: true, padChar: 'X' }).cipher, 4)}`));
  assert.ok(readmeEn.includes(`Plaintext (with padding): ${group(decrypt('EORXHLODLWLX', key, { complete: true }).text, 3)}`));
  assert.ok(readmeEn.includes(`ZEBRAS → ${rankText('ZEBRAS')}`));
  assert.ok(readmeEn.includes(`both give the ciphertext "${encrypt('FO', key, { complete: true, padChar: 'X' }).cipher}"`));
  const sec = readmeEn.split('## 🎓 Sample presets for learning')[1].split('\n## ')[0];
  const rows = sec.split('\n').filter(l => /^\| [①-⑤]/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
  assert.equal(rows.length, presets.length);
  rows.forEach(([, plain, keyText, cipher], i) => {
    const p = presets[i];
    assert.equal(plain, p.plaintext);
    assert.equal(keyText, p.keyType === 'keyword' ? p.keyword : p.numeric);
    const k = p.keyType === 'keyword' ? parseKeyword(p.keyword) : parseNumericKey(p.numeric);
    assert.equal(cipher, encrypt(normalizeText(p.plaintext, p.settings).text, k, { complete: true, padChar: 'X' }).cipher);
  });
});

test('英語版 README のディレクトリー構造は日本語版と同じファイルを並べる', () => {
  const files = text => {
    const block = text.split(/## 📁 [^\n]+/)[1].match(/```\n([\s\S]*?)```/)[1].trimEnd().split('\n').slice(1);
    return block.map(l => l.replace(/\s+#.*$/, '').replace(/^[│ ├└─]+/, ''));
  };
  assert.deepEqual(files(readmeEn), files(readme));
  const hashes = new Set(readmeEn.split(/## 📁 [^\n]+/)[1].match(/```\n([\s\S]*?)```/)[1].trimEnd().split('\n').slice(1).map(l => l.indexOf('#')));
  assert.equal(hashes.size, 1);
});

// ディレクトリー構造: 全ファイルが載り、全行に説明がある
function walk(dir, base = '') {
  const out = [];
  for (const name of readdirSync(new URL(dir, ROOT))) {
    if (['.git', 'node_modules', '.claude'].includes(name)) continue;
    const rel = base + name;
    if (statSync(new URL(dir + name, ROOT)).isDirectory()) out.push(...walk(`${dir}${name}/`, `${rel}/`));
    else out.push(rel);
  }
  return out;
}

test('README のディレクトリー構造', () => {
  const sec = readme.split('## 📁 ディレクトリー構造')[1];
  const block = sec.match(/```\n([\s\S]*?)```/)[1].trimEnd().split('\n');
  assert.equal(block[0], 'columnar-cipherlab/');
  const stack = [];
  const listed = [];
  for (const line of block.slice(1)) {
    const m = line.match(/^((?:│   |    )*)(?:├── |└── )(\S+)\s+# \S/);
    assert.ok(m, `説明のない行: ${line}`);
    const depth = m[1].length / 4;
    stack.length = depth;
    const name = m[2];
    if (name.endsWith('/')) stack.push(name);
    else listed.push(stack.join('') + name);
  }
  const files = walk('').sort();
  assert.deepEqual([...listed].sort(), files);
  const hashes = new Set(block.slice(1).map(l => l.indexOf('#')));
  assert.equal(hashes.size, 1, '# の桁がそろっていない');
});
