// ヘルプモーダル機能

export function initHelp() {
  const helpButton = document.getElementById('help-button');
  const helpModal = document.getElementById('help-modal');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
  
  window.debugLog('HELP', '🔧 Setting up help modal event listeners...');
  
  // ヘルプボタンクリックでモーダル表示
  helpButton.addEventListener('click', () => {
    window.debugLog('HELP', '📖 Opening help modal');
    helpModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 背景スクロール防止
  });
  
  // 閉じるボタンでモーダルを閉じる
  modalClose.addEventListener('click', () => {
    window.debugLog('HELP', '❌ Closing help modal (close button)');
    closeModal();
  });
  
  // 背景クリックでモーダルを閉じる
  modalBackdrop.addEventListener('click', () => {
    window.debugLog('HELP', '🖱️ Closing help modal (background click)');
    closeModal();
  });
  
  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !helpModal.classList.contains('hidden')) {
      window.debugLog('HELP', '⌨️ Closing help modal (ESC key)');
      closeModal();
    }
  });
  
  function closeModal() {
    helpModal.classList.add('hidden');
    document.body.style.overflow = ''; // スクロール復活
    window.debugLog('HELP', '✅ Help modal closed');
  }
  
  window.debugLog('HELP', '✅ Help modal event listeners configured');
}