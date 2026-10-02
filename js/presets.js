// プリセット管理モジュール

import { t } from './messages.js';

let cachedPresets = null;

/**
 * プリセットデータを読み込む
 * @returns {Promise<Object>} プリセットデータ
 */
export async function loadPresets() {
  if (cachedPresets) {
    return cachedPresets;
  }

  try {
    window.debugLog('PRESETS', '📂 Loading presets from data/presets.json...');
    
    const response = await fetch('./data/presets.json');
    if (!response.ok) {
      throw new Error(`Failed to load presets: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // データ構造の基本的な検証
    if (!data.presets || !Array.isArray(data.presets)) {
      throw new Error('Invalid presets data structure');
    }
    
    // 各プリセットの必須フィールドと型を検証
    const isText = v => typeof v === 'string' && v.length > 0;
    for (const preset of data.presets) {
      const ok = isText(preset.id) && isText(preset.name) && isText(preset.plaintext) &&
        (preset.keyType === 'keyword' || preset.keyType === 'numeric') &&
        preset.settings && typeof preset.settings === 'object';
      if (!ok) throw new Error(`Invalid preset data: ${typeof preset.id === 'string' ? preset.id : 'unknown'}`);
    }
    
    cachedPresets = data;
    window.debugLog('PRESETS', `✅ Successfully loaded ${data.presets.length} presets`);
    
    return data;
  } catch (error) {
    window.debugLog('PRESETS', `❌ Failed to load presets: ${error.message}`);
    
    // フォールバック: デフォルトプリセット
    const fallbackData = {
      presets: [
        {
          id: "1",
          name: t('preset.fallbackName'),
          description: t('preset.fallbackDescription'),
          plaintext: "Who killed Cock Robin? I, said the Sparrow,",
          keyType: "keyword",
          keyword: "MOTHER",
          numeric: null,
          settings: {
            complete: true,
            padChar: "X",
            stripSpace: true,
            stripSymbol: true,
            uppercase: true,
            useKey: true,
            colNum: null
          }
        }
      ]
    };
    
    window.debugLog('PRESETS', '🔄 Using fallback preset data');
    cachedPresets = fallbackData;
    return fallbackData;
  }
}

/**
 * プリセットIDから特定のプリセットを取得
 * @param {string} presetId プリセットID
 * @returns {Promise<Object|null>} プリセットデータまたはnull
 */
export async function getPresetById(presetId) {
  const data = await loadPresets();
  return data.presets.find(preset => preset.id === presetId) || null;
}
