// ===== 物品翻譯系統 - Item Translation System =====

// 翻譯資料字典 - Translation Data Dictionaries
const translateItemDictionary = {};  // 儲存 {id: name} 的物品翻譯字典
const itemIdsDictionary = {};        // 儲存 {name: [id1, id2, ...]} 的物品ID字典

// DOM 元素引用 - DOM Element References
const translateInput = document.getElementById('translateInput');
const translateSuggestions = document.getElementById('translateSuggestions');
const translateButton = document.getElementById('translateButton');
const translateResultDisplay = document.getElementById('translateResultDisplay');

// 翻譯相關變數 - Translation Variables
let selectedTranslateItemId = null;   // 當前選擇的物品ID
let selectedTranslateItemName = null; // 當前選擇的物品名稱
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

    console.log('初始化物品翻譯功能 - Initializing item translation functionality');
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
        searchTranslateItems(searchTerm);
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
        performTranslation(inputText, currentTranslateMode);
    } else {
        alert('請輸入要翻譯的文字');
    }
}

// 處理建議項目點擊 - Handle Suggestion Item Click
function handleTranslateSuggestionClick(e) {
    selectedTranslateItemId = e.target.dataset.id;
    selectedTranslateItemName = e.target.textContent; // 儲存選中的物品名稱
    if (translateInput) {
        translateInput.value = e.target.textContent.replace(/ \(\d+\)$/, ''); // 移除ID顯示
        hideTranslateSuggestions();
    }
    console.log(`選擇的翻譯物品 - ID: ${e.target.dataset.id}, Name: ${e.target.textContent}`);
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

// 搜尋翻譯物品 - Search Translation Items
async function searchTranslateItems(searchTerm) {
    showTranslateLoading();

    try {
        const apiUrl = getTranslateApiUrl(searchTerm);
        console.log('搜尋翻譯物品:', apiUrl);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data = await response.json();
        console.log('翻譯物品搜尋結果:', data);

        updateTranslateDictionaryAndShowSuggestions(data);

    } catch (error) {
        console.error('翻譯物品搜尋錯誤:', error);
        showTranslateError('搜尋時發生錯誤，請稍後再試');
    }
}

// 獲取翻譯API URL - Get Translation API URL
function getTranslateApiUrl(searchTerm) {
    const encodedTerm = encodeURIComponent(searchTerm);

    if (currentTranslateMode === 'chToEn') {
        return `https://maplestory.io/api/TWMS/256/item?&searchFor=${encodedTerm}`;
    } else if (currentTranslateMode === 'enToCh') {
        return `https://maplestory.io/api/GMS/62/item?&searchFor=${encodedTerm}`;
    }

    throw new Error('不支援的翻譯模式');
}

// 更新翻譯字典並顯示建議 - Update Translation Dictionary and Show Suggestions
function updateTranslateDictionaryAndShowSuggestions(items) {
    if (!translateSuggestions) return;

    translateSuggestions.innerHTML = '';
    clearTranslateDictionary();

    if (!items || items.length === 0) {
        showTranslateNoResults();
        return;
    }

    items.forEach(item => processTranslateItemData(item));

    // 根據 itemIdsDictionary 的 keys 建立建議項目
    Object.keys(itemIdsDictionary).forEach(name => {
        const suggestionItem = createTranslateSuggestionItemFromName(name);
        translateSuggestions.appendChild(suggestionItem);
    });

    showTranslateSuggestions();

    console.log('當前翻譯物品字典:', translateItemDictionary);
    console.log('當前 itemIdsDictionary:', itemIdsDictionary);
}

// 處理翻譯物品資料 - Process Translation Item Data
function processTranslateItemData(item) {
    if (!item.id || !item.name) return;

    translateItemDictionary[item.id] = item.name;

    // 處理 itemIdsDictionary
    if (!itemIdsDictionary[item.name]) {
        itemIdsDictionary[item.name] = [item.id];
    } else {
        if (!itemIdsDictionary[item.name].includes(item.id)) {
            itemIdsDictionary[item.name].push(item.id);
        }
    }
}

// 從名稱建立翻譯建議項目 - Create Translation Suggestion Item from Name
function createTranslateSuggestionItemFromName(name) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.textContent = name; // 顯示 itemIdsDictionary 的 key
    suggestionItem.dataset.id = itemIdsDictionary[name][0]; // 使用第一個ID作為預設

    suggestionItem.addEventListener('click', handleTranslateSuggestionClick);
    return suggestionItem;
}

// 創建翻譯建議項目 - Create Translation Suggestion Item
function createTranslateSuggestionItem(item) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.textContent = item.name; // 只顯示名稱，不顯示ID
    suggestionItem.dataset.id = item.id;

    suggestionItem.addEventListener('click', handleTranslateSuggestionClick);
    return suggestionItem;
}

// 清空翻譯字典 - Clear Translation Dictionary
function clearTranslateDictionary() {
    Object.keys(translateItemDictionary).forEach(key => delete translateItemDictionary[key]);
    Object.keys(itemIdsDictionary).forEach(key => delete itemIdsDictionary[key]);
}

// ===== 翻譯功能 - Translation Functions =====

// 執行翻譯功能 - Perform Translation
async function performTranslation(text, mode) {
    if (!translateResultDisplay) return;

    translateResultDisplay.classList.remove('empty');

    // 嘗試獲取物品ID列表
    let itemIds = null;

    if (selectedTranslateItemName) {
        // 如果有選中的物品名稱，從 itemIdsDictionary 中獲取所有對應的ID
        itemIds = itemIdsDictionary[selectedTranslateItemName] || null;
    } else if (selectedTranslateItemId) {
        // 如果只有選中的ID，使用單一ID
        itemIds = [selectedTranslateItemId];
    } else {
        // 否則根據輸入文字搜尋
        itemIds = getItemIdsByName(text);
    }

    if (itemIds && itemIds.length > 0) {
        await performApiTranslationWithFallback(text, itemIds, mode);
    } else {
        showTranslationNotFound(text);
    }

    selectedTranslateItemId = null; // 清空選擇的ID
    selectedTranslateItemName = null; // 清空選擇的名稱
}

// 執行API翻譯支援多ID嘗試 - Perform API Translation with Multi-ID Fallback
async function performApiTranslationWithFallback(text, itemIds, mode) {
    for (let i = 0; i < itemIds.length; i++) {
        const itemId = itemIds[i];
        try {
            showTranslationInProgress(text);

            const apiUrl = getTranslationApiUrl(itemId, mode);
            console.log(`嘗試獲取物品翻譯 (${i + 1}/${itemIds.length}): ID=${itemId}`);

            const response = await fetch(apiUrl);

            if (response.ok) {
                const data = await response.json();
                const resultName = data.description ? data.description.name : data.name;
                console.log(`物品翻譯成功 (${i + 1}/${itemIds.length}):`, resultName);

                const result = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯結果: ${resultName}</div>
                    </div>
                `;
                translateResultDisplay.innerHTML = result;
                return; // 成功則直接返回
            } else {
                console.log(`物品翻譯失敗 (${i + 1}/${itemIds.length}): ID=${itemId} 不存在 (狀態碼: ${response.status})`);
                if (i === itemIds.length - 1) {
                    // 最後一個ID也失敗了，顯示所有嘗試過的ID
                    const result = `
                        <div class="translate-result">
                            <div class="translate-original">原文: ${text}</div>
                            <div class="translate-translated">翻譯結果: 所有ID都不存在</div>
                            <div class="translate-id">嘗試過的ID: ${itemIds.join(', ')}</div>
                        </div>
                    `;
                    translateResultDisplay.innerHTML = result;
                }
            }

        } catch (error) {
            console.error(`物品翻譯錯誤 (${i + 1}/${itemIds.length}), ID=${itemId}:`, error);
            if (i === itemIds.length - 1) {
                // 最後一個ID也失敗了
                showTranslationError(text);
            }
            // 繼續嘗試下一個ID
        }
    }
}

// 執行API翻譯 - Perform API Translation
async function performApiTranslation(text, itemId, mode) {
    try {
        showTranslationInProgress(text);

        const apiUrl = getTranslationApiUrl(itemId, mode);
        console.log('獲取翻譯:', apiUrl);

        const response = await fetch(apiUrl);
        const result = await processTranslationResponse(response, text, itemId);

        translateResultDisplay.innerHTML = result;

    } catch (error) {
        console.error('翻譯錯誤:', error);
        showTranslationError(text);
    }
}

// 獲取翻譯API URL - Get Translation API URL
function getTranslationApiUrl(itemId, mode) {
    if (mode === 'chToEn') {
        return `https://maplestory.io/api/GMS/62/item/${itemId}`;
    } else if (mode === 'enToCh') {
        return `https://maplestory.io/api/TWMS/256/item/${itemId}`;
    }
    throw new Error('不支援的翻譯模式');
}

// 處理翻譯回應 - Process Translation Response
async function processTranslationResponse(response, originalText, itemId) {
    if (response.ok) {
        const data = await response.json();
        const resultName = data.description ? data.description.name : data.name;
        console.log('翻譯成功:', resultName);

        return `
            <div class="translate-result">
                <div class="translate-original">原文: ${originalText}</div>
                <div class="translate-translated">翻譯結果: ${resultName}</div>
            </div>
        `;
    } else {
        console.log('翻譯失敗: ID不存在');
        return `
            <div class="translate-result">
                <div class="translate-original">原文: ${originalText}</div>
                <div class="translate-translated">翻譯結果: ID: ${itemId} 不存在</div>
            </div>
        `;
    }
}

// 顯示翻譯進行中 - Show Translation In Progress
function showTranslationInProgress(text) {
    translateResultDisplay.innerHTML = `
        <div class="translate-result">
            <div class="translate-original">原文: ${text}</div>
            <div class="translate-translated">翻譯中...</div>
        </div>
    `;
}

// 顯示翻譯未找到 - Show Translation Not Found
function showTranslationNotFound(text) {
    translateResultDisplay.innerHTML = `
        <div class="translate-result">
            <div class="translate-original">原文: ${text}</div>
            <div class="translate-translated">翻譯結果: 找不到對應的物品ID</div>
        </div>
    `;
}

// 顯示翻譯錯誤 - Show Translation Error
function showTranslationError(text) {
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
        translateSuggestions.innerHTML = '<div class="no-results">找不到相關物品</div>';
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

// 根據名稱獲取物品ID列表 - Get Item IDs by Name
function getItemIdsByName(name) {
    return itemIdsDictionary[name] || null;
}

// 根據名稱獲取翻譯物品ID - Get Translation Item ID by Name
function getTranslateItemIdByName(name) {
    for (const [id, itemName] of Object.entries(translateItemDictionary)) {
        if (itemName === name) {
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
    selectedTranslateItemId = null;
    selectedTranslateItemName = null;
    hideTranslateSuggestions();
}
