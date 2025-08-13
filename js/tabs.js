// ===== タブ切り替えロジック =====

export function initTabs() {
  window.debugLog('TABS', '🔧 Setting up tab system...');
  
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  window.debugLog('TABS', `📑 Found ${tabButtons.length} tab buttons and ${tabContents.length} tab contents`);

  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.tab;
      const targetTab = document.getElementById(`tab-${targetId}`);
      
      if (!targetTab) {
        window.debugLog('TABS', `❌ Tab with id 'tab-${targetId}' not found`);
        return;
      }
      
      window.debugLog('TABS', `🔄 Switching to tab: ${targetId}`);
      
      // Remove active from all
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(s => s.classList.remove('active'));
      
      // Add active to clicked
      btn.classList.add('active');
      targetTab.classList.add('active');
      
      // 復号タブに切り替えた時は同期ボタンの状態を更新
      if (targetId === 'dec' && window.updateSyncButtonState) {
        window.debugLog('TABS', '🔄 Updating sync button state for decryption tab');
        window.updateSyncButtonState();
      }
      
      window.debugLog('TABS', `✅ Successfully switched to tab: ${targetId}`);
    });
  });
  
  window.debugLog('TABS', '✅ Tab system event listeners configured');
}