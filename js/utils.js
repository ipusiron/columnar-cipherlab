// ===== 画面の共通部品 =====
// 変換のロジックは columnar-core.js にある。ここは DOM を組み立てる部品だけ。

import { t } from './messages.js';

// 要素を作る小さな関数（文字は textContent で入れる）
export function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.appendChild(child);
  return node;
}

// マトリクスの表を描く
// grid: 行×列のセル { ch, kind }。ranks: 列ごとの鍵順（1始まり）
// colButtons: 鍵順の見出しをボタンにする（列の選択用）。rowButtons: 行番号をボタンにする
export function renderGrid(container, grid, { ranks = null, colButtons = false, rowButtons = false, caption = '' } = {}) {
  const cols = grid[0]?.length || 0;
  const table = el('table', { className: 'table' });
  if (caption) table.appendChild(el('caption', { className: 'visually-hidden', text: caption }));
  const thead = el('thead');
  const head1 = el('tr', {}, [el('th', { text: '#', attrs: { scope: 'col' } })]);
  for (let c = 0; c < cols; c++) head1.appendChild(el('th', { text: String(c + 1), attrs: { scope: 'col', 'data-col': String(c) } }));
  const head2 = el('tr', {}, [el('th', { text: t('grid.keyRow'), attrs: { scope: 'row' } })]);
  for (let c = 0; c < cols; c++) {
    const label = ranks ? String(ranks[c]) : '–';
    const th = el('th', { attrs: { 'data-col': String(c) } });
    if (colButtons) {
      th.appendChild(el('button', {
        className: 'col-btn', text: label,
        attrs: { type: 'button', 'data-col': String(c), 'aria-pressed': 'false', 'aria-label': t('grid.selectColumn', { col: c + 1, rank: label }) }
      }));
    } else {
      th.textContent = label;
    }
    head2.appendChild(th);
  }
  thead.append(head1, head2);
  const tbody = el('tbody');
  grid.forEach((row, r) => {
    const rowHead = el('th', { attrs: { scope: 'row', 'data-row': String(r) } });
    if (rowButtons) {
      rowHead.appendChild(el('button', {
        className: 'row-btn', text: String(r + 1),
        attrs: { type: 'button', 'data-row': String(r), 'aria-pressed': 'false', 'aria-label': t('grid.selectRow', { row: r + 1 }) }
      }));
    } else {
      rowHead.textContent = String(r + 1);
    }
    const tr = el('tr', {}, [rowHead]);
    row.forEach((cell, c) => {
      const kind = cell.kind === 'pad' ? 'pad' : cell.kind === 'empty' ? 'empty' : 'plaintext';
      tr.appendChild(el('td', { className: kind, text: cell.kind === 'empty' ? '·' : cell.ch, attrs: { 'data-col': String(c), 'data-row': String(r) } }));
    });
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  container.replaceChildren(table);
  return table;
}

// 列順のバッジ
export function showOrderBadges(span, ranks) {
  if (!ranks) { span.textContent = '–'; return; }
  span.replaceChildren(...ranks.map(v => el('span', { className: 'key-badge', text: String(v) })));
}

// 箇条書きのメッセージ（エラー・注意）を出す。空なら隠す
export function showMessages(box, messages) {
  if (!messages.length) {
    box.replaceChildren();
    box.classList.add('hidden');
    return;
  }
  box.replaceChildren(el('ul', {}, messages.map(m => el('li', { text: m }))));
  box.classList.remove('hidden');
}

// トースト通知
export function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = el('div', { className: `toast ${type}`, text: message, attrs: { role: 'status' } });
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// クリップボードへコピー。使えない環境では欄を選択して知らせる
export function copyToClipboard(text, button, source) {
  const fail = () => {
    if (source) source.select();
    showToast(t('toast.copyFailed'), 'error');
  };
  if (!navigator.clipboard || !window.isSecureContext) { fail(); return; }
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.classList.add('copied');
    button.textContent = '✓';
    showToast(t('toast.copied'), 'success');
    setTimeout(() => {
      button.classList.remove('copied');
      button.textContent = originalText;
    }, 2000);
  }).catch(fail);
}
