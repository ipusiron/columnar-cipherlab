// file:// で開いたときは ES modules が読み込めず何も動かないので、HTTP での開き方を案内する
document.addEventListener('DOMContentLoaded', function () {
  if (window.location.protocol === 'file:') {
    var notice = document.getElementById('file-notice');
    if (notice) notice.classList.remove('hidden');
  }
});
