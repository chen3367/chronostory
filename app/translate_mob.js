// ===== 怪物翻譯系統 - Mob Translation System =====

// 翻譯資料字典 - Translation Data Dictionaries
const translateMobDictionary = {};   // 儲存 {id: name} 的怪物翻譯字典
const mobIdsDictionary = {};        // 儲存 {name: [id1, id2, ...]} 的怪物ID字典

// DOM 元素引用 - DOM Element References
const translateInput = document.getElementById('translateInput');
const translateSuggestions = document.getElementById('translateSuggestions');
const translateButton = document.getElementById('translateButton');
const translateResultDisplay = document.getElementById('translateResultDisplay');

// 翻譯相關變數 - Translation Variables
let selectedTranslateMobName = null; // 當前選擇的怪物名稱
let currentTranslateMode = 'chToEn'; // 當前翻譯模式 (預設中翻英)
let translateDebounceTimer;          // 防抖計時器
const translateDebounceDelay = 300;  // 防抖延遲時間 (ms)

// ===== 初始化設定 - Initialization =====
document.addEventListener('DOMContentLoaded', function() {
    initializeTranslation();
    initializeTranslationEventListeners();
});

// 初始化翻譯功能 - Initialize Translation Functionality
function initializeTranslation() {
    if (!translateInput || !translateButton) return;

    console.log('初始化怪物翻譯功能 - Initializing mob translation functionality');
    updateTranslatePlaceholder();
}

// 初始化翻譯事件監聽器 - Initialize Translation Event Listeners
function initializeTranslationEventListeners() {
    if (translateInput) {
        translateInput.addEventListener('input', handleTranslateInput);
    }

    document.addEventListener('click', handleTranslateDocumentClick);

    if (translateButton) {
        translateButton.addEventListener('click', handleTranslateButtonClick);
    }

    // 模式切換按鈕
    const chToEnBtn = document.getElementById('chToEnBtn');
    const enToChBtn = document.getElementById('enToChBtn');

    if (chToEnBtn) {
        chToEnBtn.addEventListener('click', () => switchTranslateMode('chToEn'));
    }

    if (enToChBtn) {
        enToChBtn.addEventListener('click', () => switchTranslateMode('enToCh'));
    }
}

// ===== 事件處理函數 - Event Handler Functions =====

// 處理翻譯輸入 - Handle Translation Input
function handleTranslateInput(e) {
    const searchTerm = e.target.value.trim();

    clearTimeout(translateDebounceTimer);

    if (searchTerm === '') {
        hideTranslateSuggestions();
        return;
    }

    translateDebounceTimer = setTimeout(() => {
        searchTranslateMobs(searchTerm);
    }, translateDebounceDelay);
}

// 處理翻譯文檔點擊 - Handle Translation Document Click
function handleTranslateDocumentClick(e) {
    if (translateInput && !e.target.closest('.search-wrapper') && e.target.id !== 'translateInput') {
        hideTranslateSuggestions();
    }
}

// 處理翻譯按鈕點擊 - Handle Translation Button Click
function handleTranslateButtonClick() {
    const inputText = translateInput.value.trim();
    if (inputText) {
        performMobTranslation(inputText, currentTranslateMode);
    } else {
        alert('請輸入要翻譯的文字');
    }
}

// 處理建議項目點擊 - Handle Suggestion Item Click
function handleTranslateSuggestionClick(e) {
    selectedTranslateMobName = e.target.textContent; // 儲存選中的怪物名稱
    if (translateInput) {
        translateInput.value = e.target.textContent.replace(/ \(\d+\)$/, ''); // 移除ID顯示
        hideTranslateSuggestions();
    }
    console.log(`選擇的翻譯怪物 - ID: ${e.target.dataset.id}, Name: ${e.target.textContent}`);
}

// ===== 翻譯模式管理 - Translation Mode Management =====

// 切換翻譯模式 - Switch Translation Mode
function switchTranslateMode(mode) {
    if (currentTranslateMode === mode) return;

    currentTranslateMode = mode;

    // 更新按鈕狀態
    const chToEnBtn = document.getElementById('chToEnBtn');
    const enToChBtn = document.getElementById('enToChBtn');

    if (mode === 'chToEn') {
        chToEnBtn?.classList.add('active');
        enToChBtn?.classList.remove('active');
    } else {
        enToChBtn?.classList.add('active');
        chToEnBtn?.classList.remove('active');
    }

    updateTranslatePlaceholder();
    clearTranslateInput();
}

// 更新翻譯輸入框的placeholder文字 - Update Translation Placeholder
function updateTranslatePlaceholder() {
    if (translateInput) {
        translateInput.placeholder = (currentTranslateMode === 'chToEn')
            ? '請輸入中文進行翻譯...'
            : '請輸入英文進行翻譯...';
    }
}

// ===== 搜尋功能 - Search Functions =====

// 搜尋翻譯怪物 - Search Translation Mobs
async function searchTranslateMobs(searchTerm) {
    showTranslateLoading();

    try {
        const apiUrl = getTranslateMobApiUrl(searchTerm);
        console.log('搜尋翻譯怪物:', apiUrl);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data = await response.json();
        console.log('翻譯怪物搜尋結果:', data);

        updateTranslateMobDictionaryAndShowSuggestions(data);

    } catch (error) {
        console.error('翻譯怪物搜尋錯誤:', error);
        showTranslateError('搜尋時發生錯誤，請稍後再試');
    }
}

// 獲取翻譯怪物API URL - Get Translation Mob API URL
function getTranslateMobApiUrl(searchTerm) {
    const encodedTerm = encodeURIComponent(searchTerm);

    if (currentTranslateMode === 'chToEn') {
        return `https://maplestory.io/api/TWMS/256/mob?&searchFor=${encodedTerm}`;
    } else if (currentTranslateMode === 'enToCh') {
        return `https://maplestory.io/api/GMS/62/mob?&searchFor=${encodedTerm}`;
    }

    throw new Error('不支援的翻譯模式');
}

// 更新翻譯怪物字典並顯示建議 - Update Translation Mob Dictionary and Show Suggestions
function updateTranslateMobDictionaryAndShowSuggestions(mobs) {
    if (!translateSuggestions) return;

    translateSuggestions.innerHTML = '';
    clearTranslateMobDictionary();

    if (!mobs || mobs.length === 0) {
        showTranslateNoResults();
        return;
    }

    mobs.forEach(mob => processTranslateMobData(mob));

    // 根據 mobIdsDictionary 的 keys 建立建議項目
    Object.keys(mobIdsDictionary).forEach(name => {
        const suggestionItem = createTranslateMobSuggestionItemFromName(name);
        translateSuggestions.appendChild(suggestionItem);
    });

    showTranslateSuggestions();

    console.log('當前翻譯怪物字典:', translateMobDictionary);
    console.log('當前 mobIdsDictionary:', mobIdsDictionary);
    console.log('搜尋結果數量:', mobs.length);
}

// 處理翻譯怪物資料 - Process Translation Mob Data
function processTranslateMobData(mob) {
    if (!mob.id || !mob.name) return;

    translateMobDictionary[mob.id] = mob.name;

    // 處理 mobIdsDictionary
    if (!mobIdsDictionary[mob.name]) {
        mobIdsDictionary[mob.name] = [mob.id];
    } else {
        if (!mobIdsDictionary[mob.name].includes(mob.id)) {
            mobIdsDictionary[mob.name].push(mob.id);
        }
    }
}

// 從名稱建立翻譯怪物建議項目 - Create Translation Mob Suggestion Item from Name
function createTranslateMobSuggestionItemFromName(name) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.textContent = name; // 顯示 mobIdsDictionary 的 key
    suggestionItem.dataset.id = mobIdsDictionary[name][0]; // 使用第一個ID作為預設

    suggestionItem.addEventListener('click', handleTranslateSuggestionClick);
    return suggestionItem;
}

// 創建翻譯怪物建議項目 - Create Translation Mob Suggestion Item
function createTranslateMobSuggestionItem(mob) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.textContent = mob.name; // 只顯示名稱，不顯示ID
    suggestionItem.dataset.id = mob.id;

    suggestionItem.addEventListener('click', handleTranslateSuggestionClick);
    return suggestionItem;
}

// 清空翻譯怪物字典 - Clear Translation Mob Dictionary
function clearTranslateMobDictionary() {
    Object.keys(translateMobDictionary).forEach(key => delete translateMobDictionary[key]);
    Object.keys(mobIdsDictionary).forEach(key => delete mobIdsDictionary[key]);
}

// ===== 翻譯功能 - Translation Functions =====

// 執行怪物翻譯功能 - Perform Mob Translation
async function performMobTranslation(text, mode) {
    if (!translateResultDisplay) return;

    translateResultDisplay.classList.remove('empty');

    // 嘗試獲取怪物ID列表
    let mobIds = null;

    if (selectedTranslateMobName) {
        // 如果有選中的怪物名稱，從 mobIdsDictionary 中獲取所有對應的ID
        mobIds = mobIdsDictionary[selectedTranslateMobName] || null;
    } else {
        // 否則根據輸入文字搜尋
        mobIds = getMobIdsByName(text);
    }

    if (mobIds && mobIds.length > 0) {
        await performMobApiTranslationWithFallback(text, mobIds, mode);
    } else {
        showMobTranslationNotFound(text);
    }

    selectedTranslateMobName = null; // 清空選擇的名稱
}

// 執行怪物API翻譯支援多ID嘗試 - Perform Mob API Translation with Multi-ID Fallback
async function performMobApiTranslationWithFallback(text, mobIds, mode) {
    const attemptedIds = [];

    for (let i = 0; i < mobIds.length; i++) {
        const mobId = mobIds[i];
        attemptedIds.push(mobId);

        try {
            showMobTranslationInProgress(text);

            const apiUrl = getMobTranslationApiUrl(mobId, mode);
            console.log(`嘗試獲取怪物翻譯 (${i + 1}/${mobIds.length}): ID=${mobId}`);

            const response = await fetch(apiUrl);

            if (response.ok) {
                const data = await response.json();
                console.log(`怪物翻譯成功 (${i + 1}/${mobIds.length}):`, data.name);

                const result = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯結果: ${data.name}</div>
                    </div>
                `;
                translateResultDisplay.innerHTML = result;
                return; // 成功則直接返回
            } else {
                console.log(`怪物翻譯失敗 (${i + 1}/${mobIds.length}): ID=${mobId} 不存在 (狀態碼: ${response.status})`);
            }

        } catch (error) {
            console.error(`怪物翻譯錯誤 (${i + 1}/${mobIds.length}), ID=${mobId}:`, error);
        }
    }

    // 所有ID都嘗試過了但都失敗了，顯示結果
    const result = `
        <div class="translate-result">
            <div class="translate-original">原文: ${text}</div>
            <div class="translate-translated">翻譯結果: 所有ID都不存在</div>
            <div class="translate-id">嘗試過的ID: ${attemptedIds.join(', ')}</div>
        </div>
    `;
    translateResultDisplay.innerHTML = result;
}

// 執行怪物API翻譯 - Perform Mob API Translation
async function performMobApiTranslation(text, mobId, mode) {
    try {
        showMobTranslationInProgress(text);

        const apiUrl = getMobTranslationApiUrl(mobId, mode);
        console.log('獲取怪物翻譯:', apiUrl);

        const response = await fetch(apiUrl);
        const result = await processMobTranslationResponse(response, text, mobId);

        translateResultDisplay.innerHTML = result;

    } catch (error) {
        console.error('怪物翻譯錯誤:', error);
        showMobTranslationError(text);
    }
}

// 獲取怪物翻譯API URL - Get Mob Translation API URL
function getMobTranslationApiUrl(mobId, mode) {
    if (mode === 'chToEn') {
        return `https://maplestory.io/api/GMS/62/mob/${mobId}`;
    } else if (mode === 'enToCh') {
        return `https://maplestory.io/api/TWMS/256/mob/${mobId}`;
    }
    throw new Error('不支援的翻譯模式');
}

// 處理怪物翻譯回應 - Process Mob Translation Response
async function processMobTranslationResponse(response, originalText, mobId) {
    if (response.ok) {
        const data = await response.json();
        console.log('怪物翻譯成功:', data.name);

        return `
            <div class="translate-result">
                <div class="translate-original">原文: ${originalText}</div>
                <div class="translate-translated">翻譯結果: ${data.name}</div>
            </div>
        `;
    } else {
        console.log('怪物翻譯失敗: ID不存在');
        return `
            <div class="translate-result">
                <div class="translate-original">原文: ${originalText}</div>
                <div class="translate-translated">翻譯結果: ID: ${mobId} 不存在</div>
            </div>
        `;
    }
}

// 顯示怪物翻譯進行中 - Show Mob Translation In Progress
function showMobTranslationInProgress(text) {
    translateResultDisplay.innerHTML = `
        <div class="translate-result">
            <div class="translate-original">原文: ${text}</div>
            <div class="translate-translated">翻譯中...</div>
        </div>
    `;
}

// 顯示怪物翻譯未找到 - Show Mob Translation Not Found
function showMobTranslationNotFound(text) {
    translateResultDisplay.innerHTML = `
        <div class="translate-result">
            <div class="translate-original">原文: ${text}</div>
            <div class="translate-translated">翻譯結果: 找不到對應的怪物ID</div>
        </div>
    `;
}

// 顯示怪物翻譯錯誤 - Show Mob Translation Error
function showMobTranslationError(text) {
    translateResultDisplay.innerHTML = `
        <div class="translate-result">
            <div class="translate-original">原文: ${text}</div>
            <div class="translate-translated">翻譯結果: 翻譯時發生錯誤</div>
        </div>
    `;
}

// ===== UI 顯示函數 - UI Display Functions =====

// 顯示翻譯載入中 - Show Translation Loading
function showTranslateLoading() {
    if (translateSuggestions) {
        translateSuggestions.innerHTML = '<div class="loading">搜尋中...</div>';
        showTranslateSuggestions();
    }
}

// 顯示翻譯無結果 - Show Translation No Results
function showTranslateNoResults() {
    if (translateSuggestions) {
        translateSuggestions.innerHTML = '<div class="no-results">找不到相關怪物</div>';
        showTranslateSuggestions();
    }
}

// 顯示翻譯錯誤訊息 - Show Translation Error Message
function showTranslateError(message) {
    if (translateSuggestions) {
        translateSuggestions.innerHTML = `<div class="no-results">${message}</div>`;
        showTranslateSuggestions();
    }
}

// 顯示翻譯建議框 - Show Translation Suggestions
function showTranslateSuggestions() {
    if (translateSuggestions) {
        translateSuggestions.classList.add('show');
    }
}

// 隱藏翻譯建議框 - Hide Translation Suggestions
function hideTranslateSuggestions() {
    if (translateSuggestions) {
        translateSuggestions.classList.remove('show');
    }
}

// ===== 工具函數 - Utility Functions =====

// 根據名稱獲取怪物ID列表 - Get Mob IDs by Name
function getMobIdsByName(name) {
    return mobIdsDictionary[name] || null;
}

// 根據名稱獲取翻譯怪物ID - Get Translation Mob ID by Name
function getTranslateMobIdByName(name) {
    for (const [id, mobName] of Object.entries(translateMobDictionary)) {
        if (mobName === name) {
            return id;
        }
    }
    return null;
}

// 清除翻譯輸入框和結果顯示 - Clear Translation Input and Results
function clearTranslateInput() {
    if (translateInput) {
        translateInput.value = '';
    }
    if (translateResultDisplay) {
        translateResultDisplay.classList.add('empty');
        translateResultDisplay.innerHTML = '';
    }
    selectedTranslateMobName = null;
    hideTranslateSuggestions();
}
