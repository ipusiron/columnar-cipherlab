// ===== 共有リンク =====
// 平文は含めない。「#」より後ろ（フラグメント）に書くので、開いたときにサーバーへは送られない。
// 問題: #tab=lab&c=<暗号文>&m=<complete|incomplete>
// 解答: #tab=dec&c=<暗号文>&m=...&t=<keyword|numeric|none>&k=<鍵>&my=1（Myszkowski式）&p=<埋字> または &r=1（ランダムな英字で埋めた）

import { MAX_INPUT_LENGTH, parseKey, validatePadChar } from './columnar-core.js';

const MODES = new Set(['complete', 'incomplete']);
const TYPES = new Set(['keyword', 'numeric', 'none']);

// 共有リンクの「#」以降を作る
export function buildShareHash({ cipher, complete, withKey = false, keyType = 'keyword', key = '', myszkowski = false, padChar = 'X', nulls = false }) {
  const params = new URLSearchParams();
  params.set('tab', withKey ? 'dec' : 'lab');
  params.set('c', cipher);
  params.set('m', complete ? 'complete' : 'incomplete');
  if (withKey) {
    params.set('t', keyType);
    params.set('k', key);
    if (keyType === 'keyword' && myszkowski) params.set('my', '1');
    if (complete && nulls) params.set('r', '1');
    else if (complete) params.set('p', padChar);
  }
  return `#${params.toString()}`;
}

// 「#」以降を読み、検証した値だけを返す。読めないときは { error }
export function parseShareHash(hash) {
  const raw = String(hash ?? '').replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const tab = params.get('tab');
  if (tab !== 'lab' && tab !== 'dec') return null;
  const cipher = params.get('c') ?? '';
  if (!cipher || Array.from(cipher).length > MAX_INPUT_LENGTH) return { error: { key: 'share.invalid' } };
  const mode = params.get('m') ?? 'incomplete';
  if (!MODES.has(mode)) return { error: { key: 'share.invalid' } };
  const out = { tab, cipher, complete: mode === 'complete' };
  if (tab === 'dec') {
    const keyType = params.get('t') ?? 'keyword';
    if (!TYPES.has(keyType)) return { error: { key: 'share.invalid' } };
    const key = params.get('k') ?? '';
    const myszkowski = params.get('my') === '1';
    const parsed = parseKey({ useKey: keyType !== 'none', keyType, keyword: key, numeric: key, columns: key, myszkowski });
    if (parsed.error) return { error: { key: 'share.invalid' } };
    const nulls = out.complete && params.get('r') === '1';
    const padChar = params.get('p') ?? 'X';
    if (out.complete && !nulls && !validatePadChar(padChar).ok) return { error: { key: 'share.invalid' } };
    Object.assign(out, { keyType, key, myszkowski: keyType === 'keyword' && myszkowski, padChar, nulls });
  }
  return out;
}
