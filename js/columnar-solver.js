// ===== 解読ラボの中核（DOMに依存しない） =====
// 鍵のわからない縦列転置の暗号文を、鍵長ごとに全部の並べ方で復号し、英語らしさで順位を付ける。
// 英語らしさ＝英字の隣り合う2文字の組の log10 確率（100倍）の平均。値が大きい（0に近い）ほど英語らしい。

import { BIGRAM_LOG10X100, ENGLISH_FREQ } from './english-stats.js';
import { keyFromOrder, columnHeights } from './columnar-core.js';

export const SOLVER_MIN_KEY = 2;
export const SOLVER_MAX_KEY = 8;
export const SOLVER_MAX_LENGTH = 1000;
export const MIN_LETTERS = 40;
export const CHI_TRANSPOSITION = 80;
// 作業台の色分け: 隣り合う2列の組の平均がこれ以上なら自然、これ以下なら不自然
// （英文から6行×2列を2,000回切り出した参照実装の検算: 正しい並びの下位25%点 −247、でたらめな並びの上位25%点 −255）
export const PAIR_GOOD = -248;
export const PAIR_BAD = -258;

const T = BIGRAM_LOG10X100;

// 文字を 0〜25（半角の A〜Z、大文字小文字を区別しない）、それ以外を −1 に変える
export function letterCodes(text) {
  return Int8Array.from(Array.from(String(text ?? '')), ch => {
    const c = ch.charCodeAt(0);
    if (ch.length !== 1) return -1;
    if (c >= 65 && c <= 90) return c - 65;
    if (c >= 97 && c <= 122) return c - 97;
    return -1;
  });
}

// 文の英語らしさ。英字以外をはさむ組は数えない
export function bigramScore(text) {
  const codes = letterCodes(text);
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i + 1 < codes.length; i++) {
    if (codes[i] < 0 || codes[i + 1] < 0) continue;
    sum += T[codes[i] * 26 + codes[i + 1]];
    pairs++;
  }
  return { score: pairs ? sum / pairs : null, pairs };
}

// 転置か換字かの見分け方（Day034 と同じ）。英字の出現回数を英語の頻度とカイ二乗で比べる
export function transpositionCheck(text) {
  const counts = new Array(26).fill(0);
  let n = 0;
  for (const c of letterCodes(text)) {
    if (c >= 0) { counts[c]++; n++; }
  }
  if (n < MIN_LETTERS) return { verdict: 'short', letters: n, chi: null };
  let chi = 0;
  for (let i = 0; i < 26; i++) {
    const e = (ENGLISH_FREQ[i] / 100) * n;
    chi += (counts[i] - e) ** 2 / e;
  }
  chi = Math.round(chi * 10) / 10;
  return { verdict: chi <= CHI_TRANSPOSITION ? 'transposition' : 'substitution', letters: n, chi };
}

// 列の並べ方を全部たどる（Heap のアルゴリズム）。同じ配列を書き換えて渡すので、残すときは写す
function forEachPermutation(n, visit) {
  const a = Array.from({ length: n }, (_, i) => i);
  const c = new Array(n).fill(0);
  visit(a);
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const j = i % 2 ? c[i] : 0;
      [a[j], a[i]] = [a[i], a[j]];
      visit(a);
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

// 解読の準備。step() を呼ぶたびに1つの（鍵長, モード）を調べる。画面は step() の合間に進み具合を描ける
export function createSolver(cipher, { minKey = SOLVER_MIN_KEY, maxKey = SOLVER_MAX_KEY, modes = ['incomplete', 'complete'], crib = '', limit = 10 } = {}) {
  const chars = Array.from(String(cipher ?? ''));
  const L = chars.length;
  const codes = letterCodes(cipher);
  const cribText = String(crib ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  const upper = chars.map(ch => ch.toUpperCase());
  // 長さが鍵長の倍数なら、完全モードと不完全モードの復号は同じになるので、鍵長ごとに1回だけ調べる
  const tasks = [];
  for (let n = Math.max(SOLVER_MIN_KEY, minKey); n <= Math.min(SOLVER_MAX_KEY, maxKey, L); n++) {
    const multiple = L % n === 0;
    if (modes.includes('incomplete') || (modes.includes('complete') && multiple)) tasks.push({ n, complete: multiple });
  }
  const keep = Math.max(limit * 4, 40);
  let best = [];
  let tried = 0;
  let index = 0;

  function consider(cand) {
    if (best.length >= keep && cand.score <= best[best.length - 1].score) return;
    best.push(cand);
    best.sort((a, b) => b.score - a.score || a.n - b.n);
    if (best.length > keep) best.length = keep;
  }

  function run({ n, complete }) {
    const heights = columnHeights(L, n, complete);
    const rows = Math.ceil(L / n);
    const startOf = new Int32Array(n);
    forEachPermutation(n, order => {
      tried++;
      let start = 0;
      for (let k = 0; k < n; k++) {
        startOf[order[k]] = start;
        start += heights[order[k]];
      }
      let sum = 0;
      let pairs = 0;
      let prev = -1;
      let text = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < n; c++) {
          if (r >= heights[c]) continue;
          const p = startOf[c] + r;
          const code = codes[p];
          if (prev >= 0 && code >= 0) {
            sum += T[prev * 26 + code];
            pairs++;
          }
          prev = code;
          if (cribText) text += upper[p];
        }
      }
      if (cribText && !text.includes(cribText)) return;
      const score = pairs ? sum / pairs : -Infinity;
      consider({ n, complete, order: order.slice(), score });
    });
  }

  return {
    total: tasks.length,
    get done() { return index; },
    get tried() { return tried; },
    current: () => tasks[index] || null,
    finished: () => index >= tasks.length,
    step() {
      if (index < tasks.length) run(tasks[index++]);
      return index < tasks.length;
    },
    // 結果: 同じ平文になる候補は1つにまとめ、英語らしさの順に limit 件
    // complete が真の候補は、長さが鍵長の倍数（完全モードでも不完全モードでも同じ復号になる）
    results() {
      const seen = new Set();
      const out = [];
      for (const cand of best) {
        const key = keyFromOrder(cand.order);
        const heights = columnHeights(L, cand.n, cand.complete);
        const startOf = [];
        let start = 0;
        for (const col of cand.order) { startOf[col] = start; start += heights[col]; }
        let text = '';
        for (let r = 0; r < Math.ceil(L / cand.n); r++) {
          for (let c = 0; c < cand.n; c++) if (r < heights[c]) text += chars[startOf[c] + r];
        }
        if (seen.has(text)) continue;
        seen.add(text);
        out.push({ n: cand.n, complete: cand.complete, order: cand.order, key, text, score: Math.round(cand.score * 10) / 10 });
        if (out.length >= limit) break;
      }
      return out;
    }
  };
}

// まとめて解く（テストと小さな入力用）
export function solve(cipher, options = {}) {
  const solver = createSolver(cipher, options);
  while (solver.step()) { /* 次の鍵長へ */ }
  return solver.results();
}

// 隣り合う2列の組の自然さ（作業台の色分け）。grid は復号の grid（行×列のセル）
export function adjacentPairScores(grid) {
  const n = grid[0]?.length || 0;
  const out = [];
  for (let c = 0; c + 1 < n; c++) {
    let sum = 0;
    let pairs = 0;
    for (const row of grid) {
      const a = letterCodes(row[c]?.ch || '')[0];
      const b = letterCodes(row[c + 1]?.ch || '')[0];
      if (a === undefined || b === undefined || a < 0 || b < 0) continue;
      sum += T[a * 26 + b];
      pairs++;
    }
    const avg = pairs ? Math.round((sum / pairs) * 10) / 10 : null;
    out.push({ avg, pairs, level: avg === null ? 'none' : avg >= PAIR_GOOD ? 'good' : avg <= PAIR_BAD ? 'bad' : 'fair' });
  }
  return out;
}

// 完全モードで考えられる鍵長（暗号文の長さの約数のうち、総当たりの範囲にあるもの）
export function completeKeyLengths(length) {
  const out = [];
  for (let n = SOLVER_MIN_KEY; n <= SOLVER_MAX_KEY; n++) if (length % n === 0 && n <= length) out.push(n);
  return out;
}
