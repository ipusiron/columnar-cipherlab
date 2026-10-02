// 読み込みの最初にテーマを当てる（ダーク→ライトのちらつきを防ぐ）
// 保存した選択 → OS の設定（prefers-color-scheme）の順。Storage が使えなくても動く
(function () {
  var theme = null;
  try {
    theme = window.localStorage.getItem('theme');
  } catch (e) {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
})();
