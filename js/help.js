// ヘルプモーダル機能
// 開いたら閉じるボタンへフォーカスを移し、Tab はダイアログの中で回す。閉じたら開いたボタンへ戻す

export function initHelp() {
  const helpButton = document.getElementById('help-button');
  const helpModal = document.getElementById('help-modal');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalBody = helpModal.querySelector('.modal-body');
  let opener = null;

  // 本文がスクロールするのでキーボードでも動かせるようにする
  modalBody.tabIndex = 0;

  function openModal() {
    opener = document.activeElement;
    helpModal.classList.remove('hidden');
    document.body.classList.add('modal-open'); // 背景スクロール防止
    modalClose.focus();
  }

  function closeModal() {
    helpModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (opener && typeof opener.focus === 'function') opener.focus();
  }

  helpButton.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);

  helpModal.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = [...helpModal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')]
      .filter(n => !n.disabled && n.offsetParent !== null);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}
