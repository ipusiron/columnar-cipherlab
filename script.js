// ===== タブ切り替え =====
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    document.getElementById(`tab-${id}`).classList.add('active');
  });
});

// ===== 鍵タイプの切替（暗号化） =====
const encKeyTypeInputs = document.querySelectorAll('input[name="enc-keytype"]');
const encKeywordRow = document.getElementById('enc-keyword-row');
const encNumericRow = document.getElementById('enc-numeric-row');
encKeyTypeInputs.forEach(r => r.addEventListener('change', () => {
  const v = document.querySelector('input[name="enc-keytype"]:checked').value;
  encKeywordRow.classList.toggle('hidden', v !== 'keyword');
  encNumericRow.classList.toggle('hidden', v !== 'numeric');
}));

// ===== 鍵タイプの切替（復号） =====
const decKeyTypeInputs = document.querySelectorAll('input[name="dec-keytype"]');
const decKeywordRow = document.getElementById('dec-keyword-row');
const decNumericRow = document.getElementById('dec-numeric-row');
decKeyTypeInputs.forEach(r => r.addEventListener('change', () => {
  const v = document.querySelector('input[name="dec-keytype"]:checked').value;
  decKeywordRow.classList.toggle('hidden', v !== 'keyword');
  decNumericRow.classList.toggle('hidden', v !== 'numeric');
}));

// ===== ユーティリティ =====
function normalizeInput(text, { stripSpace, uppercase }) {
  let t = text;
  if (stripSpace) t = t.replace(/\s+/g, '');
  if (uppercase) t = t.toUpperCase();
  return t;
}

function keywordOrder(keyword) {
  const arr = [...keyword];
  if (arr.length === 0) return null;
  const entries = arr.map((ch, idx) => ({ ch, idx }));
  const sorted = entries.slice().sort((a, b) => {
    const c = a.ch.localeCompare(b.ch, 'ja');
    return c !== 0 ? c : a.idx - b.idx; // 同字は左を優先
  });
  const order = sorted.map(e => e.idx); // 鍵順で読む列の元インデックス列
  const rank = new Array(arr.length);
  sorted.forEach((e, i) => { rank[e.idx] = i; });
  return { order, rank, n: arr.length };
}

function numericOrder(str) {
  let nums;
  if (/[,\s]/.test(str)) {
    nums = str.split(/[\s,]+/).filter(Boolean).map(Number);
  } else {
    nums = [...str].map(d => Number(d));
  }
  if (nums.length === 0) return { error: '鍵数列が空です。' };
  if (nums.some(n => !Number.isInteger(n) || n < 0)) return { error: '鍵数列には0以上の整数を入力してください。' };
  // 重複チェック
  const set = new Set(nums);
  if (set.size !== nums.length) {
    return { error: '鍵数列に重複があります。重複のない数列（例: 3 1 4 2）を使用してください。' };
  }
  // 連続性チェック（警告のみ）
  const sorted = [...nums].sort((a, b) => a - b);
  const isSequential = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  if (!isSequential || sorted[0] !== 1) {
    console.warn('鍵数列は1から始まる連続した数値（1..n）を推奨します。');
  }
  const entries = nums.map((v, idx) => ({ v, idx }));
  const sorted = entries.slice().sort((a, b) => a.v - b.v || a.idx - b.idx);
  const order = sorted.map(e => e.idx);
  const rank = new Array(nums.length);
  sorted.forEach((e, i) => { rank[e.idx] = i; });
  return { order, rank, n: nums.length };
}

function buildGridByRows(text, nCols, padChar, complete) {
  const len = text.length;
  const rows = Math.ceil(len / nCols) || 1;
  const total = complete ? rows * nCols : len;
  const grid = Array.from({ length: rows }, () => Array(nCols).fill(''));
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / nCols);
    const c = i % nCols;
    grid[r][c] = i < len ? text[i] : padChar;
  }
  return { grid, rows };
}

function renderGrid(el, grid, headerText, orderInfo, padChar, isEncryption = true) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  let html = '<table class="table">';
  
  // ヘッダ1：列インデックス
  html += '<thead><tr><th>#</th>';
  for (let c = 0; c < cols; c++) {
    const highlightClass = orderInfo && orderInfo.order && orderInfo.order[0] === c ? ' highlight' : '';
    html += `<th class="${highlightClass}">${c}</th>`;
  }
  html += '</tr>';
  
  // ヘッダ2：鍵順（rank） or order 表示
  html += '<tr><th>鍵順</th>';
  if (orderInfo && orderInfo.rank) {
    for (let c = 0; c < cols; c++) {
      const highlightClass = orderInfo.rank[c] === 0 ? ' highlight' : '';
      html += `<th class="${highlightClass}">${orderInfo.rank[c]}</th>`;
    }
  } else {
    for (let c = 0; c < cols; c++) html += '<th>–</th>';
  }
  html += '</tr></thead>';

  // 本体
  html += '<tbody>';
  for (let r = 0; r < rows; r++) {
    html += `<tr><th>${r}</th>`;
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      let cls = ch === '' ? 'empty' : (ch === padChar ? 'pad' : '');
      // 最初の列（鍵順0）をハイライト
      if (orderInfo && orderInfo.order && orderInfo.order[0] === c) {
        cls += ' highlight';
      }
      html += `<td class="${cls}">${ch || '·'}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

function showOrderBadges(span, order) {
  if (!order) { span.textContent = '–'; return; }
  span.innerHTML = order.map(idx => `<span class="key-badge">${idx}</span>`).join('');
}

// ===== コピー機能とトースト =====
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    button.classList.add('copied');
    button.textContent = '✓';
    showToast('クリップボードにコピーしました');
    setTimeout(() => {
      button.classList.remove('copied');
      button.textContent = '📋';
    }, 2000);
  }).catch(err => {
    showToast('コピーに失敗しました');
  });
}

// ===== 暗号化 =====
const encPlain = document.getElementById('enc-plain');
const encKeyword = document.getElementById('enc-keyword');
const encNumeric = document.getElementById('enc-numeric');
const encComplete = document.getElementById('enc-complete');
const encPadChar = document.getElementById('enc-padchar');
const encStrip = document.getElementById('enc-stripspace');
const encUpper = document.getElementById('enc-uppercase');
const encRun = document.getElementById('enc-run');
const encClear = document.getElementById('enc-clear');
const encSample = document.getElementById('enc-sample');
const encCipher = document.getElementById('enc-cipher');
const encError = document.getElementById('enc-error');
const encOrderSpan = document.getElementById('enc-order');
const encGridDiv = document.getElementById('enc-grid');
const encCopyBtn = document.getElementById('enc-copy');

encSample.addEventListener('click', () => {
  encPlain.value = 'WE ARE DISCOVERED FLEE AT ONCE';
  document.querySelector('input[name="enc-keytype"][value="keyword"]').checked = true;
  encKeywordRow.classList.remove('hidden');
  encNumericRow.classList.add('hidden');
  encKeyword.value = 'ZEBRAS';
  encComplete.checked = true;
  encPadChar.value = 'X';
  encStrip.checked = true;
  encUpper.checked = true;
});

encClear.addEventListener('click', () => {
  encPlain.value = '';
  encCipher.value = '';
  encError.classList.add('hidden');
  encGridDiv.innerHTML = '';
  encOrderSpan.textContent = '';
});

encCopyBtn.addEventListener('click', () => {
  const text = encCipher.value;
  if (text) copyToClipboard(text, encCopyBtn);
});

encRun.addEventListener('click', () => {
  encError.classList.add('hidden');
  try {
    const keyType = document.querySelector('input[name="enc-keytype"]:checked').value;
    const complete = encComplete.checked;
    const padChar = (encPadChar.value || 'X')[0];

    const rawPlain = encPlain.value.trim();
    if (!rawPlain) throw new Error('平文を入力してください。');
    
    const plain = normalizeInput(rawPlain, { stripSpace: encStrip.checked, uppercase: encUpper.checked });
    if (!plain.length) throw new Error('平文が空です（スペース削除後）。');

    let keyInfo;
    if (keyType === 'keyword') {
      const keyword = encKeyword.value.trim();
      if (!keyword) throw new Error('キーワードを入力してください。');
      if (keyword.length < 2) throw new Error('キーワードは2文字以上にしてください。');
      keyInfo = keywordOrder(keyword);
    } else {
      const numStr = encNumeric.value.trim();
      if (!numStr) throw new Error('鍵数列を入力してください。');
      keyInfo = numericOrder(numStr);
      if (keyInfo && keyInfo.error) throw new Error(keyInfo.error);
    }
    if (!keyInfo || keyInfo.n <= 0) throw new Error('鍵の解析に失敗しました。');
    if (keyInfo.n > plain.length) {
      console.warn('鍵の長さが平文より長いです。暗号化は可能ですが、セキュリティが低下する可能性があります。');
    }

    const n = keyInfo.n;
    const { grid, rows } = buildGridByRows(plain, n, padChar, complete);

    // 列を鍵順に縦読み
    let cipher = '';
    for (const origIdx of keyInfo.order) {
      for (let r = 0; r < rows; r++) {
        const ch = grid[r][origIdx];
        if (ch) cipher += ch;
      }
    }
    encCipher.value = cipher;

    showOrderBadges(encOrderSpan, keyInfo.order);
    renderGrid(encGridDiv, grid, '暗号化', keyInfo, padChar);
  } catch (e) {
    encError.textContent = e.message;
    encError.classList.remove('hidden');
  }
});

// ===== 復号 =====
const decCipher = document.getElementById('dec-cipher');
const decKeyword = document.getElementById('dec-keyword');
const decNumeric = document.getElementById('dec-numeric');
const decComplete = document.getElementById('dec-complete');
const decAutoStrip = document.getElementById('dec-autostrip');
const decPadChar = document.getElementById('dec-padchar');
const decRun = document.getElementById('dec-run');
const decClear = document.getElementById('dec-clear');
const decPlain = document.getElementById('dec-plain');
const decError = document.getElementById('dec-error');
const decOrderSpan = document.getElementById('dec-order');
const decGridDiv = document.getElementById('dec-grid');
const decCopyBtn = document.getElementById('dec-copy');

decClear.addEventListener('click', () => {
  decCipher.value = '';
  decPlain.value = '';
  decError.classList.add('hidden');
  decGridDiv.innerHTML = '';
  decOrderSpan.textContent = '';
});

decCopyBtn.addEventListener('click', () => {
  const text = decPlain.value;
  if (text) copyToClipboard(text, decCopyBtn);
});

function decryptColumnar(cipher, keyInfo, complete, padChar) {
  const L = cipher.length;
  const n = keyInfo.n;
  const rows = Math.ceil(L / n) || 1;

  // 列ごとの高さ（元の列順）
  const heights = new Array(n).fill(rows);
  if (!complete) {
    const fullCols = L % n; // 残余分だけ最終行が埋まる
    if (fullCols > 0) {
      // 最終行が部分的に埋まる場合
      for (let c = 0; c < n; c++) heights[c] = rows - 1;
      for (let c = 0; c < fullCols; c++) heights[c] = rows; // 左から fullCols 本
    }
  }

  // 鍵順に暗号文を割り当て、元の列へ格納
  const cols = Array.from({ length: n }, () => []);
  let pos = 0;
  for (const origIdx of keyInfo.order) {
    const h = heights[origIdx];
    const segment = cipher.slice(pos, pos + h);
    cols[origIdx] = [...segment];
    pos += h;
  }

  // 行優先に読み出して平文へ
  let plain = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < n; c++) {
      const ch = cols[c][r];
      if (ch !== undefined) plain += ch;
    }
  }

  if (complete && decAutoStrip.checked) {
    const re = new RegExp(`${padChar}+$`);
    plain = plain.replace(re, '');
  }

  // 可視化用グリッド
  const grid = Array.from({ length: rows }, () => Array(n).fill(''));
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < cols[c].length; r++) {
      grid[r][c] = cols[c][r] || '';
    }
  }

  return { plain, grid, rows };
}

decRun.addEventListener('click', () => {
  decError.classList.add('hidden');
  try {
    const keyType = document.querySelector('input[name="dec-keytype"]:checked').value;
    const complete = decComplete.checked;
    const padChar = (decPadChar.value || 'X')[0];

    const rawCipher = decCipher.value.trim();
    if (!rawCipher) throw new Error('暗号文を入力してください。');
    
    const cipher = rawCipher.replace(/\s+/g, '');
    if (!cipher.length) throw new Error('暗号文が空です（スペース削除後）。');

    let keyInfo;
    if (keyType === 'keyword') {
      const keyword = decKeyword.value.trim();
      if (!keyword) throw new Error('キーワードを入力してください。');
      if (keyword.length < 2) throw new Error('キーワードは2文字以上にしてください。');
      keyInfo = keywordOrder(keyword);
    } else {
      const numStr = decNumeric.value.trim();
      if (!numStr) throw new Error('鍵数列を入力してください。');
      keyInfo = numericOrder(numStr);
      if (keyInfo && keyInfo.error) throw new Error(keyInfo.error);
    }
    if (!keyInfo || keyInfo.n <= 0) throw new Error('鍵の解析に失敗しました。');
    
    // 暗号文の長さチェック
    if (!complete && cipher.length % keyInfo.n === 0) {
      console.warn('不完全モードですが、暗号文の長さが鍵長の倍数です。完全モードの可能性があります。');
    }

    const { plain, grid, rows } = decryptColumnar(cipher, keyInfo, complete, padChar);
    decPlain.value = plain;

    showOrderBadges(decOrderSpan, keyInfo.order);
    renderGrid(decGridDiv, grid, '復号', keyInfo, padChar);
  } catch (e) {
    decError.textContent = e.message;
    decError.classList.remove('hidden');
  }
});
