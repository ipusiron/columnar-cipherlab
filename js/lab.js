// ===== 解読ラボタブ =====
// 1. 暗号文の情報（長さ・考えられる鍵長・転置か換字かの目安）
// 2. 総当たり（Web Worker で実行。使えないときは画面のスレッドで鍵長ごとに区切って実行）
// 3. 手で解く作業台（列を左右に入れ替え、隣り合う2列の組の英語らしさを見る）

import { decrypt, keyFromOrder, stripWhitespace, displayRank, encrypt } from './columnar-core.js';
import {
  createSolver, transpositionCheck, adjacentPairScores, completeKeyLengths,
  SOLVER_MIN_KEY, SOLVER_MAX_KEY, SOLVER_MAX_LENGTH, MIN_LETTERS
} from './columnar-solver.js';
import { el, renderGrid, showMessages, setText, setAttrText } from './utils.js';
import { t } from './messages.js';

const FREQUENCY_ANALYZER = 'https://ipusiron.github.io/frequency-analyzer/';
const BENCH_MAX = 20;
// 候補の表に出す復号文の文字数（それより長い分は「…」）
const PREVIEW = 40;
// 例題: 『二都物語』の書き出しを、鍵 PARIS で不完全モードの縦列転置にしたもの
const SAMPLE_PLAIN = 'ITWASTHEBESTOFTIMESITWASTHEWORSTOFTIMESITWASTHEAGEOFWISDOMITWASTHEAGEOFFOOLISHNESS';
const SAMPLE_ORDER = [1, 3, 4, 2, 0];

export function initLab() {
  const $ = id => document.getElementById(id);
  const cipherInput = $('lab-cipher');
  const ignoreSpace = $('lab-ignore-space');
  const info = $('lab-info');
  const minSel = $('lab-min');
  const maxSel = $('lab-max');
  const completeOnly = $('lab-complete-only');
  const crib = $('lab-crib');
  const runBtn = $('lab-run');
  const cancelBtn = $('lab-cancel');
  const errorBox = $('lab-error');
  const progress = $('lab-progress');
  const results = $('lab-results');
  const resultsBody = $('lab-results-body');
  const benchN = $('lab-bench-n');
  const benchCols = $('lab-bench-cols');
  const benchPairs = $('lab-bench-pairs');
  const benchGrid = $('lab-bench-grid');
  const benchKey = $('lab-bench-key');
  const benchText = $('lab-bench-text');

  for (let n = SOLVER_MIN_KEY; n <= SOLVER_MAX_KEY; n++) {
    minSel.appendChild(el('option', { text: String(n), attrs: { value: String(n) } }));
    maxSel.appendChild(el('option', { text: String(n), attrs: { value: String(n) } }));
  }
  minSel.value = String(SOLVER_MIN_KEY);
  maxSel.value = String(SOLVER_MAX_KEY);
  for (let n = 2; n <= BENCH_MAX; n++) benchN.appendChild(el('option', { text: String(n), attrs: { value: String(n) } }));
  benchN.value = '5';

  let worker = null;
  let running = false;
  let candidates = [];
  let benchRank = [0, 1, 2, 3, 4];

  const cipherText = () => (ignoreSpace.checked ? stripWhitespace(cipherInput.value) : cipherInput.value);

  // 1. 暗号文の情報
  function updateInfo() {
    const c = cipherText();
    const L = Array.from(c).length;
    if (!L) {
      info.replaceChildren();
      return;
    }
    const lengths = completeKeyLengths(L);
    const check = transpositionCheck(c);
    const lines = [
      { key: 'lab.length', params: { length: L } },
      lengths.length ? { key: 'lab.completeLengths', params: { list: lengths.join(', ') } } : { key: 'lab.completeNone' },
      check.verdict === 'short'
        ? { key: 'lab.verdict.short', params: { min: MIN_LETTERS, letters: check.letters } }
        : { key: `lab.verdict.${check.verdict}`, params: { chi: check.chi, letters: check.letters } }
    ];
    // 「#」より後ろで渡す（サーバーへ送られず、URLの長さの上限もない。Day009 は #text= を先に読む）
    const link = el('a', { attrs: { href: `${FREQUENCY_ANALYZER}#text=${encodeURIComponent(c)}`, target: '_blank', rel: 'noopener noreferrer' } });
    setText(link, 'lab.day009');
    const items = lines.map(m => {
      const li = el('li');
      setText(li, m.key, m.params);
      return li;
    });
    info.replaceChildren(el('ul', {}, [...items, el('li', {}, [link])]));
  }

  function validate() {
    const errors = [];
    const L = Array.from(cipherText()).length;
    if (!L) errors.push({ key: 'dec.empty', quiet: true });
    if (L > SOLVER_MAX_LENGTH) errors.push({ key: 'lab.tooLong', params: { max: SOLVER_MAX_LENGTH, length: L } });
    if (Number(minSel.value) > Number(maxSel.value)) errors.push({ key: 'lab.range' });
    return { errors, ok: errors.length === 0 };
  }

  function refresh() {
    const v = validate();
    showMessages(errorBox, v.errors.filter(e => !e.quiet));
    runBtn.disabled = running || !v.ok;
    updateInfo();
    renderBench();
  }

  function onCipherChanged() {
    if (candidates.length) {
      results.classList.add('is-stale');
      setText(progress, 'info.stale');
      progress.classList.remove('hidden');
    }
    refresh();
  }

  [cipherInput].forEach(i => i.addEventListener('input', onCipherChanged));
  [ignoreSpace].forEach(i => i.addEventListener('change', onCipherChanged));
  [minSel, maxSel, completeOnly].forEach(i => i.addEventListener('change', refresh));
  crib.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (!runBtn.disabled) run();
    }
  });

  $('lab-sample').addEventListener('click', () => {
    cipherInput.value = encrypt(SAMPLE_PLAIN, keyFromOrder(SAMPLE_ORDER), { complete: false }).cipher;
    crib.value = '';
    onCipherChanged();
  });

  // 2. 総当たり
  function finish(found, tried) {
    running = false;
    worker = null;
    cancelBtn.classList.add('hidden');
    candidates = found;
    results.classList.remove('is-stale');
    setText(progress, found.length ? 'lab.done' : 'lab.none', { tried: tried.toLocaleString('en-US') });
    renderResults();
    refresh();
  }

  function onProgress({ n, done, total }) {
    setText(progress, 'lab.progress', { n, done: done + 1, total });
  }

  function runOnMainThread(cipher, options) {
    const solver = createSolver(cipher, options);
    const tick = () => {
      if (!running) return;
      if (solver.finished()) {
        finish(solver.results(), solver.tried);
        return;
      }
      onProgress({ n: solver.current().n, done: solver.done, total: solver.total });
      solver.step();
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  }

  function run() {
    const v = validate();
    if (!v.ok) {
      showMessages(errorBox, v.errors);
      return;
    }
    const cipher = cipherText();
    const options = {
      minKey: Number(minSel.value),
      maxKey: Number(maxSel.value),
      modes: completeOnly.checked ? ['complete'] : ['incomplete', 'complete'],
      crib: crib.value,
      limit: 10
    };
    running = true;
    runBtn.disabled = true;
    cancelBtn.classList.remove('hidden');
    progress.classList.remove('hidden');
    setText(progress, 'lab.starting');
    try {
      worker = new Worker(new URL('./solver-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = e => {
        if (e.data.type === 'progress') onProgress(e.data);
        if (e.data.type === 'done') {
          worker.terminate();
          finish(e.data.results, e.data.tried);
        }
      };
      worker.onerror = () => {
        worker.terminate();
        worker = null;
        runOnMainThread(cipher, options);
      };
      worker.postMessage({ cipher, options });
    } catch (e) {
      worker = null;
      runOnMainThread(cipher, options);
    }
  }

  runBtn.addEventListener('click', run);
  cancelBtn.addEventListener('click', () => {
    if (worker) worker.terminate();
    worker = null;
    running = false;
    cancelBtn.classList.add('hidden');
    setText(progress, 'lab.cancelled');
    refresh();
  });

  function renderResults() {
    resultsBody.replaceChildren(...candidates.map((cand, i) => {
      const keyText = displayRank(cand.key).join(' ');
      const preview = Array.from(cand.text).slice(0, PREVIEW).join('') + (Array.from(cand.text).length > PREVIEW ? '…' : '');
      const benchBtn = el('button', { className: 'ghost small-btn', attrs: { type: 'button', 'data-i': String(i) } });
      const decBtn = el('button', { className: 'ghost small-btn', attrs: { type: 'button', 'data-i': String(i) } });
      setText(benchBtn, 'lab.toBench');
      setText(decBtn, 'lab.toDecrypt');
      benchBtn.addEventListener('click', () => openInBench(cand));
      decBtn.addEventListener('click', () => sendToDecrypt(cand.key.rank, cipherText()));
      return el('tr', {}, [
        el('td', { text: String(i + 1) }),
        el('td', { text: String(cand.n) }),
        el('td', { className: 'mono', text: keyText }),
        el('td', { text: String(cand.score) }),
        el('td', { className: 'mono preview', text: preview }),
        el('td', { className: 'actions' }, [benchBtn, decBtn])
      ]);
    }));
    results.classList.toggle('hidden', candidates.length === 0);
  }

  // 3. 作業台
  function benchOrder() {
    const order = [];
    benchRank.forEach((r, c) => { order[r] = c; });
    return order;
  }

  function renderBench(focus = null) {
    const n = Number(benchN.value);
    if (benchRank.length !== n) benchRank = Array.from({ length: n }, (_, i) => i);
    const c = cipherText();
    const moveBtn = (col, dir) => {
      const btn = el('button', {
        className: 'ghost small-btn', text: dir < 0 ? '←' : '→',
        attrs: { type: 'button', 'data-col': String(col), 'data-dir': String(dir) }
      });
      setAttrText(btn, 'aria-label', dir < 0 ? 'lab.moveLeft' : 'lab.moveRight', { col: col + 1 });
      return btn;
    };
    const cards = benchRank.map((r, col) => {
      const left = moveBtn(col, -1);
      const right = moveBtn(col, 1);
      left.disabled = col === 0;
      right.disabled = col === n - 1;
      const label = el('span');
      setText(label, 'lab.benchCol', { col: col + 1, rank: r + 1 });
      return el('div', { className: 'bench-col' }, [label, el('div', { className: 'bench-btns' }, [left, right])]);
    });
    benchCols.replaceChildren(...cards);
    if (focus) benchCols.querySelector(`button[data-col="${focus.col}"][data-dir="${focus.dir}"]`)?.focus();
    if (!c) {
      benchPairs.replaceChildren();
      const empty = el('p', { className: 'section-note' });
      setText(empty, 'lab.benchEmpty');
      benchGrid.replaceChildren(empty);
      benchKey.textContent = '';
      benchText.textContent = '';
      return;
    }
    const key = keyFromOrder(benchOrder());
    const d = decrypt(c, key, { complete: false });
    renderGrid(benchGrid, d.grid, { ranks: displayRank(key) });
    benchPairs.replaceChildren(...adjacentPairScores(d.grid).map((p, i) => {
      const span = el('span', { className: `pair pair-${p.level}` });
      setText(span, 'lab.pair', { a: i + 1, b: i + 2, level: { key: `lab.pair.${p.level}` }, avg: p.avg ?? '—' });
      return span;
    }));
    benchKey.textContent = displayRank(key).join(' ');
    benchText.textContent = d.text;
  }

  benchCols.addEventListener('click', e => {
    const btn = e.target.closest('button[data-col]');
    if (!btn) return;
    const col = Number(btn.dataset.col);
    const dir = Number(btn.dataset.dir);
    const other = col + dir;
    if (other < 0 || other >= benchRank.length) return;
    [benchRank[col], benchRank[other]] = [benchRank[other], benchRank[col]];
    const atEdge = other === 0 || other === benchRank.length - 1;
    renderBench({ col: other, dir: atEdge ? -dir : dir });
  });

  benchN.addEventListener('change', () => {
    benchRank = Array.from({ length: Number(benchN.value) }, (_, i) => i);
    renderBench();
  });

  $('lab-bench-reset').addEventListener('click', () => {
    benchRank = Array.from({ length: Number(benchN.value) }, (_, i) => i);
    renderBench();
  });

  $('lab-bench-send').addEventListener('click', () => {
    if (cipherText()) sendToDecrypt(benchRank, cipherText());
  });

  function openInBench(cand) {
    benchN.value = String(cand.n);
    benchRank = cand.key.rank.slice();
    renderBench();
    $('lab-bench-section').scrollIntoView({ block: 'start' });
    benchCols.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }

  // 列ごとの読み出し順位を数列の鍵にして、復号タブで復号する（埋字は除かない＝不完全モード）
  function sendToDecrypt(rank, cipher) {
    const set = (id, prop, value) => { $(id)[prop] = value; };
    set('dec-cipher', 'value', cipher);
    set('dec-ignore-space', 'checked', true);
    set('dec-use-key', 'checked', true);
    document.querySelector('input[name="dec-keytype"][value="numeric"]').checked = true;
    set('dec-numeric', 'value', rank.map(r => r + 1).join(' '));
    set('dec-keyword', 'value', '');
    set('dec-myszkowski', 'checked', false);
    set('dec-complete', 'checked', false);
    $('dec-complete').dispatchEvent(new Event('change'));
    $('dec-cipher').dispatchEvent(new Event('input'));
    $('tabbtn-dec').click();
    if (!$('dec-run').disabled) $('dec-run').click();
    $('tab-dec').scrollIntoView({ block: 'start' });
  }

  refresh();
}

// 共有リンク（問題）から暗号文を入れる
export function loadLabCipher(cipher, complete) {
  const input = document.getElementById('lab-cipher');
  input.value = cipher;
  document.getElementById('lab-ignore-space').checked = true;
  document.getElementById('lab-complete-only').checked = Boolean(complete);
  input.dispatchEvent(new Event('input'));
}
