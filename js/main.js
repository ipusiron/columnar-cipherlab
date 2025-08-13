// ===== メインエントリーポイント =====

import { initTabs } from './tabs.js';
import { initEncryption } from './encryption.js';
import { initDecryption } from './decryption.js';

// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('Initializing Columnar CipherLab...');
  
  // 各モジュールの初期化
  initTabs();
  initEncryption();
  initDecryption();
  
  console.log('Initialization complete.');
});