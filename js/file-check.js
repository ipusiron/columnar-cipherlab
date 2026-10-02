// file:// で開いたときは ES modules が読み込めず何も動かないので、HTTP での開き方を案内する
// 言語は ?lang=ja|en → 保存した選択 → ブラウザーの言語の順（i18n.js と同じ）。モジュールではないので、ここで決める
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.protocol !== 'file:') return;
  var notice = document.getElementById('file-notice');
  if (!notice) return;
  var lang = new URLSearchParams(window.location.search).get('lang');
  if (lang !== 'ja' && lang !== 'en') {
    try {
      lang = window.localStorage.getItem('lang');
    } catch (e) {
      lang = null;
    }
  }
  if (lang !== 'ja' && lang !== 'en') lang = /^ja/i.test(navigator.language || '') ? 'ja' : 'en';
  var parts = notice.querySelectorAll('[data-lang]');
  for (var i = 0; i < parts.length; i++) parts[i].hidden = parts[i].getAttribute('data-lang') !== lang;
  document.documentElement.lang = lang;
  notice.classList.remove('hidden');
});
