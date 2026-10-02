import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// base.css の配色（ダーク＝:root、ライト＝:root[data-theme="light"]）を読み、文字と背景の組を検算する
const css = readFileSync(new URL('../css/base.css', import.meta.url), 'utf8');

function vars(selector) {
  const block = css.match(new RegExp(`${selector.replace(/[[\]]/g, '\\$&')} \\{([^}]*)\\}`))[1];
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(m => [m[1], m[2]]));
}
const dark = vars(':root');
const light = { ...dark, ...vars(':root[data-theme="light"]') };

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (top, alpha, under) => rgb(top).map((v, i) => Math.round(v * alpha + rgb(under)[i] * (1 - alpha)))
  .reduce((s, v) => s + v.toString(16).padStart(2, '0'), '#');
function lum(hex) {
  return rgb(hex).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// 画面で文字を置く背景（カードの上の section の薄い重ね）
function surfaces(t, isLight) {
  const section = mix(isLight ? '#000000' : '#ffffff', 0.02, t.card);
  return {
    bg: t.bg,
    card: t.card,
    section,
    setting: mix(isLight ? '#000000' : '#ffffff', 0.02, section),
    tableHead: mix(isLight ? '#2563eb' : '#6aa6ff', isLight ? 0.1 : 0.05, section),
    errorBox: mix('#ff6b6b', 0.1, section)
  };
}

for (const [name, t, isLight] of [['ダーク', dark, false], ['ライト', light, true]]) {
  test(`${name}テーマの文字コントラストは4.5:1以上`, () => {
    const s = surfaces(t, isLight);
    const pairs = [
      ['本文', t.fg, s.section],
      ['見出し', t.fg, s.bg],
      ['ラベル・補足', t.muted, s.setting],
      ['ヘッダーの副題', t.muted, s.bg],
      ['設定の見出し', t.accent, s.setting],
      ['表の見出し', t.accent, s.tableHead],
      ['埋字のセル', t.danger, mix('#ff6b6b', 0.05, s.section)],
      ['エラー', t.danger, s.errorBox],
      ['フッターのリンク', t.accent, s.bg],
      ['実行ボタン', isLight ? '#ffffff' : '#071018', t.accent],
      ['選択中のタブ', isLight ? '#ffffff' : '#071018', t.accent]
    ];
    for (const [label, fg, bg] of pairs) {
      const r = ratio(fg, bg);
      assert.ok(r >= 4.5, `${label} ${fg} on ${bg} = ${r.toFixed(2)}`);
    }
  });
}

test('ライトの配色を読めている', () => {
  assert.equal(light.accent, '#1d4ed8');
  assert.notEqual(light.muted, dark.muted);
});
