// ===== 縦列転置式暗号の中核ロジック（DOMに依存しない） =====
// 文言は持たない。エラーや注意は { key, params } で返し、表示の直前に messages.js で訳す。
// 1マスは1コードポイント（NFCに正規化したあと）として扱う。
// 鍵は「読み出す列のまとまり（groups）」で表す。標準の縦列転置は1列ずつ、Myszkowski式は同じ文字の列をまとめる。

export const MAX_INPUT_LENGTH = 10000;
export const MIN_KEY_LENGTH = 2;
export const MAX_KEY_LENGTH = 64;
export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 20;

const err = (key, params) => ({ error: params ? { key, params } : { key } });

// 入力テキストの整形
// stripSpace: 空白（全角スペース・改行・タブを含む）を除く
// stripSymbol: 文字（全言語）・結合文字・数字以外を除く。空白は stripSpace に任せる
// uppercase: 英字などを大文字にする
export function normalizeText(text, { stripSpace = false, stripSymbol = false, uppercase = false } = {}) {
  const chars = Array.from(String(text ?? '').normalize('NFC'));
  const truncated = chars.length > MAX_INPUT_LENGTH;
  let t = (truncated ? chars.slice(0, MAX_INPUT_LENGTH) : chars).join('');
  if (stripSpace) t = t.replace(/\s+/gu, '');
  if (stripSymbol) t = t.replace(/[^\p{L}\p{M}\p{N}\s]/gu, '');
  if (uppercase) t = t.toUpperCase();
  return { text: t.normalize('NFC'), truncated, inputLength: chars.length };
}

// 鍵の文字・数字の全角を半角へ寄せる
function foldKeyInput(input) {
  return String(input ?? '').normalize('NFKC').replace(/[、､]/g, ',').trim();
}

// 列ごとの値（文字か数）から鍵を作る。同じ値は左の列を先にする
// grouped が真なら、同じ値の列を1つのまとまりにする（Myszkowski式）
function keyFromValues(values, grouped = false) {
  const entries = values.map((v, i) => ({ v, i }));
  entries.sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : a.i - b.i));
  const groups = [];
  for (const e of entries) {
    const last = groups[groups.length - 1];
    if (grouped && last && values[last[0]] === e.v) last.push(e.i);
    else groups.push([e.i]);
  }
  return keyFromGroups(groups, values.length);
}

// まとまりの並びから鍵を作る。rank は列ごとのまとまりの順位（0始まり）
export function keyFromGroups(groups, n) {
  const rank = new Array(n);
  groups.forEach((cols, g) => cols.forEach(c => { rank[c] = g; }));
  return { order: groups.flat(), rank, n, groups: groups.map(cols => cols.slice()) };
}

// 読み出し順（列の並び）から鍵を作る（解読ラボ・作業台で使う）
export function keyFromOrder(order) {
  return { ...keyFromGroups(order.map(c => [c]), order.length), source: order.map(c => c + 1).join(' '), type: 'order' };
}

// キーワードから列順を決める。大文字小文字は区別しない。同じ文字は左の列を先にする
// myszkowski が真なら、同じ文字の列をまとめて行ごとに読む
export function parseKeyword(input, { myszkowski = false } = {}) {
  const s = foldKeyInput(input).toUpperCase();
  if (!s) return err('key.keywordEmpty');
  if (!/^[A-Z]+$/.test(s)) return err('key.keywordChars');
  if (s.length < MIN_KEY_LENGTH) return err('key.keywordShort', { min: MIN_KEY_LENGTH });
  if (s.length > MAX_KEY_LENGTH) return err('key.tooLong', { max: MAX_KEY_LENGTH });
  return { ...keyFromValues([...s], myszkowski), source: s, type: 'keyword', myszkowski: Boolean(myszkowski) };
}

// 数列から列順を決める。区切りは空白・カンマ・読点。区切りがなければ1文字ずつ（9列まで）
export function parseNumericKey(input) {
  const s = foldKeyInput(input);
  if (!s) return err('key.numericEmpty');
  const separated = /[\s,]/.test(s);
  const tokens = separated ? s.split(/[\s,]+/).filter(Boolean) : [...s];
  if (tokens.some(t => !/^\d+$/.test(t))) return err('key.numericChars');
  const nums = tokens.map(Number);
  if (nums.some(v => v < 1)) return err(separated ? 'key.numericMin' : 'key.numericNeedSeparator');
  if (nums.length < MIN_KEY_LENGTH) return err('key.numericShort', { min: MIN_KEY_LENGTH });
  if (nums.length > MAX_KEY_LENGTH) return err('key.tooLong', { max: MAX_KEY_LENGTH });
  const seen = new Set();
  for (const v of nums) {
    if (seen.has(v)) return err('key.numericDuplicate', { value: v });
    seen.add(v);
  }
  for (let i = 1; i <= nums.length; i++) {
    if (!seen.has(i)) return err('key.numericRange', { n: nums.length, missing: i });
  }
  return { ...keyFromValues(nums), source: nums.join(' '), type: 'numeric' };
}

// 鍵なし（列を並べ替えない）
export function parseColumnCount(input) {
  const s = foldKeyInput(input);
  if (!/^\d+$/.test(s)) return err('key.columnsRange', { min: MIN_COLUMNS, max: MAX_COLUMNS });
  const n = Number(s);
  if (n < MIN_COLUMNS || n > MAX_COLUMNS) return err('key.columnsRange', { min: MIN_COLUMNS, max: MAX_COLUMNS });
  return { ...keyFromOrder(Array.from({ length: n }, (_, i) => i)), source: String(n), type: 'none' };
}

// 鍵の欄の値（キーワードか数列）を見分けて解析する（二重転置タブで使う）
export function parseAnyKey(input) {
  const s = foldKeyInput(input);
  if (/\d/.test(s) && /[A-Za-z]/.test(s)) return err('key.mixed');
  return /\d/.test(s) ? parseNumericKey(input) : parseKeyword(input);
}

// 画面の設定から鍵を作る
export function parseKey({ useKey = true, keyType = 'keyword', keyword = '', numeric = '', columns = '', myszkowski = false } = {}) {
  if (!useKey) return parseColumnCount(columns);
  return keyType === 'numeric' ? parseNumericKey(numeric) : parseKeyword(keyword, { myszkowski });
}

// 埋字は英字1文字
export function validatePadChar(padChar) {
  return /^[A-Za-z]$/.test(String(padChar ?? '')) ? { ok: true } : err('pad.invalid');
}

// 読み出し順に並べたマスの番号（行優先の通し番号）
// まとまりごとに、上の行から、まとまりの中は左の列から読む。標準の鍵では列ごとに上から下へ読むのと同じ
export function readOrder(length, key, complete = true) {
  const n = key.n;
  const rows = Math.ceil(length / n);
  const total = complete ? rows * n : length;
  const out = [];
  for (const cols of key.groups) {
    for (let r = 0; r < rows; r++) {
      for (const c of cols) {
        const i = r * n + c;
        if (i < total) out.push(i);
      }
    }
  }
  return out;
}

// 読み出しのまとまりごとの、暗号文の中の範囲
function segmentsOf(length, key, complete) {
  const n = key.n;
  const rows = Math.ceil(length / n);
  const total = complete ? rows * n : length;
  const segments = [];
  let start = 0;
  for (const cols of key.groups) {
    let size = 0;
    for (let r = 0; r < rows; r++) for (const c of cols) if (r * n + c < total) size++;
    segments.push({ col: cols[0], cols: cols.slice(), start, length: size });
    start += size;
  }
  return segments;
}

// 暗号化。grid は行×列のセル { ch, kind: 'plain' | 'pad' | 'empty' }
// padText を渡すと、埋字をその文字列の先頭から順に使う（ランダムな英字＝ヌルで埋めるとき。足りなければエラー）
export function encrypt(text, key, { complete = true, padChar = 'X', padText = null } = {}) {
  const chars = Array.from(String(text ?? ''));
  const L = chars.length;
  if (!L) return err('enc.empty');
  const n = key.n;
  const rows = Math.ceil(L / n);
  const total = complete ? rows * n : L;
  const pads = padText === null ? null : Array.from(String(padText));
  if (complete && pads === null && !validatePadChar(padChar).ok) return err('pad.invalid');
  if (complete && pads !== null && (pads.length < total - L || pads.some(c => !/^[A-Za-z]$/.test(c)))) return err('pad.invalid');
  const cells = [];
  for (let i = 0; i < rows * n; i++) {
    if (i < L) cells.push({ ch: chars[i], kind: 'plain' });
    else if (i < total) cells.push({ ch: pads ? pads[i - L] : padChar, kind: 'pad' });
    else cells.push({ ch: '', kind: 'empty' });
  }
  const grid = Array.from({ length: rows }, (_, r) => cells.slice(r * n, (r + 1) * n));
  const cipher = readOrder(L, key, complete).map(i => cells[i].ch).join('');
  const endsWithPad = complete && pads === null && chars[L - 1] === padChar;
  return { cipher, grid, rows, n, length: L, padCount: total - L, segments: segmentsOf(L, key, complete), endsWithPad };
}

// ランダムな英字（ヌル）を count 文字作る。crypto.getRandomValues で、26文字が等しい確率になるよう 234 以上は捨てる
export function randomNulls(count, getRandomValues = buf => globalThis.crypto.getRandomValues(buf)) {
  let out = '';
  while (out.length < count) {
    const buf = getRandomValues(new Uint8Array(Math.max(16, count * 2)));
    for (const b of buf) {
      if (b < 234 && out.length < count) out += String.fromCharCode(65 + (b % 26));
    }
  }
  return out;
}

// 列ごとの高さ（元の列順）。不完全では左から余りの本数だけ1行長い
export function columnHeights(length, n, complete = true) {
  const rows = Math.ceil(length / n);
  const rem = length % n;
  return Array.from({ length: n }, (_, c) => (complete || rem === 0 || c < rem ? rows : rows - 1));
}

// 復号。完全モードで長さが列数の倍数でなければエラー
export function decrypt(cipher, key, { complete = true } = {}) {
  const chars = Array.from(String(cipher ?? ''));
  const L = chars.length;
  if (!L) return err('dec.empty');
  const n = key.n;
  if (complete && L % n !== 0) {
    const shorter = L - (L % n);
    return err('dec.notMultiple', { length: L, n, shorter, longer: shorter + n });
  }
  const rows = Math.ceil(L / n);
  const out = new Array(L);
  readOrder(L, key, complete).forEach((pos, k) => { out[pos] = chars[k]; });
  const grid = Array.from({ length: rows }, (_, r) => Array.from({ length: n }, (_, c) => {
    const i = r * n + c;
    return i < L ? { ch: out[i], kind: 'plain' } : { ch: '', kind: 'empty' };
  }));
  return { text: out.join(''), grid, rows, n, length: L, heights: columnHeights(L, n, complete), segments: segmentsOf(L, key, complete) };
}

// 二重転置。1段目の暗号文を2段目の鍵でもう一度転置する（どちらも埋字なし）
export function encryptDouble(text, key1, key2) {
  const first = encrypt(text, key1, { complete: false });
  if (first.error) return first;
  const second = encrypt(first.cipher, key2, { complete: false });
  return { first, second, cipher: second.cipher };
}

export function decryptDouble(cipher, key1, key2) {
  const second = decrypt(cipher, key2, { complete: false });
  if (second.error) return second;
  const first = decrypt(second.text, key1, { complete: false });
  return { second, first, text: first.text };
}

// 末尾の埋字を除く。埋字は最大でも「列数−1」文字なので、それより多くは除かない
export function stripTrailingPadding(text, padChar, n) {
  const chars = Array.from(String(text ?? ''));
  let removed = 0;
  while (removed < n - 1 && removed < chars.length && chars[chars.length - 1 - removed] === padChar) removed++;
  return { text: chars.slice(0, chars.length - removed).join(''), removed };
}

// 復号の grid で、除いた埋字のセルを kind: 'pad' にする（行優先の末尾から数える）
export function markTrailingPadding(grid, removed) {
  const marked = grid.map(row => row.map(cell => ({ ...cell })));
  let left = removed;
  for (let r = marked.length - 1; r >= 0 && left > 0; r--) {
    for (let c = marked[r].length - 1; c >= 0 && left > 0; c--) {
      if (marked[r][c].kind === 'plain') { marked[r][c].kind = 'pad'; left--; }
    }
  }
  return marked;
}

// 暗号文から空白を除く（5文字区切りなど）
export function stripWhitespace(text) {
  return String(text ?? '').replace(/\s+/gu, '');
}

// 列ごとの読み出し順位（1始まり）。Myszkowski式では同じ文字の列が同じ順位になる
export function displayRank(key) {
  return key.rank.map(r => r + 1);
}

// 鍵順に列を並べ替えた grid（読み出し順の表）
export function reorderGrid(grid, key) {
  return grid.map(row => key.order.map(col => row[col]));
}
