// ===== タブ切り替えロジック =====
// WAI-ARIA のタブの形。左右キー・Home・End で移動し、選んだタブだけが Tab キーで止まる

export function initTabs() {
  const tabButtons = [...document.querySelectorAll('.tab-button')];
  const tabContents = document.querySelectorAll('.tab-content');

  function activate(btn, { focus = false } = {}) {
    const targetTab = document.getElementById(`tab-${btn.dataset.tab}`);
    if (!targetTab) return;
    tabButtons.forEach(b => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    tabContents.forEach(s => s.classList.toggle('active', s === targetTab));
    if (focus) btn.focus();
    // 復号タブに切り替えた時は同期ボタンの状態を更新
    if (btn.dataset.tab === 'dec' && window.updateSyncButtonState) window.updateSyncButtonState();
  }

  tabButtons.forEach((btn, i) => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      activate(btn);
    });
    btn.addEventListener('keydown', e => {
      const last = tabButtons.length - 1;
      const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      activate(tabButtons[next], { focus: true });
    });
  });
}
