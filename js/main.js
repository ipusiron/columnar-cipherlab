// ===== メインエントリーポイント =====

import { initTabs } from './tabs.js';
import { initEncryption } from './encryption.js';
import { initDecryption } from './decryption.js';
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
    ['theme', initTheme],
    ['help', initHelp],
    ['tabs', initTabs],
    ['encryption', initEncryption],
    ['decryption', initDecryption]
  ];
  for (const [name, init] of steps) {
    try {
      init();
      debugLog('MAIN', `${name} initialized`);
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
    }
  }
});
