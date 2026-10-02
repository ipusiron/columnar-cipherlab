// ===== 復号タブのロジック =====

import { parseKey, validatePadChar, decrypt, stripTrailingPadding, markTrailingPadding, stripWhitespace, displayRank } from './columnar-core.js';
import { el, renderGrid, showOrderBadges, showMessages, copyToClipboard, showToast } from './utils.js';
import { t, tr } from './messages.js';

export function initDecryption() {
  window.debugLog('DECRYPT', 'Initializing decryption module');

  // DOM要素の取得
  const $ = id => document.getElementById(id);
  const decKeyTypeInputs = document.querySelectorAll('input[name="dec-keytype"]');
  const decKeywordRow = $('dec-keyword-row');
  const decNumericRow = $('dec-numeric-row');
  const decCipher = $('dec-cipher');
  const decKeyword = $('dec-keyword');
  const decNumeric = $('dec-numeric');
  const decUseKey = $('dec-use-key');
  const decKeySettings = $('dec-key-settings');
  const decNoKeySettings = $('dec-no-key-settings');
  const decColNum = $('dec-col-num');
  const decComplete = $('dec-complete');
  const decPaddingRow = $('dec-padding-row');
  const decAutoStrip = $('dec-autostrip');
  const decIgnoreSpace = $('dec-ignore-space');
  const decPadChar = $('dec-padchar');
  const decRun = $('dec-run');
  const decClear = $('dec-clear');
  const decPlain = $('dec-plain');
  const decError = $('dec-error');
  const decNotice = $('dec-notice');
  const decStale = $('dec-stale');
  const decOrderSpan = $('dec-order');
  const decGridDiv = $('dec-grid');
  const decCopyBtn = $('dec-copy');
  const decSyncBtn = $('dec-sync');
  const decVisualSection = $('dec-visual-section');
  const decResultSection = $('dec-result-section');
  const decPlainDisplay = $('dec-plain-display');
  const resultSections = [decVisualSection, decResultSection];

  let hasResult = false;
  let selectedRow = -1;

  // 同期ボタンの有効/無効
  function updateSyncButtonState() {
    const ready = Boolean(window.encryptionState && window.encryptionState.cipher);
    decSyncBtn.disabled = !ready;
    decSyncBtn.title = t(ready ? 'sync.titleReady' : 'sync.titleEmpty');
  }
  window.updateSyncButtonState = updateSyncButtonState;

  const keyType = () => document.querySelector('input[name="dec-keytype"]:checked').value;

  function readForm() {
    return {
      cipherRaw: decCipher.value,
      useKey: decUseKey.checked,
      keyType: keyType(),
      keyword: decKeyword.value,
      numeric: decNumeric.value,
      columns: decColNum.value,
      complete: decComplete.checked,
      padChar: decPadChar.value,
      autoStrip: decAutoStrip.checked,
      ignoreSpace: decIgnoreSpace.checked
    };
  }

  // 入力の検証。ボタンの状態・Enter・実行のすべてがこの判定を通る
  function validate(form) {
    const errors = [];
    const key = parseKey(form);
    if (key.error) errors.push(key.error);
    if (form.useKey && form.keyType === 'keyword' && form.numeric.trim()) errors.push({ key: 'warn.otherFieldKeyword', warn: true });
    if (form.useKey && form.keyType === 'numeric' && form.keyword.trim()) errors.push({ key: 'warn.otherFieldNumeric', warn: true });
    if (form.complete) {
      const pad = validatePadChar(form.padChar);
      if (pad.error) errors.push(pad.error);
    }
    const cipher = form.ignoreSpace ? stripWhitespace(form.cipherRaw) : form.cipherRaw;
    if (!cipher.trim()) errors.push({ key: 'dec.empty' });
    const blocking = errors.filter(e => !e.warn);
    return { key: key.error ? null : key, cipher, errors, ok: blocking.length === 0 };
  }

  const isQuiet = e => /Empty$|dec\.empty$/.test(e.key);

  function updateDecryptButtonState() {
    const v = validate(readForm());
    showMessages(decError, v.errors.filter(e => !isQuiet(e)).map(tr));
    decRun.disabled = !v.ok;
    return v;
  }

  function markStale() {
    if (!hasResult) return;
    resultSections.forEach(s => s.classList.add('is-stale'));
    decStale.textContent = t('info.stale');
    decStale.classList.remove('hidden');
  }

  function clearStale() {
    resultSections.forEach(s => s.classList.remove('is-stale'));
    decStale.textContent = '';
    decStale.classList.add('hidden');
  }

  function refreshForm() {
    decKeySettings.classList.toggle('hidden', !decUseKey.checked);
    decNoKeySettings.classList.toggle('hidden', decUseKey.checked);
    decPaddingRow.classList.toggle('hidden', !decComplete.checked);
    decAutoStrip.closest('.field').classList.toggle('hidden', !decComplete.checked);
    const isKeyword = keyType() === 'keyword';
    decKeywordRow.classList.toggle('hidden', !isKeyword);
    decNumericRow.classList.toggle('hidden', isKeyword);
    updateDecryptButtonState();
  }

  refreshForm();
  updateSyncButtonState();

  const onChanged = () => { refreshForm(); markStale(); };
  [decUseKey, decComplete, decAutoStrip, decIgnoreSpace, ...decKeyTypeInputs].forEach(i => i.addEventListener('change', onChanged));
  [decCipher, decKeyword, decNumeric, decPadChar, decColNum].forEach(i => i.addEventListener('input', onChanged));

  // 鍵・埋字・列数の欄で Enter、暗号文欄で Ctrl+Enter を押したら実行する
  [decKeyword, decNumeric, decPadChar, decColNum].forEach(i => i.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (!decRun.disabled) run();
    }
  }));
  decCipher.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault();
      if (!decRun.disabled) run();
    }
  });

  // 行のハイライト（表の行 ↔ 復号結果の文字）
  function highlightRow(row, cls) {
    document.querySelectorAll(`#tab-dec .${cls}`).forEach(n => n.classList.remove(cls));
    if (row < 0) return;
    decGridDiv.querySelectorAll(`[data-row="${row}"]`).forEach(n => n.classList.add(cls));
    decPlainDisplay.querySelectorAll(`[data-row="${row}"]`).forEach(n => n.classList.add(cls));
  }

  function selectRow(row) {
    selectedRow = selectedRow === row ? -1 : row;
    highlightRow(selectedRow, 'row-highlight');
    decGridDiv.querySelectorAll('.row-btn').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.row) === selectedRow)));
  }

  for (const container of [decGridDiv, decPlainDisplay]) {
    container.addEventListener('mouseover', e => {
      const node = e.target.closest('[data-row]');
      if (hasResult && node) highlightRow(Number(node.dataset.row), 'row-hover');
    });
    container.addEventListener('mouseleave', () => highlightRow(-1, 'row-hover'));
    container.addEventListener('click', e => {
      const node = e.target.closest('[data-row]');
      if (hasResult && node) selectRow(Number(node.dataset.row));
    });
  }

  // 復号結果を行ごとに色分けして出す（埋字として除いたセルは出さない）
  function renderPlainDisplay(grid) {
    const spans = [];
    grid.forEach((row, r) => row.forEach(cell => {
      if (cell.kind === 'plain') spans.push(el('span', { className: 'plain-char', text: cell.ch, attrs: { 'data-row': String(r) } }));
    }));
    decPlainDisplay.replaceChildren(...spans);
  }

  // クリア
  decClear.addEventListener('click', () => {
    decCipher.value = '';
    decPlain.value = '';
    decKeyword.value = '';
    decNumeric.value = '';
    decGridDiv.replaceChildren();
    decOrderSpan.textContent = '';
    decPlainDisplay.replaceChildren();
    showMessages(decNotice, []);
    hasResult = false;
    selectedRow = -1;
    clearStale();
    resultSections.forEach(s => s.classList.add('hidden'));
    updateDecryptButtonState();
  });

  // 暗号化タブの結果を同期する
  decSyncBtn.addEventListener('click', () => {
    const state = window.encryptionState;
    if (!state || !state.cipher) {
      showToast(t('toast.syncNone'), 'error');
      return;
    }
    decCipher.value = state.cipher;
    // 空白を残した暗号文なら、空白を無視しない
    decIgnoreSpace.checked = !/\s/u.test(state.cipher);
    decUseKey.checked = state.useKey;
    if (state.useKey && state.keyType) {
      document.querySelector(`input[name="dec-keytype"][value="${state.keyType === 'numeric' ? 'numeric' : 'keyword'}"]`).checked = true;
      decKeyword.value = state.keyType === 'keyword' ? state.keyword || '' : '';
      decNumeric.value = state.keyType === 'numeric' ? state.numeric || '' : '';
    } else if (!state.useKey) {
      decColNum.value = state.colNum || 5;
    }
    decComplete.checked = state.complete;
    if (state.complete) decPadChar.value = state.padChar || 'X';
    refreshForm();
    markStale();
    showToast(t('toast.synced'), 'success');
  });

  // コピー
  decCopyBtn.addEventListener('click', () => {
    if (decPlain.value) copyToClipboard(decPlain.value, decCopyBtn, decPlain);
  });

  // 復号を実行する
  function run() {
    const form = readForm();
    const v = validate(form);
    if (!v.ok) {
      showMessages(decError, v.errors.map(tr));
      return;
    }
    const result = decrypt(v.cipher, v.key, { complete: form.complete });
    if (result.error) {
      showMessages(decError, [tr(result.error)]);
      return;
    }
    showMessages(decError, v.errors.map(tr));
    let text = result.text;
    let grid = result.grid;
    const notices = [];
    if (form.complete && form.autoStrip) {
      const stripped = stripTrailingPadding(result.text, form.padChar, v.key.n);
      text = stripped.text;
      grid = markTrailingPadding(result.grid, stripped.removed);
      notices.push(stripped.removed
        ? t('info.padStripped', { pad: form.padChar, count: stripped.removed })
        : t('info.padKept'));
    }
    showMessages(decNotice, notices);

    hasResult = true;
    selectedRow = -1;
    clearStale();
    decPlain.value = text;
    renderPlainDisplay(grid);
    showOrderBadges(decOrderSpan, displayRank(v.key));
    renderGrid(decGridDiv, grid, { ranks: displayRank(v.key), rowButtons: true });
    resultSections.forEach(s => s.classList.remove('hidden'));
  }

  decRun.addEventListener('click', run);
}
