// ===== 復号タブのロジック =====

import { 
  keywordOrder, 
  numericOrder, 
  renderGrid, 
  showOrderBadges, 
  copyToClipboard,
  showToast,
  escapeHtml
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
  window.debugLog('DECRYPT', '🔧 Initializing decryption module...');
  
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
  const decSyncBtn = document.getElementById('dec-sync');
  
  // 新しい要素
  const decVisualSection = document.getElementById('dec-visual-section');
  const decResultSection = document.getElementById('dec-result-section');
  const decPlainDisplay = document.getElementById('dec-plain-display');

  // 同期ボタンの有効/無効を制御する関数
  function updateSyncButtonState() {
    const hasEncryptionResult = window.encryptionState && window.encryptionState.cipher;
    decSyncBtn.disabled = !hasEncryptionResult;
    if (hasEncryptionResult) {
      decSyncBtn.title = '暗号化タブで使用した暗号文と鍵設定を自動的にこのタブに反映します。';
    } else {
      decSyncBtn.title = '同期するには先に暗号化タブで暗号化を実行してください。';
    }
  }

  // グローバルからアクセス可能にする
  window.updateSyncButtonState = updateSyncButtonState;

  // 復号結果のハイライト表示を設定する関数
  function setupPlaintextHighlight(plaintext, grid, keyInfo) {
    if (!plaintext) {
      decPlainDisplay.innerHTML = '';
      return;
    }
    
    // 復号結果を行ごとに分割してハイライト表示を作成
    let highlightHtml = '';
    const cols = keyInfo.n;
    const rows = grid.length;
    
    // 平文は行方向に読み出される（左から右へ、上から下へ）
    let charIndex = 0;
    for (let r = 0; r < rows; r++) {
      // 各行で実際に文字があるセルの数をカウント
      for (let c = 0; c < cols; c++) {
        const char = grid[r][c];
        if (char && char !== '' && charIndex < plaintext.length) {
          highlightHtml += `<span class="plain-char" data-row="${escapeHtml(r)}" data-char-index="${escapeHtml(charIndex)}">${escapeHtml(plaintext[charIndex])}</span>`;
          charIndex++;
        }
      }
    }
    
    decPlainDisplay.innerHTML = highlightHtml;
  }

  // 行ホバー機能を設定する関数
  function setupRowHover(grid, keyInfo) {
    const table = decGridDiv.querySelector('table');
    if (!table) return;
    
    const rows = grid.length;
    
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      // テーブルの行を取得（ヘッダー行を除くため +2）
      const tableRow = table.querySelector(`tbody tr:nth-child(${rowIndex + 1})`);
      if (!tableRow) continue;
      
      // 行の全セル（行番号セル + データセル）を取得
      const rowCells = tableRow.querySelectorAll('th, td');
      
      rowCells.forEach(cell => {
        cell.addEventListener('mouseenter', () => {
          // 同じ行の全セルをハイライト（暗号化タブと同じ色合い）
          rowCells.forEach(c => {
            if (!c.classList.contains('column-highlight')) {
              c.style.backgroundColor = 'rgba(106, 166, 255, 0.3)';
            }
          });
          
          // 対応する復号結果の文字をハイライト
          const plainChars = decPlainDisplay.querySelectorAll(`[data-row="${rowIndex}"]`);
          plainChars.forEach(char => {
            char.style.backgroundColor = 'rgba(106, 166, 255, 0.5)';
            char.style.fontWeight = 'bold';
            char.style.borderBottom = '2px solid var(--accent)';
          });
        });
        
        cell.addEventListener('mouseleave', () => {
          // 行のハイライトを解除
          rowCells.forEach(c => {
            if (!c.classList.contains('column-highlight')) {
              c.style.backgroundColor = '';
            }
          });
          
          // 復号結果のハイライトを解除
          const plainChars = decPlainDisplay.querySelectorAll(`[data-row="${rowIndex}"]`);
          plainChars.forEach(char => {
            char.style.backgroundColor = '';
            char.style.fontWeight = '';
            char.style.borderBottom = '';
          });
        });
      });
    }
  }

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
      
      // 現在選択されているキータイプの検証
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
        
        // 数列フィールドにも入力がある場合は警告
        const numericStr = decNumeric.value.trim();
        if (numericStr.length > 0) {
          errorMessages.push('数列フィールドに入力がありますが、キーワードが選択されています。数列フィールドをクリアするか、数列モードに切り替えてください。');
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
        
        // キーワードフィールドにも入力がある場合は警告
        const keyword = decKeyword.value.trim();
        if (keyword.length > 0) {
          errorMessages.push('キーワードフィールドに入力がありますが、数列が選択されています。キーワードフィールドをクリアするか、キーワードモードに切り替えてください。');
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
      decError.innerHTML = errorMessages.map(msg => `• ${escapeHtml(msg)}`).join('<br>');
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
  updateSyncButtonState();
  
  // 初期状態で鍵タイプ切り替えを実行（確実に設定）
  const initialKeyType = document.querySelector('input[name="dec-keytype"]:checked').value;
  if (initialKeyType === 'keyword') {
    decKeywordRow.classList.remove('hidden');
    decNumericRow.classList.add('hidden');
  } else {
    decKeywordRow.classList.add('hidden');
    decNumericRow.classList.remove('hidden');
  }

  // 鍵の使用チェックボックス変更を監視
  decUseKey.addEventListener('change', updateKeySettingsVisibility);

  // 鍵タイプの切替
  decKeyTypeInputs.forEach(r => r.addEventListener('change', () => {
    const v = document.querySelector('input[name="dec-keytype"]:checked').value;
    if (v === 'keyword') {
      decKeywordRow.classList.remove('hidden');
      decNumericRow.classList.add('hidden');
    } else {
      decKeywordRow.classList.add('hidden');
      decNumericRow.classList.remove('hidden');
    }
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
    decKeyword.value = '';
    decNumeric.value = '';
    decError.classList.add('hidden');
    decGridDiv.innerHTML = '';
    decOrderSpan.textContent = '';
    decPlainDisplay.innerHTML = '';
    decPlain.style.display = 'block';
    decPlainDisplay.style.display = 'block';
    // セクションを非表示
    decVisualSection.style.display = 'none';
    decResultSection.style.display = 'none';
    updateDecryptButtonState(); // クリア後も状態を更新
  });

  // 暗号化結果同期
  decSyncBtn.addEventListener('click', () => {
    if (!window.encryptionState || !window.encryptionState.cipher) {
      showToast('同期するデータがありません。先に暗号化タブで暗号化を実行してください。', 'error');
      return;
    }
    
    const state = window.encryptionState;
    
    // 暗号文を設定
    decCipher.value = state.cipher;
    
    // 鍵設定を同期
    decUseKey.checked = state.useKey;
    updateKeySettingsVisibility();
    
    if (state.useKey && state.keyType) {
      // 鍵タイプを設定
      document.querySelector(`input[name="dec-keytype"][value="${state.keyType}"]`).checked = true;
      
      // 鍵タイプに応じて表示を切り替え
      if (state.keyType === 'keyword') {
        decKeywordRow.classList.remove('hidden');
        decNumericRow.classList.add('hidden');
        decKeyword.value = state.keyword || '';
        decNumeric.value = '';
      } else {
        decKeywordRow.classList.add('hidden');
        decNumericRow.classList.remove('hidden');
        decNumeric.value = state.numeric || '';
        decKeyword.value = '';
      }
    } else if (!state.useKey) {
      // 鍵なしの場合
      decColNum.value = state.colNum || 5;
    }
    
    // モード設定を同期
    decComplete.checked = state.complete;
    updatePaddingRowVisibility();
    
    if (state.complete) {
      decPadChar.value = state.padChar || 'X';
    }
    
    // 状態を更新
    updateDecryptButtonState();
    
    // フィードバック
    showToast('暗号化タブの設定を同期しました。復号を実行してください。', 'success');
  });

  // コピー
  decCopyBtn.addEventListener('click', () => {
    const text = decPlain.value;
    if (text) copyToClipboard(text, decCopyBtn);
  });

  // 復号実行
  decRun.addEventListener('click', () => {
    window.debugLog('DECRYPT', '🔓 Starting decryption process...');
    
    // エラーをクリア（パディング文字エラーは残す）
    if (!decError.textContent.includes('埋字')) {
      decError.classList.add('hidden');
    }
    try {
      const useKey = decUseKey.checked;
      const complete = decComplete.checked;
      const padChar = (decPadChar.value || 'X')[0];
      const autoStrip = decAutoStrip.checked;

      window.debugLog('DECRYPT', `⚙️ Settings: useKey=${useKey}, complete=${complete}, padChar='${padChar}', autoStrip=${autoStrip}`);
      
      // パディング文字の再検証
      if (complete && !/^[A-Za-z]$/.test(padChar)) {
        throw new Error('埋字（パディング）は英字1文字のみ使用可能です。');
      }

      const rawCipher = decCipher.value.trim();
      if (!rawCipher) throw new Error('暗号文を入力してください。');
      
      const cipher = rawCipher.replace(/\s+/g, '');
      if (!cipher.length) throw new Error('暗号文が空です（スペース削除後）。');

      window.debugLog('DECRYPT', `📝 Cipher text: "${cipher}" (${cipher.length} chars)`);

      let keyInfo;
      if (useKey) {
        // 鍵を使用する場合
        const keyType = document.querySelector('input[name="dec-keytype"]:checked').value;
        window.debugLog('DECRYPT', `🔑 Using key type: ${keyType}`);
        
        if (keyType === 'keyword') {
          const keyword = decKeyword.value.trim();
          if (!keyword) throw new Error('キーワードを入力してください。');
          if (keyword.length < 2) throw new Error('キーワードは2文字以上にしてください。');
          keyInfo = keywordOrder(keyword);
          window.debugLog('DECRYPT', `🔤 Keyword: "${keyword}" → Order:`, keyInfo);
        } else {
          const numStr = decNumeric.value.trim();
          if (!numStr) throw new Error('鍵数列を入力してください。');
          keyInfo = numericOrder(numStr);
          if (keyInfo && keyInfo.error) throw new Error(keyInfo.error);
          window.debugLog('DECRYPT', `🔢 Numeric key: "${numStr}" → Order:`, keyInfo);
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
        window.debugLog('DECRYPT', `🔢 No key mode: ${colNum} columns`);
      }

      window.debugLog('DECRYPT', `📊 Matrix info: ${keyInfo.n} columns`);
      const { plain, grid, rows } = decryptColumnar(cipher, keyInfo, complete, padChar, autoStrip);
      decPlain.value = plain;

      window.debugLog('DECRYPT', `🔓 Plaintext recovered: "${plain}" (${plain.length} chars)`);
      window.debugLog('DECRYPT', `📊 Grid reconstructed: ${rows}×${keyInfo.n}`);
      window.debugLog('DECRYPT', `✅ Decryption completed successfully`);

      // 復号結果のハイライト表示を作成
      setupPlaintextHighlight(plain, grid, keyInfo);

      // 可視化と結果の表示
      // 数列の数値をそのまま表示（1ベース）
      const displayOrder = keyInfo.rank.map(r => r + 1);
      showOrderBadges(decOrderSpan, displayOrder);
      renderGrid(decGridDiv, grid, '復号', keyInfo, padChar);
      
      // 行ホバー機能を設定
      setTimeout(() => {
        setupRowHover(grid, keyInfo);
      }, 50);
      
      decVisualSection.style.display = 'block';
      decResultSection.style.display = 'block';
    } catch (e) {
      window.debugLog('DECRYPT', `❌ Decryption failed: ${e.message}`);
      decError.textContent = e.message;
      decError.classList.remove('hidden');
    }
  });
  
  window.debugLog('DECRYPT', '✅ Decryption module event listeners configured');
}