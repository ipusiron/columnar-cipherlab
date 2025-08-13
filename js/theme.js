// テーマ切り替え機能

export function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  
  // 初期テーマを確認（デフォルトはダークモード）
  const savedTheme = localStorage.getItem('theme') || 'dark';
  window.debugLog('THEME', `📱 Loading saved theme: ${savedTheme}`);
  
  applyTheme(savedTheme);
  updateButtonText(savedTheme);
  
  window.debugLog('THEME', `🎨 Theme applied: ${savedTheme}`);
  
  // ボタンクリックイベント
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    window.debugLog('THEME', `🔄 Theme switching: ${currentTheme} → ${newTheme}`);
    
    applyTheme(newTheme);
    updateButtonText(newTheme);
    localStorage.setItem('theme', newTheme);
    
    window.debugLog('THEME', `💾 Theme saved to localStorage: ${newTheme}`);
  });
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function updateButtonText(theme) {
  const themeToggle = document.getElementById('theme-toggle');
  if (theme === 'light') {
    themeToggle.textContent = '🌙';
    themeToggle.title = 'ダークモードに切り替えます';
  } else {
    themeToggle.textContent = '☀️';
    themeToggle.title = 'ライトモードに切り替えます';
  }
}