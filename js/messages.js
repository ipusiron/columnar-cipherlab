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
    'key.mixed': '鍵は、キーワード（英字だけ）か数列（数字だけ）のどちらかで入力してください。',
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
    'info.padStripped': '末尾の「{pad}」を埋字として{count}文字除きました。平文がもともと「{pad}」で終わっていた場合は、「埋字を自動除去」を外して確かめてください。',
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
    'grid.selectColumn': '{col}列目（鍵順{rank}）を選ぶ',
    'grid.selectRow': '{row}行目を選ぶ',
    'dbl.keyError': '{which}段目の鍵：{message}',
    'dbl.orderLabel': '列順（{which}段目の鍵）',
    'dbl.step1Enc': '1段目：平文を1段目の鍵で転置する',
    'dbl.step2Enc': '2段目：1段目の暗号文を2段目の鍵で転置する',
    'dbl.midEnc': '1段目の暗号文',
    'dbl.outEnc': '暗号文（2段目の結果）',
    'dbl.step1Dec': '1段目：暗号文を2段目の鍵で戻す',
    'dbl.step2Dec': '2段目：途中の文を1段目の鍵で戻す',
    'dbl.midDec': '途中の文（1段目の暗号文）',
    'dbl.outDec': '平文',
    'share.invalid': '共有リンクの内容を読み込めませんでした（形式が違うか、値が範囲の外です）。',
    'share.loadedProblem': '共有リンクから暗号文を読み込みました。鍵はリンクに含まれていません。総当たりか作業台で解いてみてください。',
    'share.loadedAnswer': '共有リンクから暗号文と鍵を読み込みました。「復号実行」で平文を確かめられます。',
    'lab.length': '長さ：{length}文字',
    'lab.completeLengths': '完全モード（埋字あり）なら、鍵長は長さの約数：{list}',
    'lab.completeNone': '鍵長2〜8で長さを割り切れるものはない（完全モードなら鍵長は9以上）',
    'lab.verdict.transposition': '見分け方の目安：英字の頻度が英語に近い（カイ二乗 {chi}、英字{letters}文字）。並べ替えただけの転置式の可能性が高い',
    'lab.verdict.substitution': '見分け方の目安：英字の頻度が英語から離れている（カイ二乗 {chi}、英字{letters}文字）。換字式か、英語ではない文の可能性がある',
    'lab.verdict.short': '見分け方の目安：英字が{min}文字未満（{letters}文字）なので、頻度では見分けられない',
    'lab.day009': 'Frequency Analyzer（Day009）で文字の頻度を詳しく見る（暗号文をURLで渡す）',
    'lab.tooLong': '総当たりは{max}文字までです（いまは{length}文字）。',
    'lab.range': '鍵長の最小は最大以下にしてください。',
    'lab.starting': '準備しています…',
    'lab.progress': '鍵長{n}を調べています（{done}/{total}）',
    'lab.done': '{tried}通りを試しました。',
    'lab.none': '{tried}通りを試しましたが、候補がありませんでした（既知の単語を含む候補がない）。',
    'lab.cancelled': '中止しました。',
    'lab.toBench': '作業台で見る',
    'lab.toDecrypt': '復号タブへ',
    'lab.benchCol': '列{col}（順{rank}）',
    'lab.moveLeft': '列{col}を左へ移す',
    'lab.moveRight': '列{col}を右へ移す',
    'lab.benchEmpty': '上の欄に暗号文を入れると、ここに表が出ます。',
    'lab.pair': '列{a}と{b}：{level}（{avg}）',
    'lab.pair.good': '自然',
    'lab.pair.fair': 'ふつう',
    'lab.pair.bad': '不自然',
    'lab.pair.none': '英字なし',
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
