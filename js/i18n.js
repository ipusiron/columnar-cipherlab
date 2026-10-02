// ===== 日英の切り替え =====
// 初期の言語: ?lang=ja|en → 保存した選択 → ブラウザーの言語（日本語以外は英語）
// index.html の data-i18n*（固定の文言）と、スクリプトが setText などで出した文言（data-msg-*）を、言語に合わせて書き直す

import { LANGS, setLang, getLang, t } from './messages.js';
import { showMessages } from './utils.js';

const STORAGE_KEY = 'lang';

export function detectLang() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(saved)) return saved;
  } catch (e) {
    // 保存領域が使えない環境ではブラウザーの言語で決める
  }
  return /^ja\b/i.test(navigator.language || '') ? 'ja' : 'en';
}

const parse = json => (json ? JSON.parse(json) : {});

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    root.querySelectorAll(`[data-i18n-${attr}]`).forEach(n => n.setAttribute(attr, t(n.getAttribute(`data-i18n-${attr}`))));
  }
  root.querySelectorAll('[data-msg-key]').forEach(n => { n.textContent = t(n.dataset.msgKey, parse(n.dataset.msgParams)); });
  root.querySelectorAll('[data-msg-attr]').forEach(n => {
    n.setAttribute(n.dataset.msgAttr, t(n.dataset.msgAttrKey, parse(n.dataset.msgAttrParams)));
  });
  root.querySelectorAll('[data-msgs]').forEach(n => showMessages(n, JSON.parse(n.dataset.msgs)));
  root.querySelectorAll('[data-lang]').forEach(n => { n.hidden = n.dataset.lang !== getLang(); });
  // 表示中のトースト（数秒で消えるお知らせ）は切り替える前の言語なので消す
  document.querySelectorAll('.toast').forEach(n => n.remove());
  document.documentElement.lang = getLang();
  const toggle = document.getElementById('lang-toggle');
  if (toggle) {
    const next = getLang() === 'ja' ? 'en' : 'ja';
    toggle.textContent = next === 'en' ? 'EN' : t('lang.toJapanese');
    toggle.lang = next;
    const label = t(next === 'en' ? 'lang.toEnglish' : 'lang.toJapanese');
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
  }
}

export function initI18n() {
  setLang(detectLang());
  applyI18n();
  const toggle = document.getElementById('lang-toggle');
  toggle?.addEventListener('click', () => {
    const next = getLang() === 'ja' ? 'en' : 'ja';
    setLang(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // 保存できなくても、このページを開いている間は切り替わる
    }
    applyI18n();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: next } }));
  });
}
