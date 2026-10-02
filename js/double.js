// ===== 二重転置タブ =====
// 1段目の鍵で縦列転置し、その暗号文を2段目の鍵でもう一度縦列転置する（埋字なし）。復号は逆の順に戻す

import { normalizeText, parseAnyKey, encryptDouble, decryptDouble, stripWhitespace, displayRank } from './columnar-core.js';
import { renderGrid, showOrderBadges, showMessages, copyToClipboard } from './utils.js';
import { t, tr } from './messages.js';

const SAMPLE = { text: 'WE ARE DISCOVERED FLEE AT ONCE', key1: 'ZEBRAS', key2: 'STRIPE' };

export function initDouble() {
  const $ = id => document.getElementById(id);
  const input = $('dbl-input');
  const key1 = $('dbl-key1');
  const key2 = $('dbl-key2');
  const modeInputs = document.querySelectorAll('input[name="dbl-mode"]');
  const encOptions = $('dbl-enc-options');
  const decOptions = $('dbl-dec-options');
  const stripSpace = $('dbl-stripspace');
  const stripSymbol = $('dbl-stripsymbol');
  const uppercase = $('dbl-uppercase');
  const ignoreSpace = $('dbl-ignore-space');
  const runBtn = $('dbl-run');
  const clearBtn = $('dbl-clear');
  const sampleBtn = $('dbl-sample');
  const errorBox = $('dbl-error');
  const staleNote = $('dbl-stale');
  const result = $('dbl-result-section');
  const output = $('dbl-output');
  const copyBtn = $('dbl-copy');

  let hasResult = false;
  const mode = () => document.querySelector('input[name="dbl-mode"]:checked').value;

  function validate() {
    const errors = [];
    const k1 = parseAnyKey(key1.value);
    const k2 = parseAnyKey(key2.value);
    if (k1.error) errors.push({ key: 'dbl.keyError', params: { which: 1, message: tr(k1.error) }, quiet: /Empty$/.test(k1.error.key) });
    if (k2.error) errors.push({ key: 'dbl.keyError', params: { which: 2, message: tr(k2.error) }, quiet: /Empty$/.test(k2.error.key) });
    if (!input.value.trim()) errors.push({ key: mode() === 'encrypt' ? 'enc.noInput' : 'dec.empty', quiet: true });
    return { k1, k2, errors, ok: errors.length === 0 };
  }

  function refresh() {
    const isEnc = mode() === 'encrypt';
    encOptions.classList.toggle('hidden', !isEnc);
    decOptions.classList.toggle('hidden', isEnc);
    const v = validate();
    showMessages(errorBox, v.errors.filter(e => !e.quiet).map(tr));
    runBtn.disabled = !v.ok;
  }

  function markStale() {
    if (!hasResult) return;
    result.classList.add('is-stale');
    staleNote.textContent = t('info.stale');
    staleNote.classList.remove('hidden');
  }

  function clearStale() {
    result.classList.remove('is-stale');
    staleNote.textContent = '';
    staleNote.classList.add('hidden');
  }

  const onChange = () => { refresh(); markStale(); };
  [input, key1, key2].forEach(i => i.addEventListener('input', onChange));
  [...modeInputs, stripSpace, stripSymbol, uppercase, ignoreSpace].forEach(i => i.addEventListener('change', onChange));
  [key1, key2].forEach(i => i.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      if (!runBtn.disabled) run();
    }
  }));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.isComposing) {
      e.preventDefault();
      if (!runBtn.disabled) run();
    }
  });

  function show(step, { grid, key, title, orderLabel }) {
    $(`dbl-step${step}-title`).textContent = title;
    $(`dbl-step${step}-label`).textContent = orderLabel;
    showOrderBadges($(`dbl-order${step}`), displayRank(key));
    renderGrid($(`dbl-grid${step}`), grid, { ranks: displayRank(key) });
  }

  function run() {
    const v = validate();
    if (!v.ok) {
      showMessages(errorBox, v.errors.map(tr));
      return;
    }
    const isEnc = mode() === 'encrypt';
    let r;
    if (isEnc) {
      const text = normalizeText(input.value.trim(), {
        stripSpace: stripSpace.checked, stripSymbol: stripSymbol.checked, uppercase: uppercase.checked
      }).text;
      r = encryptDouble(text, v.k1, v.k2);
    } else {
      const cipher = ignoreSpace.checked ? stripWhitespace(input.value) : input.value;
      r = decryptDouble(cipher, v.k1, v.k2);
    }
    if (r.error) {
      showMessages(errorBox, [tr(r.error)]);
      return;
    }
    showMessages(errorBox, []);
    if (isEnc) {
      show(1, { grid: r.first.grid, key: v.k1, title: t('dbl.step1Enc'), orderLabel: t('dbl.orderLabel', { which: 1 }) });
      show(2, { grid: r.second.grid, key: v.k2, title: t('dbl.step2Enc'), orderLabel: t('dbl.orderLabel', { which: 2 }) });
      $('dbl-mid-label').textContent = t('dbl.midEnc');
      $('dbl-mid').textContent = r.first.cipher;
      $('dbl-output-title').textContent = t('dbl.outEnc');
      output.value = r.cipher;
    } else {
      show(1, { grid: r.second.grid, key: v.k2, title: t('dbl.step1Dec'), orderLabel: t('dbl.orderLabel', { which: 2 }) });
      show(2, { grid: r.first.grid, key: v.k1, title: t('dbl.step2Dec'), orderLabel: t('dbl.orderLabel', { which: 1 }) });
      $('dbl-mid-label').textContent = t('dbl.midDec');
      $('dbl-mid').textContent = r.second.text;
      $('dbl-output-title').textContent = t('dbl.outDec');
      output.value = r.text;
    }
    hasResult = true;
    clearStale();
    result.classList.remove('hidden');
  }

  runBtn.addEventListener('click', run);

  sampleBtn.addEventListener('click', () => {
    document.querySelector('input[name="dbl-mode"][value="encrypt"]').checked = true;
    input.value = SAMPLE.text;
    key1.value = SAMPLE.key1;
    key2.value = SAMPLE.key2;
    refresh();
    markStale();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    key1.value = '';
    key2.value = '';
    output.value = '';
    hasResult = false;
    clearStale();
    result.classList.add('hidden');
    refresh();
  });

  copyBtn.addEventListener('click', () => {
    if (output.value) copyToClipboard(output.value, copyBtn, output);
  });

  refresh();
}
