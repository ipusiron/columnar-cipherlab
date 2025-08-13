// ===== 暗号化タブのロジック =====

import { 
  normalizeInput, 
  keywordOrder, 
  numericOrder, 
  buildGridByRows, 
  renderGrid, 
  showOrderBadges, 
  copyToClipboard,
  escapeHtml
} from './utils.js';
import { loadPresets, getPresetById } from './presets.js';

export function initEncryption() {
  window.debugLog('ENCRYPT', '🔧 Initializing encryption module...');
  
  // プリセットを読み込んでUIを初期化
  initializePresetUI();
  
  // DOM要素の取得
  const encKeyTypeInputs = document.querySelectorAll('input[name="enc-keytype"]');
  const encKeywordRow = document.getElementById('enc-keyword-row');
  const encNumericRow = document.getElementById('enc-numeric-row');
  const encPlain = document.getElementById('enc-plain');
  const encKeyword = document.getElementById('enc-keyword');
  const encNumeric = document.getElementById('enc-numeric');
  const encUseKey = document.getElementById('enc-use-key');
  const encKeySettings = document.getElementById('enc-key-settings');
  const encNoKeySettings = document.getElementById('enc-no-key-settings');
  const encColNum = document.getElementById('enc-col-num');
  const encComplete = document.getElementById('enc-complete');
  const encPaddingRow = document.getElementById('enc-padding-row');
  const encPadChar = document.getElementById('enc-padchar');
  const encStrip = document.getElementById('enc-stripspace');
  const encStripSymbol = document.getElementById('enc-stripsymbol');
  const encUpper = document.getElementById('enc-uppercase');
  const encRun = document.getElementById('enc-run');
  const encClear = document.getElementById('enc-clear');
  const encSample = document.getElementById('enc-sample');
  const encSampleMenu = document.getElementById('enc-sample-menu');
  const encSampleOptions = document.querySelectorAll('.sample-option');
  const encCipher = document.getElementById('enc-cipher');
  const encError = document.getElementById('enc-error');
  const encOrderSpan = document.getElementById('enc-order');
  const encGridDiv = document.getElementById('enc-grid');
  const encCopyBtn = document.getElementById('enc-copy');
  
  // 新しい要素
  const encIntermediateSection = document.getElementById('enc-intermediate-section');
  const encVisualSection = document.getElementById('enc-visual-section');
  const encResultSection = document.getElementById('enc-result-section');
  const encFormattedText = document.getElementById('enc-formatted-text');
  const encCharCount = document.getElementById('enc-char-count');
  const encColCount = document.getElementById('enc-col-count');
  const encRowCount = document.getElementById('enc-row-count');
  const encReorderBtn = document.getElementById('enc-reorder');
  const encReorderedSection = document.getElementById('enc-reordered-section');
  const encReorderedGrid = document.getElementById('enc-reordered-grid');
  const encCipherDisplay = document.getElementById('enc-cipher-display');

  // 暗号化結果を保存するための変数
  let currentGrid = null;
  let currentKeyInfo = null;
  let currentPadChar = null;
  let currentCipher = null;

  // 暗号化状態をグローバルに保存（復号タブからアクセス可能）
  window.encryptionState = {
    cipher: null,
    keyType: null,
    keyword: null,
    numeric: null,
    useKey: true,
    complete: true,
    padChar: 'X',
    colNum: 5
  };

  // 列ハイライト機能
  function setupColumnHighlight() {
    if (!currentCipher || !currentKeyInfo) return;
    
    // 暗号文を列ごとに分割
    const cipherSegments = [];
    let pos = 0;
    for (let i = 0; i < currentKeyInfo.n; i++) {
      const originalCol = currentKeyInfo.order[i];
      // 列の実際の文字数をカウント（空文字を除外）
      let colHeight = 0;
      for (let r = 0; r < currentGrid.length; r++) {
        if (currentGrid[r][originalCol] && currentGrid[r][originalCol] !== '') {
          colHeight++;
        }
      }
      
      const segment = currentCipher.slice(pos, pos + colHeight);
      cipherSegments.push({
        columnIndex: i,
        originalColumn: originalCol,
        segment: segment,
        startPos: pos,
        endPos: pos + colHeight
      });
      pos += colHeight;
    }
    
    // 暗号文のハイライト表示を作成
    let highlightHtml = '';
    cipherSegments.forEach((seg, index) => {
      for (let i = 0; i < seg.segment.length; i++) {
        highlightHtml += `<span class="cipher-char" data-column="${escapeHtml(index)}" data-pos="${escapeHtml(seg.startPos + i)}">${escapeHtml(seg.segment[i])}</span>`;
      }
    });
    encCipherDisplay.innerHTML = highlightHtml;
    
    // ハイライト表示も表示（テキストエリアは常に表示）
    encCipherDisplay.style.display = 'block';
    
    return cipherSegments;
  }

  // 列をハイライトする関数
  function highlightColumn(columnIndex) {
    // マトリクス列のハイライト
    const table = encReorderedGrid.querySelector('table');
    if (table) {
      // 既存のハイライトとインラインスタイルをクリア
      table.querySelectorAll('th, td').forEach(cell => {
        cell.classList.remove('column-highlight');
        cell.style.backgroundColor = ''; // インラインスタイルもクリア
      });
      
      // 指定された列をハイライト
      if (columnIndex !== -1) {
        // すべてのヘッダー行（#行と鍵順行）とデータセルをハイライト
        const allCells = table.querySelectorAll(`th:nth-child(${columnIndex + 2}), td:nth-child(${columnIndex + 2})`);
        allCells.forEach(cell => {
          cell.classList.add('column-highlight');
          cell.style.backgroundColor = ''; // インラインスタイルをクリアして、クラスのスタイルのみ適用
        });
      }
    }
    
    // 暗号文のハイライトとインラインスタイルをクリア
    encCipherDisplay.querySelectorAll('.cipher-char').forEach(char => {
      char.classList.remove('highlighted');
      char.style.backgroundColor = ''; // インラインスタイルもクリア
    });
    
    if (columnIndex !== -1) {
      const cipherChars = encCipherDisplay.querySelectorAll(`[data-column="${columnIndex}"]`);
      cipherChars.forEach(char => {
        char.classList.add('highlighted');
        char.style.backgroundColor = ''; // インラインスタイルをクリアして、クラスのスタイルのみ適用
      });
    }
  }

  // 暗号化ボタンの有効/無効を制御する関数
  function updateEncryptButtonState() {
    const plainText = encPlain.value.trim();
    const useKey = encUseKey.checked;
    let hasKey = true; // 鍵なしの場合は常にtrue
    let isValid = true;
    let errorMessages = []; // 複数のエラーメッセージを管理
    
    // 鍵を使用する場合の検証
    if (useKey) {
      const keyType = document.querySelector('input[name="enc-keytype"]:checked').value;
      
      // 現在選択されているキータイプの検証
      if (keyType === 'keyword') {
        const keyword = encKeyword.value.trim();
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
        const numericStr = encNumeric.value.trim();
        if (numericStr.length > 0) {
          errorMessages.push('数列フィールドに入力がありますが、キーワードが選択されています。数列フィールドをクリアするか、数列モードに切り替えてください。');
        }
      } else {
        const numericStr = encNumeric.value.trim();
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
        const keyword = encKeyword.value.trim();
        if (keyword.length > 0) {
          errorMessages.push('キーワードフィールドに入力がありますが、数列が選択されています。キーワードフィールドをクリアするか、キーワードモードに切り替えてください。');
        }
      }
    } else {
      // 鍵なしの場合は列数をチェック
      const colNum = parseInt(encColNum.value);
      if (!colNum || colNum < 2 || colNum > 20) {
        isValid = false;
        errorMessages.push('列数は2～20の範囲で指定してください。');
      }
    }
    
    // 完全モードの場合、パディング文字の検証
    if (encComplete.checked) {
      const padChar = encPadChar.value;
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
      encError.innerHTML = errorMessages.map(msg => `• ${escapeHtml(msg)}`).join('<br>');
      encError.classList.remove('hidden');
    } else {
      encError.classList.add('hidden');
    }
    
    // 平文と鍵（または列数）が有効で、パディング文字も有効な場合のみ有効化
    encRun.disabled = !(plainText && hasKey && isValid);
    
    // 無効時はボタンのスタイルも変更
    if (encRun.disabled) {
      encRun.classList.add('disabled');
    } else {
      encRun.classList.remove('disabled');
    }
  }

  // パディング行の表示/非表示を制御
  function updatePaddingRowVisibility() {
    if (encComplete.checked) {
      encPaddingRow.classList.remove('hidden');
    } else {
      encPaddingRow.classList.add('hidden');
    }
    updateEncryptButtonState();
  }

  // 鍵設定の表示/非表示を制御
  function updateKeySettingsVisibility() {
    if (encUseKey.checked) {
      encKeySettings.style.display = 'block';
      encNoKeySettings.style.display = 'none';
    } else {
      encKeySettings.style.display = 'none';
      encNoKeySettings.style.display = 'block';
    }
    updateEncryptButtonState();
  }

  // 初期状態をチェック
  updateEncryptButtonState();
  updatePaddingRowVisibility();
  updateKeySettingsVisibility();
  
  // 初期状態で鍵タイプ切り替えを実行（確実に設定）
  const initialKeyType = document.querySelector('input[name="enc-keytype"]:checked').value;
  if (initialKeyType === 'keyword') {
    encKeywordRow.classList.remove('hidden');
    encNumericRow.classList.add('hidden');
  } else {
    encKeywordRow.classList.add('hidden');
    encNumericRow.classList.remove('hidden');
  }

  // 鍵の使用チェックボックス変更を監視
  encUseKey.addEventListener('change', updateKeySettingsVisibility);

  // 鍵タイプの切替
  encKeyTypeInputs.forEach(r => r.addEventListener('change', () => {
    const v = document.querySelector('input[name="enc-keytype"]:checked').value;
    if (v === 'keyword') {
      encKeywordRow.classList.remove('hidden');
      encNumericRow.classList.add('hidden');
    } else {
      encKeywordRow.classList.add('hidden');
      encNumericRow.classList.remove('hidden');
    }
    updateEncryptButtonState(); // 鍵タイプ変更時も状態を更新
  }));

  // 入力フィールドの変更を監視
  encPlain.addEventListener('input', updateEncryptButtonState);
  encKeyword.addEventListener('input', updateEncryptButtonState);
  encNumeric.addEventListener('input', updateEncryptButtonState);
  encPadChar.addEventListener('input', updateEncryptButtonState);
  encColNum.addEventListener('input', updateEncryptButtonState);
  
  // 完全モードのチェックボックス変更を監視
  encComplete.addEventListener('change', updatePaddingRowVisibility);

  // サンプル設定を適用する関数
  async function applySamplePreset(presetId) {
    try {
      window.debugLog('ENCRYPT', `📋 Applying preset: ${presetId}`);
      
      const preset = await getPresetById(presetId);
      if (!preset) {
        throw new Error(`Preset with id "${presetId}" not found`);
      }
      
      window.debugLog('ENCRYPT', `📝 Loaded preset: ${preset.name}`, preset);
      
      // 平文を設定
      encPlain.value = preset.plaintext;
      
      // 鍵タイプに応じて設定
      if (preset.keyType === 'keyword') {
        encKeyword.value = preset.keyword || '';
        encNumeric.value = '';
        document.querySelector('input[name="enc-keytype"][value="keyword"]').checked = true;
        encKeywordRow.classList.remove('hidden');
        encNumericRow.classList.add('hidden');
      } else if (preset.keyType === 'numeric') {
        encNumeric.value = preset.numeric || '';
        encKeyword.value = '';
        document.querySelector('input[name="enc-keytype"][value="numeric"]').checked = true;
        encKeywordRow.classList.add('hidden');
        encNumericRow.classList.remove('hidden');
      }
      
      // 設定を適用
      const settings = preset.settings;
      encUseKey.checked = settings.useKey;
      encComplete.checked = settings.complete;
      encPadChar.value = settings.padChar || 'X';
      encStrip.checked = settings.stripSpace;
      encStripSymbol.checked = settings.stripSymbol;
      encUpper.checked = settings.uppercase;
      
      if (settings.colNum && !settings.useKey) {
        encColNum.value = settings.colNum;
      }
      
      // 表示を更新
      updateKeySettingsVisibility();
      updatePaddingRowVisibility();
      updateEncryptButtonState();
      
      window.debugLog('ENCRYPT', `✅ Preset "${preset.name}" applied successfully`);
      
    } catch (error) {
      window.debugLog('ENCRYPT', `❌ Failed to apply preset: ${error.message}`);
      console.error('Failed to apply preset:', error);
    }
  }

  // サンプルドロップダウンの制御
  encSample.addEventListener('click', (e) => {
    e.stopPropagation();
    encSampleMenu.classList.toggle('hidden');
  });

  // 注意: サンプルオプションは動的に生成されるため、
  // イベントリスナーは initializePresetUI() で設定される

  // ドロップダウン外クリックで閉じる
  document.addEventListener('click', () => {
    encSampleMenu.classList.add('hidden');
  });

  // ハイライトをクリアする関数
  function clearHighlight() {
    // 並び替え後マトリクス列のハイライトをクリア
    const table = encReorderedGrid.querySelector('table');
    if (table) {
      table.querySelectorAll('.column-highlight').forEach(cell => {
        cell.classList.remove('column-highlight');
      });
    }
    
    // 元のマトリクス列のハイライトをクリア
    const originalTable = encGridDiv.querySelector('table');
    if (originalTable) {
      originalTable.querySelectorAll('.column-highlight').forEach(cell => {
        cell.classList.remove('column-highlight');
      });
    }
    
    // 暗号文のハイライトをクリア
    encCipherDisplay.querySelectorAll('.cipher-char').forEach(char => {
      char.classList.remove('highlighted');
    });
  }

  // 元のマトリクスのホバー機能を設定
  function setupOriginalMatrixHover() {
    const originalTable = encGridDiv.querySelector('table');
    if (!originalTable || !currentKeyInfo) return;
    
    const numColumns = originalTable.querySelectorAll('th').length - 1; // 行番号列を除く
    
    for (let originalColIndex = 0; originalColIndex < numColumns; originalColIndex++) {
      const columnCells = originalTable.querySelectorAll(`th:nth-child(${originalColIndex + 2}), td:nth-child(${originalColIndex + 2})`);
      
      columnCells.forEach(cell => {
        cell.addEventListener('mouseenter', () => {
          // 元のマトリクスの列をハイライト
          columnCells.forEach(c => {
            if (!c.classList.contains('column-highlight')) {
              c.style.backgroundColor = 'rgba(0, 123, 255, 0.3)';
            }
          });
          
          // 並び替え後マトリクスが表示されている場合、対応する列もハイライト
          const reorderedTable = encReorderedGrid.querySelector('table');
          if (reorderedTable) {
            // 元の列インデックスから並び替え後の位置を見つける
            const reorderedPosition = currentKeyInfo.order.indexOf(originalColIndex);
            if (reorderedPosition !== -1) {
              const reorderedColumnCells = reorderedTable.querySelectorAll(`th:nth-child(${reorderedPosition + 2}), td:nth-child(${reorderedPosition + 2})`);
              reorderedColumnCells.forEach(c => {
                if (!c.classList.contains('column-highlight')) {
                  c.style.backgroundColor = 'rgba(0, 123, 255, 0.3)';
                }
              });
            }
          }
        });
        
        cell.addEventListener('mouseleave', () => {
          // 元のマトリクスのホバー状態を解除
          columnCells.forEach(c => {
            if (!c.classList.contains('column-highlight')) {
              c.style.backgroundColor = '';
            }
          });
          
          // 並び替え後マトリクスのホバー状態も解除
          const reorderedTable = encReorderedGrid.querySelector('table');
          if (reorderedTable) {
            const reorderedPosition = currentKeyInfo.order.indexOf(originalColIndex);
            if (reorderedPosition !== -1) {
              const reorderedColumnCells = reorderedTable.querySelectorAll(`th:nth-child(${reorderedPosition + 2}), td:nth-child(${reorderedPosition + 2})`);
              reorderedColumnCells.forEach(c => {
                if (!c.classList.contains('column-highlight')) {
                  c.style.backgroundColor = '';
                }
              });
            }
          }
        });
      });
    }
  }

  // クリア
  encClear.addEventListener('click', () => {
    encPlain.value = '';
    encCipher.value = '';
    encKeyword.value = '';
    encNumeric.value = '';
    encError.classList.add('hidden');
    encGridDiv.innerHTML = '';
    encReorderedGrid.innerHTML = '';
    encOrderSpan.textContent = '';
    encCipherDisplay.innerHTML = '';
    // テキストエリアは常に表示
    encCipher.style.display = 'block';
    clearHighlight(); // ハイライトもクリア
    // セクションを非表示
    encIntermediateSection.style.display = 'none';
    encVisualSection.style.display = 'none';
    encResultSection.style.display = 'none';
    encReorderedSection.style.display = 'none';
    
    // 暗号化状態をクリア
    window.encryptionState = {
      cipher: null,
      keyType: null,
      keyword: null,
      numeric: null,
      useKey: true,
      complete: true,
      padChar: 'X',
      colNum: 5
    };
    
    // 復号タブの同期ボタン状態を更新
    if (window.updateSyncButtonState) {
      window.updateSyncButtonState();
    }
    
    updateEncryptButtonState(); // クリア後も状態を更新
  });

  // 並び替えボタン
  encReorderBtn.addEventListener('click', () => {
    if (!currentGrid || !currentKeyInfo) return;
    
    // 列を鍵順に並び替えたグリッドを作成
    const reorderedGrid = [];
    const rows = currentGrid.length;
    const cols = currentKeyInfo.n;
    
    for (let r = 0; r < rows; r++) {
      reorderedGrid[r] = [];
      for (let orderIndex = 0; orderIndex < cols; orderIndex++) {
        const originalCol = currentKeyInfo.order[orderIndex];
        reorderedGrid[r][orderIndex] = currentGrid[r][originalCol];
      }
    }
    
    // 並び替え後のキー情報（1,2,3...の順序）
    const reorderedKeyInfo = {
      order: Array.from({length: cols}, (_, i) => i),
      rank: Array.from({length: cols}, (_, i) => i),
      n: cols
    };
    
    // 並び替え後のマトリクスを表示
    renderGrid(encReorderedGrid, reorderedGrid, '並び替え後', reorderedKeyInfo, currentPadChar);
    encReorderedSection.style.display = 'block';
    
    // まずハイライトをクリア
    clearHighlight();
    
    // ハイライト機能を設定
    setupColumnHighlight();
    
    // マトリクス列クリックイベントを追加
    setTimeout(() => {
      const table = encReorderedGrid.querySelector('table');
      if (table) {
        // 列全体のクリック機能を統一実装
        const numColumns = table.querySelectorAll('th').length - 1; // 行番号列を除く
        
        for (let colIndex = 0; colIndex < numColumns; colIndex++) {
          // 列の全セル（ヘッダーとデータ）を取得
          const columnCells = table.querySelectorAll(`th:nth-child(${colIndex + 2}), td:nth-child(${colIndex + 2})`);
          
          columnCells.forEach(cell => {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              highlightColumn(colIndex);
            });
          });
        }
        
        // 列全体のホバー効果を実装
        for (let colIndex = 0; colIndex < numColumns; colIndex++) {
          const columnCells = table.querySelectorAll(`th:nth-child(${colIndex + 2}), td:nth-child(${colIndex + 2})`);
          
          columnCells.forEach(cell => {
            cell.addEventListener('mouseenter', () => {
              // 同じ列の全セルをホバー状態にする
              columnCells.forEach(c => {
                if (!c.classList.contains('column-highlight')) {
                  c.style.backgroundColor = 'rgba(0, 123, 255, 0.3)';
                }
              });
              
              // 対応する暗号文文字もホバー状態にする
              const cipherChars = encCipherDisplay.querySelectorAll(`[data-column="${colIndex}"]`);
              cipherChars.forEach(char => {
                if (!char.classList.contains('highlighted')) {
                  char.style.backgroundColor = 'rgba(0, 123, 255, 0.3)';
                }
              });
            });
            
            cell.addEventListener('mouseleave', () => {
              // 同じ列の全セルのホバー状態を解除
              columnCells.forEach(c => {
                if (!c.classList.contains('column-highlight')) {
                  c.style.backgroundColor = '';
                }
              });
              
              // 対応する暗号文文字のホバー状態も解除
              const cipherChars = encCipherDisplay.querySelectorAll(`[data-column="${colIndex}"]`);
              cipherChars.forEach(char => {
                if (!char.classList.contains('highlighted')) {
                  char.style.backgroundColor = '';
                }
              });
            });
          });
        }
      }
      
      // 暗号文文字クリックイベント
      encCipherDisplay.querySelectorAll('.cipher-char').forEach(char => {
        char.addEventListener('click', () => {
          const columnIndex = parseInt(char.dataset.column);
          highlightColumn(columnIndex);
        });
      });
    }, 100);
  });

  // コピー
  encCopyBtn.addEventListener('click', () => {
    const text = encCipher.value;
    if (text) copyToClipboard(text, encCopyBtn);
  });

  // 暗号化実行
  encRun.addEventListener('click', () => {
    window.debugLog('ENCRYPT', '🔐 Starting encryption process...');
    
    // エラーをクリア（パディング文字エラーは残す）
    if (!encError.textContent.includes('埋字')) {
      encError.classList.add('hidden');
    }
    try {
      const useKey = encUseKey.checked;
      const complete = encComplete.checked;
      const padChar = (encPadChar.value || 'X')[0];
      
      // パディング文字の再検証
      if (complete && !/^[A-Za-z]$/.test(padChar)) {
        throw new Error('埋字（パディング）は英字1文字のみ使用可能です。');
      }

      const rawPlain = encPlain.value.trim();
      if (!rawPlain) throw new Error('平文を入力してください。');
      
      const plain = normalizeInput(rawPlain, { stripSpace: encStrip.checked, stripSymbol: encStripSymbol.checked, uppercase: encUpper.checked });
      if (!plain.length) throw new Error('平文が空です（整形後）。');

      window.debugLog('ENCRYPT', `📝 Normalized plaintext: "${plain}" (${plain.length} chars)`);

      let keyInfo;
      if (useKey) {
        // 鍵を使用する場合
        const keyType = document.querySelector('input[name="enc-keytype"]:checked').value;
        window.debugLog('ENCRYPT', `🔑 Using key type: ${keyType}`);
        
        if (keyType === 'keyword') {
          const keyword = encKeyword.value.trim();
          if (!keyword) throw new Error('キーワードを入力してください。');
          if (keyword.length < 2) throw new Error('キーワードは2文字以上にしてください。');
          keyInfo = keywordOrder(keyword);
          window.debugLog('ENCRYPT', `🔤 Keyword: "${keyword}" → Order:`, keyInfo);
        } else {
          const numStr = encNumeric.value.trim();
          if (!numStr) throw new Error('鍵数列を入力してください。');
          keyInfo = numericOrder(numStr);
          if (keyInfo && keyInfo.error) throw new Error(keyInfo.error);
          window.debugLog('ENCRYPT', `🔢 Numeric key: "${numStr}" → Order:`, keyInfo);
        }
        if (!keyInfo || keyInfo.n <= 0) throw new Error('鍵の解析に失敗しました。');
        if (keyInfo.n > plain.length) {
          window.debugLog('ENCRYPT', '⚠️ Key length exceeds plaintext length - security may be reduced');
        }
      } else {
        // 鍵なしの場合（1,2,3...の順序）
        const colNum = parseInt(encColNum.value);
        if (!colNum || colNum < 2 || colNum > 20) {
          throw new Error('列数は2～20の範囲で指定してください。');
        }
        // 1,2,3...の順序を作成
        const order = Array.from({length: colNum}, (_, i) => i);
        const rank = Array.from({length: colNum}, (_, i) => i);
        keyInfo = { order, rank, n: colNum };
        window.debugLog('ENCRYPT', `🔢 No key mode: ${colNum} columns`);
      }

      const n = keyInfo.n;
      const { grid, rows } = buildGridByRows(plain, n, padChar, complete);

      window.debugLog('ENCRYPT', `📊 Grid created: ${rows}×${n} (complete: ${complete}, padding: '${padChar}')`);

      // 現在のデータを保存（並び替えボタンで使用）
      currentGrid = grid;
      currentKeyInfo = keyInfo;
      currentPadChar = padChar;

      // 中間状態の表示
      encFormattedText.textContent = plain;
      encCharCount.textContent = plain.length;
      encColCount.textContent = n;
      encRowCount.textContent = rows;
      encIntermediateSection.style.display = 'block';

      // 列を鍵順に縦読み
      let cipher = '';
      for (const origIdx of keyInfo.order) {
        for (let r = 0; r < rows; r++) {
          const ch = grid[r][origIdx];
          if (ch) cipher += ch;
        }
      }
      encCipher.value = cipher;
      currentCipher = cipher;

      window.debugLog('ENCRYPT', `🔐 Cipher generated: "${cipher}" (${cipher.length} chars)`);
      window.debugLog('ENCRYPT', `✅ Encryption completed successfully`);

      // 可視化と結果の表示
      // 数列の数値をそのまま表示（1ベース）
      const displayOrder = keyInfo.rank.map(r => r + 1);
      showOrderBadges(encOrderSpan, displayOrder);
      renderGrid(encGridDiv, grid, '暗号化', keyInfo, padChar);
      
      // 元のマトリクスにホバー機能を追加
      setTimeout(() => {
        setupOriginalMatrixHover();
      }, 50);
      
      encVisualSection.style.display = 'block';
      encResultSection.style.display = 'block';
      
      // 並び替えセクションをリセット
      encReorderedSection.style.display = 'none';
      encReorderedGrid.innerHTML = '';
      encCipherDisplay.innerHTML = '';
      // テキストエリアは常に表示
      encCipher.style.display = 'block';
      clearHighlight(); // ハイライトもクリア
      
      // 暗号化状態を保存（復号タブで使用）
      const keyType = useKey ? document.querySelector('input[name="enc-keytype"]:checked').value : null;
      window.encryptionState = {
        cipher: cipher,
        keyType: keyType,
        keyword: keyType === 'keyword' ? encKeyword.value.trim() : null,
        numeric: keyType === 'numeric' ? encNumeric.value.trim() : null,
        useKey: useKey,
        complete: complete,
        padChar: padChar,
        colNum: useKey ? null : parseInt(encColNum.value)
      };
      
      // 復号タブの同期ボタン状態を更新
      if (window.updateSyncButtonState) {
        window.updateSyncButtonState();
      }
    } catch (e) {
      window.debugLog('ENCRYPT', `❌ Encryption failed: ${e.message}`);
      encError.textContent = e.message;
      encError.classList.remove('hidden');
    }
  });
  
  window.debugLog('ENCRYPT', '✅ Encryption module event listeners configured');

  // プリセットUIを初期化する関数
  async function initializePresetUI() {
    try {
      window.debugLog('ENCRYPT', '📋 Initializing preset UI...');
      
      const presetData = await loadPresets();
      const sampleMenu = document.getElementById('enc-sample-menu');
      
      if (!sampleMenu) {
        window.debugLog('ENCRYPT', '❌ Sample menu not found');
        return;
      }
      
      // 既存のオプションをクリア
      sampleMenu.innerHTML = '';
      
      // プリセットからオプションを動的生成
      presetData.presets.forEach(preset => {
        const option = document.createElement('button');
        option.className = 'sample-option';
        option.dataset.preset = preset.id;
        option.textContent = preset.name;
        option.title = preset.description;
        
        // クリックイベントを追加
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          applySamplePreset(preset.id);
          sampleMenu.classList.add('hidden');
        });
        
        sampleMenu.appendChild(option);
      });
      
      window.debugLog('ENCRYPT', `✅ Generated ${presetData.presets.length} preset options`);
      
    } catch (error) {
      window.debugLog('ENCRYPT', `❌ Failed to initialize preset UI: ${error.message}`);
      console.error('Failed to initialize preset UI:', error);
    }
  }
}