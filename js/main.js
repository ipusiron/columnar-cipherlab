// ===== メインエントリーポイント =====

import { initTabs } from './tabs.js';
import { initEncryption } from './encryption.js';
import { initDecryption } from './decryption.js';
import { initDouble } from './double.js';
import { initLab, loadLabCipher } from './lab.js';
import { parseShareHash } from './share.js';
import { initI18n } from './i18n.js';
import { setText } from './utils.js';
import { initTheme } from './theme.js';
import { initHelp } from './help.js';

// デバッグ用ログ関数。URL に ?debug=1 を付けたときだけ出す（入力した文はどの場合も出さない）
const DEBUG = new URLSearchParams(window.location.search).get('debug') === '1';
function debugLog(module, message, data = null) {
  if (!DEBUG) return;
  const prefix = `[${new Date().toLocaleTimeString()}] [${module}]`;
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// グローバルからアクセス可能にする
window.debugLog = debugLog;

// DOMContentLoadedイベントで初期化。1つが失敗しても、ほかの機能は動かす
document.addEventListener('DOMContentLoaded', () => {
  const steps = [
    ['i18n', initI18n],
    ['theme', initTheme],
    ['help', initHelp],
    ['tabs', initTabs],
    ['encryption', initEncryption],
    ['decryption', initDecryption],
    ['double', initDouble],
    ['lab', initLab]
  ];
  for (const [name, init] of steps) {
    try {
      init();
      debugLog('MAIN', `${name} initialized`);
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
    }
  }
  // 起動したことを file-check.js に知らせる（file:// の案内を出すかどうかの判定に使う）
  document.documentElement.dataset.ready = 'true';
  applyShare();
  window.addEventListener('hashchange', applyShare);
});

// 共有リンク（#tab=…）を開いたら、暗号文と設定を入れる。値は parseShareHash で検証済みのものだけ使う
function applyShare() {
  const shared = parseShareHash(window.location.hash);
  if (!shared) return;
  const $ = id => document.getElementById(id);
  if (shared.error) {
    setText($('lab-share-note'), shared.error.key);
    $('lab-share-note').classList.remove('hidden');
    $('tabbtn-lab').click();
    return;
  }
  const note = $(shared.tab === 'dec' ? 'dec-share-note' : 'lab-share-note');
  if (shared.tab === 'lab') {
    loadLabCipher(shared.cipher, shared.complete);
    $('tabbtn-lab').click();
    setText(note, 'share.loadedProblem');
  } else {
    $('dec-cipher').value = shared.cipher;
    $('dec-ignore-space').checked = !/\s/u.test(shared.cipher);
    $('dec-use-key').checked = shared.keyType !== 'none';
    if (shared.keyType === 'none') {
      $('dec-col-num').value = shared.key;
    } else {
      document.querySelector(`input[name="dec-keytype"][value="${shared.keyType}"]`).checked = true;
      $('dec-keyword').value = shared.keyType === 'keyword' ? shared.key : '';
      $('dec-numeric').value = shared.keyType === 'numeric' ? shared.key : '';
      $('dec-myszkowski').checked = shared.myszkowski;
    }
    $('dec-complete').checked = shared.complete;
    if (shared.complete) $('dec-padchar').value = shared.padChar;
    $('dec-autostrip').checked = !shared.nulls;
    $('dec-complete').dispatchEvent(new Event('change'));
    $('dec-cipher').dispatchEvent(new Event('input'));
    $('tabbtn-dec').click();
    setText(note, shared.nulls ? 'share.loadedAnswerNulls' : 'share.loadedAnswer');
  }
  note.classList.remove('hidden');
}
