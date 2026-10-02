// ===== 画面に出す文言（JSから出すもの） =====
// ロジックは { key, params } を返し、表示の直前に t() で訳す。

const MESSAGES = {
  ja: {
    'key.keywordEmpty': 'キーワードを入力してください。',
    'key.keywordChars': 'キーワードは英字（A〜Z）だけで入力してください。',
    'key.keywordShort': 'キーワードは{min}文字以上にしてください。',
    'key.tooLong': '鍵は{max}列（{max}文字）までにしてください。',
    'key.numericEmpty': '鍵数列を入力してください。',
    'key.numericChars': '鍵数列には数字と区切り（空白・カンマ・読点）だけを使ってください。',
    'key.numericMin': '鍵数列は1以上の整数で入力してください。',
    'key.numericNeedSeparator': '0は使えません。10以上の数を使うときは、空白かカンマで区切ってください（例: 10 1 2 3 4 5 6 7 8 9）。',
    'key.numericShort': '鍵数列は{min}個以上の数を並べてください。',
    'key.numericDuplicate': '鍵数列に{value}が重複しています。',
    'key.numericRange': '鍵数列は1から{n}までを1回ずつ使ってください（{missing}がありません）。',
    'key.columnsRange': '列数は{min}〜{max}の整数で指定してください。',
    'pad.invalid': '埋字（パディング）は英字1文字にしてください。',
    'enc.noInput': '平文を入力してください。',
    'enc.empty': '整形したら平文が空になりました。整形の設定を確認してください。',
    'dec.empty': '暗号文を入力してください。',
    'dec.notMultiple': '完全モードの暗号文は、長さが列数の倍数になります。いまの暗号文は{length}文字、列数は{n}です（{shorter}文字か{longer}文字なら合います）。埋字なしで暗号化した暗号文なら、「完全」のチェックを外してください。',
    'warn.otherFieldKeyword': '数列の欄にも入力があります。いまはキーワードを使います。',
    'warn.otherFieldNumeric': 'キーワードの欄にも入力があります。いまは数列を使います。',
    'warn.truncated': '入力が{max}文字を超えたため、先頭の{max}文字だけを使いました（入力は{length}文字）。',
    'warn.endsWithPad': '平文の最後の文字が埋字と同じ「{pad}」です。復号の自動除去では、この文字と埋字を区別できません。',
    'info.padStripped': '末尾の「{pad}」を埋字として{count}文字除きました。平文がもともと「{pad}」で終わっていた場合は、「自動除去」を外して確かめてください。',
    'info.padKept': '末尾に埋字は見つかりませんでした。',
    'info.stale': '入力か設定が変わりました。表示中の結果は前回の実行のものです。もう一度実行すると更新されます。',
    'toast.copied': 'クリップボードにコピーしました',
    'toast.copyFailed': 'コピーできませんでした。テキストを選択してコピーしてください。',
    'toast.syncNone': '同期するデータがありません。先に暗号化タブで暗号化を実行してください。',
    'toast.synced': '暗号化タブの設定を同期しました。復号を実行してください。',
    'sync.titleReady': '暗号化タブで使った暗号文と鍵の設定を、このタブに反映します。',
    'sync.titleEmpty': '同期するには、先に暗号化タブで暗号化を実行してください。',
    'theme.toLight': 'ライトモードに切り替えます',
    'theme.toDark': 'ダークモードに切り替えます',
    'grid.keyRow': '鍵順',
    'preset.fallbackName': '①マザーグース（予備）',
    'preset.fallbackDescription': 'サンプルの一覧を読み込めなかったときの予備のサンプル'
  }
};

let currentLang = 'ja';

export function setLang(lang) {
  if (MESSAGES[lang]) currentLang = lang;
}

export function getLang() {
  return currentLang;
}

export function t(key, params = {}) {
  const table = MESSAGES[currentLang] || MESSAGES.ja;
  const template = table[key] ?? MESSAGES.ja[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

// ロジックが返した { key, params } を訳す
export function tr(message) {
  return message ? t(message.key, message.params) : '';
}

export const messageKeys = lang => Object.keys(MESSAGES[lang] || {});
