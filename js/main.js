// ===== メインエントリーポイント =====

import { initTabs } from './tabs.js';
import { initEncryption } from './encryption.js';
import { initDecryption } from './decryption.js';
import { initTheme } from './theme.js';
import { initHelp } from './help.js';

// デバッグ用ログ関数
function debugLog(module, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[${timestamp}] [${module}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// グローバルからアクセス可能にする
window.debugLog = debugLog;

// DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', () => {
  debugLog('MAIN', '🚀 Starting Columnar CipherLab initialization...');
  
  try {
    // 各モジュールの初期化
    debugLog('MAIN', '🎨 Initializing theme system...');
    initTheme();
    debugLog('MAIN', '✅ Theme system initialized');
    
    debugLog('MAIN', '❓ Initializing help system...');
    initHelp();
    debugLog('MAIN', '✅ Help system initialized');
    
    debugLog('MAIN', '📑 Initializing tab system...');
    initTabs();
    debugLog('MAIN', '✅ Tab system initialized');
    
    debugLog('MAIN', '🔒 Initializing encryption module...');
    initEncryption();
    debugLog('MAIN', '✅ Encryption module initialized');
    
    debugLog('MAIN', '🔓 Initializing decryption module...');
    initDecryption();
    debugLog('MAIN', '✅ Decryption module initialized');
    
    debugLog('MAIN', '🎉 All modules initialized successfully!');
    
    // 環境情報をログ出力
    debugLog('MAIN', '🌍 Environment info:', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      theme: document.documentElement.getAttribute('data-theme') || 'dark'
    });
    
  } catch (error) {
    debugLog('MAIN', '❌ Initialization failed:', error);
    console.error('Failed to initialize Columnar CipherLab:', error);
  }
});