// ===== 暗号化タブのロジック =====

import { MAX_INPUT_LENGTH, normalizeText, parseKey, validatePadChar, encrypt, reorderGrid, displayRank } from './columnar-core.js';
import { el, renderGrid, showOrderBadges, showMessages, copyToClipboard, setText } from './utils.js';
import { getLang } from './messages.js';
import { loadPresets, getPresetById } from './presets.js';
import { buildShareHash } from './share.js';

const emptyState = () => ({
  cipher: null,
  keyType: null,
  keyword: null,
  numeric: null,
  myszkowski: false,
  useKey: true,
  complete: true,
  padChar: 'X',
  colNum: 5
});

export function initEncryption() {
  window.debugLog('ENCRYPT', 'Initializing encryption module');

  // DOM要素の取得
  const $ = id => document.getElementById(id);
  const encKeyTypeInputs = document.querySelectorAll('input[name="enc-keytype"]');
  const encKeywordRow = $('enc-keyword-row');
  const encNumericRow = $('enc-numeric-row');
  const encPlain = $('enc-plain');
  const encKeyword = $('enc-keyword');
  const encNumeric = $('enc-numeric');
  const encMyszkowski = $('enc-myszkowski');
  const encMyszRow = $('enc-myszkowski-row');
  const encUseKey = $('enc-use-key');
  const encKeySettings = $('enc-key-settings');
  const encNoKeySettings = $('enc-no-key-settings');
  const encColNum = $('enc-col-num');
  const encComplete = $('enc-complete');
  const encPaddingRow = $('enc-padding-row');
  const encPadChar = $('enc-padchar');
  const encStrip = $('enc-stripspace');
  const encStripSymbol = $('enc-stripsymbol');
  const encUpper = $('enc-uppercase');
  const encRun = $('enc-run');
  const encClear = $('enc-clear');
  const encSample = $('enc-sample');
  const encSampleMenu = $('enc-sample-menu');
  const encCipher = $('enc-cipher');
  const encError = $('enc-error');
  const encNotice = $('enc-notice');
  const encStale = $('enc-stale');
  const encOrderSpan = $('enc-order');
  const encGridDiv = $('enc-grid');
  const encCopyBtn = $('enc-copy');
  const encIntermediateSection = $('enc-intermediate-section');
  const encVisualSection = $('enc-visual-section');
  const encResultSection = $('enc-result-section');
  const encFormattedText = $('enc-formatted-text');
  const encCharCount = $('enc-char-count');
  const encColCount = $('enc-col-count');
  const encRowCount = $('enc-row-count');
  const encReorderBtn = $('enc-reorder');
  const encReorderedSection = $('enc-reordered-section');
  const encReorderedGrid = $('enc-reordered-grid');
  const encCipherDisplay = $('enc-cipher-display');
  const encShareUrl = $('enc-share-url');
  const resultSections = [encIntermediateSection, encVisualSection, encResultSection];

  // 直前の暗号化の結果（並べ替えとハイライトで使う）
  let current = null;
  let selectedPos = -1;

  // 暗号化状態をグローバルに保存（復号タブの同期ボタンが読む）
  window.encryptionState = emptyState();

  const keyType = () => document.querySelector('input[name="enc-keytype"]:checked').value;

  function readForm() {
    return {
      plainRaw: encPlain.value,
      useKey: encUseKey.checked,
      keyType: keyType(),
      keyword: encKeyword.value,
      numeric: encNumeric.value,
      myszkowski: encMyszkowski.checked,
      columns: encColNum.value,
      complete: encComplete.checked,
      padChar: encPadChar.value,
      stripSpace: encStrip.checked,
      stripSymbol: encStripSymbol.checked,
      uppercase: encUpper.checked
    };
  }

  // 入力の検証。ボタンの状態・Enter・実行のすべてがこの判定を通る
  function validate(form) {
    const errors = [];
    const warnings = [];
    const key = parseKey(form);
    if (key.error) errors.push(key.error);
    if (form.useKey && form.keyType === 'keyword' && form.numeric.trim()) warnings.push({ key: 'warn.otherFieldKeyword' });
    if (form.useKey && form.keyType === 'numeric' && form.keyword.trim()) warnings.push({ key: 'warn.otherFieldNumeric' });
    if (form.complete) {
      const pad = validatePadChar(form.padChar);
      if (pad.error) errors.push(pad.error);
    }
    const hasPlain = form.plainRaw.trim().length > 0;
    if (!hasPlain) errors.push({ key: 'enc.noInput' });
    return { key: key.error ? null : key, errors, warnings, ok: errors.length === 0 };
  }

  // 未入力（〜Empty・noInput）は入力の途中なので箱には出さず、ボタンだけ止める
  const isQuiet = e => /Empty$|noInput$/.test(e.key);

  function updateEncryptButtonState() {
    const v = validate(readForm());
    showMessages(encError, [...v.errors.filter(e => !isQuiet(e)), ...v.warnings]);
    encRun.disabled = !v.ok;
    return v;
  }

  // 結果が表示されているときに入力が変わったら、結果が古いことを知らせる
  function markStale() {
    if (!current) return;
    resultSections.forEach(s => s.classList.add('is-stale'));
    setText(encStale, 'info.stale');
    encStale.classList.remove('hidden');
  }

  function clearStale() {
    resultSections.forEach(s => s.classList.remove('is-stale'));
    encStale.textContent = '';
    encStale.classList.add('hidden');
  }

  function onInputChanged() {
    updateEncryptButtonState();
    markStale();
  }

  function updatePaddingRowVisibility() {
    encPaddingRow.classList.toggle('hidden', !encComplete.checked);
  }

  function updateKeySettingsVisibility() {
    encKeySettings.classList.toggle('hidden', !encUseKey.checked);
    encNoKeySettings.classList.toggle('hidden', encUseKey.checked);
  }

  function updateKeyTypeRows() {
    const isKeyword = keyType() === 'keyword';
    encKeywordRow.classList.toggle('hidden', !isKeyword);
    encMyszRow.classList.toggle('hidden', !isKeyword);
    encNumericRow.classList.toggle('hidden', isKeyword);
  }

  function refreshForm() {
    updateKeySettingsVisibility();
    updatePaddingRowVisibility();
    updateKeyTypeRows();
    updateEncryptButtonState();
  }

  refreshForm();

  encUseKey.addEventListener('change', () => { refreshForm(); markStale(); });
  encKeyTypeInputs.forEach(r => r.addEventListener('change', () => { refreshForm(); markStale(); }));
  encComplete.addEventListener('change', () => { refreshForm(); markStale(); });
  encMyszkowski.addEventListener('change', () => { refreshForm(); markStale(); });
  [encStrip, encStripSymbol, encUpper].forEach(c => c.addEventListener('change', onInputChanged));
  [encPlain, encKeyword, encNumeric, encPadChar, encColNum].forEach(i => i.addEventListener('input', onInputChanged));

  // 鍵・埋字・列数の欄で Enter を押したら実行する（ボタンと同じ判定）
  [encKeyword, encNumeric, encPadChar, encColNum].forEach(i => i.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (!encRun.disabled) run();
    }
  }));
  // 平文欄では Ctrl+Enter（Mac は Cmd+Enter）で実行する
  encPlain.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault();
      if (!encRun.disabled) run();
    }
  });

  // サンプル設定を適用する
  async function applySamplePreset(presetId) {
    const preset = await getPresetById(presetId);
    if (!preset) return;
    encPlain.value = preset.plaintext;
    if (preset.keyType === 'numeric') {
      encNumeric.value = preset.numeric || '';
      encKeyword.value = '';
      document.querySelector('input[name="enc-keytype"][value="numeric"]').checked = true;
    } else {
      encKeyword.value = preset.keyword || '';
      encNumeric.value = '';
      document.querySelector('input[name="enc-keytype"][value="keyword"]').checked = true;
    }
    const s = preset.settings;
    encUseKey.checked = s.useKey;
    encComplete.checked = s.complete;
    encPadChar.value = s.padChar || 'X';
    encStrip.checked = s.stripSpace;
    encStripSymbol.checked = s.stripSymbol;
    encUpper.checked = s.uppercase;
    encMyszkowski.checked = Boolean(s.myszkowski);
    if (s.colNum && !s.useKey) encColNum.value = s.colNum;
    refreshForm();
    markStale();
  }

  function closeSampleMenu() {
    encSampleMenu.classList.add('hidden');
    encSample.setAttribute('aria-expanded', 'false');
  }

  encSample.addEventListener('click', e => {
    e.stopPropagation();
    const open = encSampleMenu.classList.toggle('hidden') === false;
    encSample.setAttribute('aria-expanded', String(open));
    if (open) encSampleMenu.querySelector('.sample-option')?.focus();
  });
  document.addEventListener('click', closeSampleMenu);
  encSampleMenu.addEventListener('keydown', e => {
    const items = [...encSampleMenu.querySelectorAll('.sample-option')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { closeSampleMenu(); encSample.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  });

  // 列の対応のハイライト（pos は読み出しのまとまりの順位、0始まり。標準の鍵では1列ずつ）
  function highlight(pos, cls) {
    document.querySelectorAll(`#tab-enc .${cls}`).forEach(n => n.classList.remove(cls));
    if (!current || pos < 0) return;
    const key = current.key;
    for (const col of key.groups[pos]) {
      encGridDiv.querySelectorAll(`[data-col="${col}"]`).forEach(n => n.classList.add(cls));
      encReorderedGrid.querySelectorAll(`[data-col="${key.order.indexOf(col)}"]`).forEach(n => n.classList.add(cls));
    }
    encCipherDisplay.querySelectorAll(`[data-seg="${pos}"]`).forEach(n => n.classList.add(cls));
  }

  // 元の表の列 → 読み出し順位／並べ替えた表の列 → 読み出し順位
  const posFromOriginal = node => current.key.rank[Number(node.dataset.col)];
  const posFromReordered = node => current.key.rank[current.key.order[Number(node.dataset.col)]];

  function select(pos) {
    selectedPos = selectedPos === pos ? -1 : pos;
    highlight(selectedPos, 'column-highlight');
    document.querySelectorAll('#tab-enc .col-btn').forEach(b => {
      const p = b.closest('#enc-grid') ? posFromOriginal(b) : posFromReordered(b);
      b.setAttribute('aria-pressed', String(p === selectedPos));
    });
  }

  function bindHighlight(container, toPos) {
    container.addEventListener('mouseover', e => {
      const node = e.target.closest('[data-col]');
      if (current && node) highlight(toPos(node), 'col-hover');
    });
    container.addEventListener('mouseleave', () => highlight(-1, 'col-hover'));
    container.addEventListener('click', e => {
      const node = e.target.closest('[data-col]');
      if (current && node) select(toPos(node));
    });
  }
  bindHighlight(encGridDiv, posFromOriginal);
  bindHighlight(encReorderedGrid, posFromReordered);
  encCipherDisplay.addEventListener('mouseover', e => {
    const node = e.target.closest('[data-seg]');
    if (current && node) highlight(Number(node.dataset.seg), 'col-hover');
  });
  encCipherDisplay.addEventListener('mouseleave', () => highlight(-1, 'col-hover'));
  encCipherDisplay.addEventListener('click', e => {
    const node = e.target.closest('[data-seg]');
    if (current && node) select(Number(node.dataset.seg));
  });

  function renderCipherDisplay(result) {
    const chars = Array.from(result.cipher);
    const spans = [];
    result.segments.forEach((seg, pos) => {
      for (let i = seg.start; i < seg.start + seg.length; i++) {
        spans.push(el('span', { className: 'cipher-char', text: chars[i], attrs: { 'data-seg': String(pos) } }));
      }
    });
    encCipherDisplay.replaceChildren(...spans);
  }

  function hideResults() {
    resultSections.forEach(s => s.classList.add('hidden'));
    encReorderedSection.classList.add('hidden');
  }

  // クリア
  encClear.addEventListener('click', () => {
    encPlain.value = '';
    encCipher.value = '';
    encKeyword.value = '';
    encNumeric.value = '';
    encGridDiv.replaceChildren();
    encReorderedGrid.replaceChildren();
    encOrderSpan.textContent = '';
    encCipherDisplay.replaceChildren();
    showMessages(encNotice, []);
    current = null;
    selectedPos = -1;
    clearStale();
    hideResults();
    window.encryptionState = emptyState();
    if (window.updateSyncButtonState) window.updateSyncButtonState();
    updateEncryptButtonState();
  });

  // 鍵順に並び替えた表を出す
  encReorderBtn.addEventListener('click', () => {
    if (!current) return;
    const ranks = current.key.order.map(c => current.key.rank[c] + 1);
    renderGrid(encReorderedGrid, reorderGrid(current.result.grid, current.key), { ranks, colButtons: true });
    encReorderedSection.classList.remove('hidden');
    highlight(selectedPos, 'column-highlight');
  });

  // コピー
  encCopyBtn.addEventListener('click', () => {
    if (encCipher.value) copyToClipboard(encCipher.value, encCopyBtn, encCipher);
  });

  // 共有リンク（平文は含めない）
  function share(withKey, button) {
    const s = window.encryptionState;
    if (!s || !s.cipher) return;
    const keyType = s.useKey ? s.keyType : 'none';
    const key = keyType === 'keyword' ? s.keyword : keyType === 'numeric' ? s.numeric : String(s.colNum);
    const hash = buildShareHash({ cipher: s.cipher, complete: s.complete, withKey, keyType, key, myszkowski: s.myszkowski, padChar: s.padChar });
    encShareUrl.value = window.location.href.split('#')[0] + hash;
    encShareUrl.classList.remove('hidden');
    copyToClipboard(encShareUrl.value, button, encShareUrl);
  }
  $('enc-share-problem').addEventListener('click', e => share(false, e.currentTarget));
  $('enc-share-answer').addEventListener('click', e => share(true, e.currentTarget));

  // 暗号化を実行する
  function run() {
    const form = readForm();
    const v = validate(form);
    if (!v.ok) {
      showMessages(encError, v.errors);
      return;
    }
    const norm = normalizeText(form.plainRaw.trim(), form);
    const padChar = form.padChar;
    const result = encrypt(norm.text, v.key, { complete: form.complete, padChar });
    if (result.error) {
      showMessages(encError, [result.error]);
      return;
    }
    showMessages(encError, v.warnings);
    const notices = [];
    if (norm.truncated) notices.push({ key: 'warn.truncated', params: { max: MAX_INPUT_LENGTH, length: norm.inputLength } });
    if (result.endsWithPad) notices.push({ key: 'warn.endsWithPad', params: { pad: padChar } });
    showMessages(encNotice, notices);

    current = { result, key: v.key, padChar };
    selectedPos = -1;
    clearStale();

    encFormattedText.textContent = norm.text;
    encCharCount.textContent = String(result.length);
    encColCount.textContent = String(result.n);
    encRowCount.textContent = String(result.rows);
    showOrderBadges(encOrderSpan, displayRank(v.key));
    renderGrid(encGridDiv, result.grid, { ranks: displayRank(v.key), colButtons: true });
    encReorderedGrid.replaceChildren();
    encReorderedSection.classList.add('hidden');
    renderCipherDisplay(result);
    encCipher.value = result.cipher;
    encShareUrl.value = '';
    encShareUrl.classList.add('hidden');
    resultSections.forEach(s => s.classList.remove('hidden'));

    window.encryptionState = {
      cipher: result.cipher,
      keyType: form.useKey ? form.keyType : null,
      keyword: form.useKey && form.keyType === 'keyword' ? form.keyword.trim() : null,
      numeric: form.useKey && form.keyType === 'numeric' ? form.numeric.trim() : null,
      myszkowski: form.useKey && form.keyType === 'keyword' && form.myszkowski,
      useKey: form.useKey,
      complete: form.complete,
      padChar,
      colNum: form.useKey ? null : v.key.n
    };
    if (window.updateSyncButtonState) window.updateSyncButtonState();
  }

  encRun.addEventListener('click', run);

  // サンプルの一覧を作る（言語を切り替えたら作り直す）
  async function initializePresetUI() {
    const presetData = await loadPresets();
    const en = getLang() === 'en';
    encSampleMenu.replaceChildren(...presetData.presets.map(preset => {
      const option = el('button', {
        className: 'sample-option', text: (en && preset.name_en) || preset.name,
        attrs: { type: 'button', role: 'menuitem', 'data-preset': preset.id, title: (en && preset.description_en) || preset.description }
      });
      option.addEventListener('click', e => {
        e.stopPropagation();
        applySamplePreset(preset.id);
        closeSampleMenu();
        encSample.focus();
      });
      return option;
    }));
  }
  initializePresetUI();
  document.addEventListener('langchange', initializePresetUI);
}
