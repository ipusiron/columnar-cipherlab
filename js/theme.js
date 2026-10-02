// テーマ切り替え機能
// 最初のテーマは theme-init.js が読み込み前に当てている。ここはボタンの表示と切り替えだけ

import { t } from './messages.js';

export function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const currentTheme = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  updateButton(themeToggle, currentTheme());

  themeToggle.addEventListener('click', () => {
    const newTheme = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    updateButton(themeToggle, newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch (e) {
      // 保存できない環境でも、このページを開いている間は切り替わる
    }
  });
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function updateButton(button, theme) {
  const icon = button.querySelector('span') || button;
  icon.textContent = theme === 'light' ? '🌙' : '☀️';
  const label = t(theme === 'light' ? 'theme.toDark' : 'theme.toLight');
  button.title = label;
  button.setAttribute('aria-label', label);
}
