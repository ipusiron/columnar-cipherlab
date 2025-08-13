// ===== 共通ユーティリティ関数 =====

// HTMLエスケープ関数（XSS対策）
export function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// 入力テキストの正規化
export function normalizeInput(text, { stripSpace, stripSymbol, uppercase }) {
  let t = String(text || '').slice(0, 10000); // 長さ制限でDoS防止
  if (stripSpace) t = t.replace(/\s+/g, '');
  if (stripSymbol) t = t.replace(/[^\w]/g, '');
  if (uppercase) t = t.toUpperCase();
  return t;
}

// キーワードから列順序を計算
export function keywordOrder(keyword) {
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

// 数列から列順序を計算
export function numericOrder(str) {
  let nums;
  if (/[,\s]/.test(str)) {
    nums = str.split(/[\s,]+/).filter(Boolean).map(Number);
  } else {
    nums = [...str].map(d => Number(d));
  }
  if (nums.length === 0) return { error: '鍵数列が空です。' };
  if (nums.some(n => !Number.isInteger(n) || n < 1)) return { error: '鍵数列には1以上の整数を入力してください。' };
  // 重複チェック
  const set = new Set(nums);
  if (set.size !== nums.length) {
    return { error: '鍵数列に重複があります。重複のない数列（例: 3 1 4 2）を使用してください。' };
  }
  // 連続性と範囲チェック
  const sorted = [...nums].sort((a, b) => a - b);
  const max = Math.max(...nums);
  const expectedSet = new Set(Array.from({length: nums.length}, (_, i) => i + 1));
  const actualSet = new Set(nums);
  
  // 1からnまでの連続した数値でない場合はエラー
  if (max !== nums.length) {
    return { error: `鍵数列は1から${nums.length}までの連続した数値を使用してください。例: ${Array.from({length: Math.min(nums.length, 5)}, (_, i) => i + 1).join(' ')}${nums.length > 5 ? '...' : ''}` };
  }
  
  for (let i = 1; i <= nums.length; i++) {
    if (!actualSet.has(i)) {
      return { error: `鍵数列に${i}が含まれていません。1から${nums.length}までのすべての数値を使用してください。` };
    }
  }
  const entries = nums.map((v, idx) => ({ v, idx }));
  const sortedEntries = entries.slice().sort((a, b) => a.v - b.v || a.idx - b.idx);
  const order = sortedEntries.map(e => e.idx);
  const rank = new Array(nums.length);
  sortedEntries.forEach((e, i) => { rank[e.idx] = i; });
  return { order, rank, n: nums.length };
}

// グリッドを行方向に構築
export function buildGridByRows(text, nCols, padChar, complete) {
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

// グリッドの可視化
export function renderGrid(el, grid, headerText, orderInfo, padChar, isEncryption = true) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  let html = '<table class="table">';
  
  // ヘッダ1：列インデックス（1スタート）
  html += '<thead><tr><th>#</th>';
  for (let c = 0; c < cols; c++) {
    html += `<th>${c + 1}</th>`;
  }
  html += '</tr>';
  
  // ヘッダ2：鍵順（rank） or order 表示
  html += '<tr><th>鍵順</th>';
  if (orderInfo && orderInfo.rank) {
    for (let c = 0; c < cols; c++) {
      // 数列の数値をそのまま表示（1ベース）
      html += `<th>${orderInfo.rank[c] + 1}</th>`;
    }
  } else {
    for (let c = 0; c < cols; c++) html += '<th>–</th>';
  }
  html += '</tr></thead>';

  // 本体
  html += '<tbody>';
  for (let r = 0; r < rows; r++) {
    html += `<tr><th>${r + 1}</th>`;
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      let cls = '';
      if (ch === '') {
        cls = 'empty';
      } else if (ch === padChar) {
        cls = 'pad';
      } else {
        cls = 'plaintext';
      }
      
      html += `<td class="${cls}">${escapeHtml(ch) || '·'}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

// 列順序バッジの表示
export function showOrderBadges(span, order) {
  if (!order) { span.textContent = '–'; return; }
  span.innerHTML = order.map(idx => `<span class="key-badge">${escapeHtml(idx)}</span>`).join('');
}

// トースト通知
export function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// クリップボードへコピー
export function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.classList.add('copied');
    button.textContent = '✓';
    showToast('クリップボードにコピーしました', 'success');
    setTimeout(() => {
      button.classList.remove('copied');
      button.textContent = originalText;
    }, 2000);
  }).catch(err => {
    showToast('コピーに失敗しました', 'error');
  });
}