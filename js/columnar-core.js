// ===== 縦列転置式暗号の中核ロジック（DOMに依存しない） =====
// 文言は持たない。エラーや注意は { key, params } で返し、表示の直前に messages.js で訳す。
// 1マスは1コードポイント（NFCに正規化したあと）として扱う。

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

function orderFromValues(values) {
  const entries = values.map((v, i) => ({ v, i }));
  entries.sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : a.i - b.i));
  const order = entries.map(e => e.i);
  const rank = new Array(values.length);
  entries.forEach((e, k) => { rank[e.i] = k; });
  return { order, rank, n: values.length };
}

// キーワードから列順を決める。大文字小文字は区別しない。同じ文字は左の列を先にする
export function parseKeyword(input) {
  const s = foldKeyInput(input).toUpperCase();
  if (!s) return err('key.keywordEmpty');
  if (!/^[A-Z]+$/.test(s)) return err('key.keywordChars');
  if (s.length < MIN_KEY_LENGTH) return err('key.keywordShort', { min: MIN_KEY_LENGTH });
  if (s.length > MAX_KEY_LENGTH) return err('key.tooLong', { max: MAX_KEY_LENGTH });
  return { ...orderFromValues([...s]), source: s, type: 'keyword' };
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
  return { ...orderFromValues(nums), source: nums.join(' '), type: 'numeric' };
}

// 鍵なし（列を並べ替えない）
export function parseColumnCount(input) {
  const s = foldKeyInput(input);
  if (!/^\d+$/.test(s)) return err('key.columnsRange', { min: MIN_COLUMNS, max: MAX_COLUMNS });
  const n = Number(s);
  if (n < MIN_COLUMNS || n > MAX_COLUMNS) return err('key.columnsRange', { min: MIN_COLUMNS, max: MAX_COLUMNS });
  const order = Array.from({ length: n }, (_, i) => i);
  return { order, rank: order.slice(), n, source: String(n), type: 'none' };
}

// 画面の設定から鍵を作る
export function parseKey({ useKey = true, keyType = 'keyword', keyword = '', numeric = '', columns = '' } = {}) {
  if (!useKey) return parseColumnCount(columns);
  return keyType === 'numeric' ? parseNumericKey(numeric) : parseKeyword(keyword);
}

// 埋字は英字1文字
export function validatePadChar(padChar) {
  return /^[A-Za-z]$/.test(String(padChar ?? '')) ? { ok: true } : err('pad.invalid');
}

// 暗号化。grid は行×列のセル { ch, kind: 'plain' | 'pad' | 'empty' }
export function encrypt(text, key, { complete = true, padChar = 'X' } = {}) {
  const chars = Array.from(String(text ?? ''));
  const L = chars.length;
  if (!L) return err('enc.empty');
  if (complete && !validatePadChar(padChar).ok) return err('pad.invalid');
  const n = key.n;
  const rows = Math.ceil(L / n);
  const total = complete ? rows * n : L;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const i = r * n + c;
      if (i < L) row.push({ ch: chars[i], kind: 'plain' });
      else if (i < total) row.push({ ch: padChar, kind: 'pad' });
      else row.push({ ch: '', kind: 'empty' });
    }
    grid.push(row);
  }
  const out = [];
  const segments = [];
  for (const col of key.order) {
    const start = out.length;
    for (let r = 0; r < rows; r++) {
      if (grid[r][col].kind !== 'empty') out.push(grid[r][col].ch);
    }
    segments.push({ col, start, length: out.length - start });
  }
  const endsWithPad = complete && chars[L - 1] === padChar;
  return { cipher: out.join(''), grid, rows, n, length: L, padCount: total - L, segments, endsWithPad };
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
  const heights = columnHeights(L, n, complete);
  const cols = new Array(n);
  const segments = [];
  let p = 0;
  for (const col of key.order) {
    cols[col] = chars.slice(p, p + heights[col]);
    segments.push({ col, start: p, length: heights[col] });
    p += heights[col];
  }
  const grid = [];
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      if (r < cols[c].length) {
        out.push(cols[c][r]);
        row.push({ ch: cols[c][r], kind: 'plain' });
      } else {
        row.push({ ch: '', kind: 'empty' });
      }
    }
    grid.push(row);
  }
  return { text: out.join(''), grid, rows, n, length: L, heights, segments };
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

// 列順を「列ごとの読み出し順位（1始まり）」として返す
export function displayRank(key) {
  return key.rank.map(r => r + 1);
}

// 鍵順に列を並べ替えた grid（読み出し順の表）
export function reorderGrid(grid, key) {
  return grid.map(row => key.order.map(col => row[col]));
}
