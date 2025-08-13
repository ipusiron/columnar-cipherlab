// ===== 復号タブのロジック =====

import { 
  keywordOrder, 
  numericOrder, 
  renderGrid, 
  showOrderBadges, 
  copyToClipboard 
} from './utils.js';

// 縦列転置式暗号の復号
function decryptColumnar(cipher, keyInfo, complete, padChar, autoStrip) {
  const L = cipher.length;
  const n = keyInfo.n;
  const rows = Math.ceil(L / n) || 1;

  // 列ごとの高さ（元の列順）
  const heights = new Array(n).fill(rows);
  if (!complete) {
    const fullCols = L % n; // 残余分だけ最終行が埋まる
    if (fullCols > 0) {
      // 最終行が部分的に埋まる場合
      for (let c = 0; c < n; c++) heights[c] = rows - 1;
      for (let c = 0; c < fullCols; c++) heights[c] = rows; // 左から fullCols 本
    }
  }

  // 鍵順に暗号文を割り当て、元の列へ格納
  const cols = Array.from({ length: n }, () => []);
  let pos = 0;
  for (const origIdx of keyInfo.order) {
    const h = heights[origIdx];
    const segment = cipher.slice(pos, pos + h);
    cols[origIdx] = [...segment];
    pos += h;
  }

  // 行優先に読み出して平文へ
  let plain = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < n; c++) {
      const ch = cols[c][r];
      if (ch !== undefined) plain += ch;
    }
  }

  if (complete && autoStrip) {
    const re = new RegExp(`${padChar}+$`);
    plain = plain.replace(re, '');
  }

  // 可視化用グリッド
  const grid = Array.from({ length: rows }, () => Array(n).fill(''));
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < cols[c].length; r++) {
      grid[r][c] = cols[c][r] || '';
    }
  }

  return { plain, grid, rows };
}

export function initDecryption() {
  // DOM要素の取得
  const decKeyTypeInputs = document.querySelectorAll('input[name="dec-keytype"]');
  const decKeywordRow = document.getElementById('dec-keyword-row');
  const decNumericRow = document.getElementById('dec-numeric-row');
  const decCipher = document.getElementById('dec-cipher');
  const decKeyword = document.getElementById('dec-keyword');
  const decNumeric = document.getElementById('dec-numeric');
  const decUseKey = document.getElementById('dec-use-key');
  const decKeySettings = document.getElementById('dec-key-settings');
  const decNoKeySettings = document.getElementById('dec-no-key-settings');
  const decColNum = document.getElementById('dec-col-num');
  const decComplete = document.getElementById('dec-complete');
  const decPaddingRow = document.getElementById('dec-padding-row');
  const decAutoStrip = document.getElementById('dec-autostrip');
  const decPadChar = document.getElementById('dec-padchar');
  const decRun = document.getElementById('dec-run');
  const decClear = document.getElementById('dec-clear');
  const decPlain = document.getElementById('dec-plain');
  const decError = document.getElementById('dec-error');
  const decOrderSpan = document.getElementById('dec-order');
  const decGridDiv = document.getElementById('dec-grid');
  const decCopyBtn = document.getElementById('dec-copy');
  
  // 新しい要素
  const decVisualSection = document.getElementById('dec-visual-section');
  const decResultSection = document.getElementById('dec-result-section');
  const decPlainDisplay = document.getElementById('dec-plain-display');

  // 復号ボタンの有効/無効を制御する関数
  function updateDecryptButtonState() {
    const cipherText = decCipher.value.trim();
    const useKey = decUseKey.checked;
    let hasKey = true; // 鍵なしの場合は常にtrue
    let isValid = true;
    let errorMessages = []; // 複数のエラーメッセージを管理
    
    // 鍵を使用する場合の検証
    if (useKey) {
      const keyType = document.querySelector('input[name="dec-keytype"]:checked').value;
      if (keyType === 'keyword') {
        const keyword = decKeyword.value.trim();
        if (keyword.length === 0) {
          hasKey = false;
          errorMessages.push('キーワードを入力してください。');
        } else if (!/^[A-Za-z]+$/.test(keyword)) {
          hasKey = false;
          isValid = false;
          errorMessages.push('キーワードは英字のみ使用可能です。');
        } else if (keyword.length < 2) {
          hasKey = false;
          isValid = false;
          errorMessages.push('キーワードは2文字以上にしてください。');
        }
      } else {
        const numericStr = decNumeric.value.trim();
        if (numericStr.length === 0) {
          hasKey = false;
          errorMessages.push('鍵数列を入力してください。');
        } else {
          // 数列の検証
          let nums;
          if (/[,\s]/.test(numericStr)) {
            nums = numericStr.split(/[\s,]+/).filter(Boolean).map(Number);
          } else {
            nums = [...numericStr].map(d => Number(d));
          }
          
          if (nums.length === 0) {
            hasKey = false;
            isValid = false;
            errorMessages.push('鍵数列が空です。');
          } else if (nums.some(n => !Number.isInteger(n) || n < 1)) {
            hasKey = false;
            isValid = false;
            errorMessages.push('鍵数列には1以上の整数を入力してください。');
          } else {
            // 重複チェック
            const set = new Set(nums);
            if (set.size !== nums.length) {
              hasKey = false;
              isValid = false;
              errorMessages.push('鍵数列に重複があります。重複のない数列を使用してください。');
            }
            // 連続性チェック
            else {
              const max = Math.max(...nums);
              if (max !== nums.length) {
                hasKey = false;
                isValid = false;
                errorMessages.push(`鍵数列は1から${nums.length}までの連続した数値を使用してください。`);
              } else {
                for (let i = 1; i <= nums.length; i++) {
                  if (!set.has(i)) {
                    hasKey = false;
                    isValid = false;
                    errorMessages.push(`鍵数列に${i}が含まれていません。1から${nums.length}までのすべての数値を使用してください。`);
                    break;
                  }
                }
              }
            }
          }
        }
      }
    } else {
      // 鍵なしの場合は列数をチェック
      const colNum = parseInt(decColNum.value);
      if (!colNum || colNum < 2 || colNum > 20) {
        isValid = false;
        errorMessages.push('列数は2～20の範囲で指定してください。');
      }
    }
    
    // 完全モードの場合、パディング文字の検証
    if (decComplete.checked) {
      const padChar = decPadChar.value;
      if (!padChar) {
        isValid = false;
        errorMessages.push('埋字（パディング）文字を入力してください。');
      } else if (!/^[A-Za-z]$/.test(padChar)) {
        isValid = false;
        errorMessages.push('埋字（パディング）は英字1文字のみ使用可能です。');
      }
    }
    
    // エラーメッセージの表示/非表示
    if (errorMessages.length > 0) {
      decError.innerHTML = errorMessages.map(msg => `• ${msg}`).join('<br>');
      decError.classList.remove('hidden');
    } else {
      decError.classList.add('hidden');
    }
    
    // 暗号文と鍵（または列数）が有効で、パディング文字も有効な場合のみ有効化
    decRun.disabled = !(cipherText && hasKey && isValid);
    
    // 無効時はボタンのスタイルも変更
    if (decRun.disabled) {
      decRun.classList.add('disabled');
    } else {
      decRun.classList.remove('disabled');
    }
  }

  // パディング行の表示/非表示を制御
  function updatePaddingRowVisibility() {
    if (decComplete.checked) {
      decPaddingRow.classList.remove('hidden');
    } else {
      decPaddingRow.classList.add('hidden');
    }
    updateDecryptButtonState();
  }

  // 鍵設定の表示/非表示を制御
  function updateKeySettingsVisibility() {
    if (decUseKey.checked) {
      decKeySettings.style.display = 'block';
      decNoKeySettings.style.display = 'none';
    } else {
      decKeySettings.style.display = 'none';
      decNoKeySettings.style.display = 'block';
    }
    updateDecryptButtonState();
  }

  // 初期状態をチェック
  updateDecryptButtonState();
  updatePaddingRowVisibility();
  updateKeySettingsVisibility();

  // 鍵の使用チェックボックス変更を監視
  decUseKey.addEventListener('change', updateKeySettingsVisibility);

  // 鍵タイプの切替
  decKeyTypeInputs.forEach(r => r.addEventListener('change', () => {
    const v = document.querySelector('input[name="dec-keytype"]:checked').value;
    decKeywordRow.classList.toggle('hidden', v !== 'keyword');
    decNumericRow.classList.toggle('hidden', v !== 'numeric');
    updateDecryptButtonState(); // 鍵タイプ変更時も状態を更新
  }));

  // 入力フィールドの変更を監視
  decCipher.addEventListener('input', updateDecryptButtonState);
  decKeyword.addEventListener('input', updateDecryptButtonState);
  decNumeric.addEventListener('input', updateDecryptButtonState);
  decPadChar.addEventListener('input', updateDecryptButtonState);
  decColNum.addEventListener('input', updateDecryptButtonState);
  
  // 完全モードのチェックボックス変更を監視
  decComplete.addEventListener('change', updatePaddingRowVisibility);

  // クリア
  decClear.addEventListener('click', () => {
    decCipher.value = '';
    decPlain.value = '';
    decError.classList.add('hidden');
    decGridDiv.innerHTML = '';
    decOrderSpan.textContent = '';
    decPlainDisplay.innerHTML = '';
    decPlain.style.display = 'block';
    decPlainDisplay.style.display = 'none';
    // セクションを非表示
    decVisualSection.style.display = 'none';
    decResultSection.style.display = 'none';
    updateDecryptButtonState(); // クリア後も状態を更新
  });

  // コピー
  decCopyBtn.addEventListener('click', () => {
    const text = decPlain.value;
    if (text) copyToClipboard(text, decCopyBtn);
  });

  // 復号実行
  decRun.addEventListener('click', () => {
    // エラーをクリア（パディング文字エラーは残す）
    if (!decError.textContent.includes('埋字')) {
      decError.classList.add('hidden');
    }
    try {
      const useKey = decUseKey.checked;
      const complete = decComplete.checked;
      const padChar = (decPadChar.value || 'X')[0];
      const autoStrip = decAutoStrip.checked;
      
      // パディング文字の再検証
      if (complete && !/^[A-Za-z]$/.test(padChar)) {
        throw new Error('埋字（パディング）は英字1文字のみ使用可能です。');
      }

      const rawCipher = decCipher.value.trim();
      if (!rawCipher) throw new Error('暗号文を入力してください。');
      
      const cipher = rawCipher.replace(/\s+/g, '');
      if (!cipher.length) throw new Error('暗号文が空です（スペース削除後）。');

      let keyInfo;
      if (useKey) {
        // 鍵を使用する場合
        const keyType = document.querySelector('input[name="dec-keytype"]:checked').value;
        if (keyType === 'keyword') {
          const keyword = decKeyword.value.trim();
          if (!keyword) throw new Error('キーワードを入力してください。');
          if (keyword.length < 2) throw new Error('キーワードは2文字以上にしてください。');
          keyInfo = keywordOrder(keyword);
        } else {
          const numStr = decNumeric.value.trim();
          if (!numStr) throw new Error('鍵数列を入力してください。');
          keyInfo = numericOrder(numStr);
          if (keyInfo && keyInfo.error) throw new Error(keyInfo.error);
        }
        if (!keyInfo || keyInfo.n <= 0) throw new Error('鍵の解析に失敗しました。');
        
        // 暗号文の長さチェック
        if (!complete && cipher.length % keyInfo.n === 0) {
          console.warn('不完全モードですが、暗号文の長さが鍵長の倍数です。完全モードの可能性があります。');
        }
      } else {
        // 鍵なしの場合（1,2,3...の順序）
        const colNum = parseInt(decColNum.value);
        if (!colNum || colNum < 2 || colNum > 20) {
          throw new Error('列数は2～20の範囲で指定してください。');
        }
        // 1,2,3...の順序を作成
        const order = Array.from({length: colNum}, (_, i) => i);
        const rank = Array.from({length: colNum}, (_, i) => i);
        keyInfo = { order, rank, n: colNum };
      }

      const { plain, grid, rows } = decryptColumnar(cipher, keyInfo, complete, padChar, autoStrip);
      decPlain.value = plain;

      // 可視化と結果の表示
      // 数列の数値をそのまま表示（1ベース）
      const displayOrder = keyInfo.rank.map(r => r + 1);
      showOrderBadges(decOrderSpan, displayOrder);
      renderGrid(decGridDiv, grid, '復号', keyInfo, padChar);
      decVisualSection.style.display = 'block';
      decResultSection.style.display = 'block';
    } catch (e) {
      decError.textContent = e.message;
      decError.classList.remove('hidden');
    }
  });
}