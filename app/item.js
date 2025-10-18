// ===== 物品查詢功能 - Item Query System =====

// DOM 元素引用 - DOM Element References
const searchInput = document.getElementById('searchInput');
const suggestionsDiv = document.getElementById('suggestions');
const searchButton = document.getElementById('searchButton');
const resultDisplay = document.getElementById('resultDisplay');

// 搜尋相關變數 - Search Related Variables
let selectedItemId = null;          // 當前選擇的物品ID
let lastSearchResponse = null;       // 最後一次搜尋的API回應
let debounceTimer;                  // 防抖計時器
const debounceDelay = 300;          // 防抖延遲時間 (ms)

// 快取系統變數 - Cache System Variables
let searchCache = new Map();        // 搜尋結果快取：搜尋詞 -> 搜尋結果
let itemDetailsCache = new Map();   // 物品詳情快取：物品ID -> 詳情資料
let itemIconCache = new Map();      // 物品圖標快取：物品ID -> 圖標URL
let mobDropCache = new Map();       // 怪物掉落快取：物品ID -> 掉落資料
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 快取過期時間：24小時

// ===== 初始化設定 - Initialization =====
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
    initializeEventListeners();
});

// 初始化搜尋功能 - Initialize Search Functionality
function initializeSearch() {
    if (!searchInput) return;

    console.log('初始化物品搜尋功能 - Initializing item search functionality');

    // 初始化快取系統
    initializeCacheSystem();

    // 定期清理過期快取（每小時執行一次）
    setInterval(cleanExpiredCache, 60 * 60 * 1000);
}

// 初始化快取系統 - Initialize Cache System
function initializeCacheSystem() {
    console.log('初始化快取系統 - Initializing cache system');

    // 檢查瀏覽器是否支援本地儲存
    if (typeof Storage !== 'undefined') {
        // 嘗試從本地儲存載入快取資料
        loadCacheFromStorage();
    }

    // 監聽頁面卸載事件，儲存快取到本地儲存
    window.addEventListener('beforeunload', saveCacheToStorage);

    // 監聽可見性變化，當頁面變為可見時檢查快取
    document.addEventListener('visibilitychange', handleVisibilityChange);

    console.log('快取系統初始化完成');
}

// 從本地儲存載入快取 - Load Cache from Storage
function loadCacheFromStorage() {
    try {
        const cachedData = localStorage.getItem('itemSearchCache');
        if (cachedData) {
            const cacheData = JSON.parse(cachedData);

            // 檢查快取資料是否過期（超過24小時）
            if (Date.now() - cacheData.timestamp < CACHE_EXPIRY) {
                if (cacheData.searchCache) {
                    for (const [key, value] of Object.entries(cacheData.searchCache)) {
                        searchCache.set(key, value);
                    }
                }

                if (cacheData.itemDetailsCache) {
                    for (const [key, value] of Object.entries(cacheData.itemDetailsCache)) {
                        itemDetailsCache.set(key, value);
                    }
                }

                if (cacheData.itemIconCache) {
                    for (const [key, value] of Object.entries(cacheData.itemIconCache)) {
                        itemIconCache.set(key, value);
                    }
                }

                if (cacheData.mobDropCache) {
                    for (const [key, value] of Object.entries(cacheData.mobDropCache)) {
                        mobDropCache.set(key, value);
                    }
                }

                console.log('已從本地儲存載入快取資料');
            } else {
                console.log('本地儲存的快取資料已過期，已清除');
                localStorage.removeItem('itemSearchCache');
            }
        }
    } catch (error) {
        console.error('載入快取資料失敗:', error);
    }
}

// 儲存快取到本地儲存 - Save Cache to Storage
function saveCacheToStorage() {
    try {
        const cacheData = {
            searchCache: Object.fromEntries(searchCache),
            itemDetailsCache: Object.fromEntries(itemDetailsCache),
            itemIconCache: Object.fromEntries(itemIconCache),
            mobDropCache: Object.fromEntries(mobDropCache),
            timestamp: Date.now()
        };

        localStorage.setItem('itemSearchCache', JSON.stringify(cacheData));
        console.log('快取資料已儲存到本地儲存');
    } catch (error) {
        console.error('儲存快取資料失敗:', error);
    }
}

// 處理頁面可見性變化 - Handle Visibility Change
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        // 頁面變為可見時，清理過期快取並檢查本地儲存
        cleanExpiredCache();
        loadCacheFromStorage();
    }
}

// 初始化事件監聽器 - Initialize Event Listeners
function initializeEventListeners() {
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }

    document.addEventListener('click', handleDocumentClick);

    if (searchButton) {
        searchButton.addEventListener('click', handleSearchButtonClick);
    }
}

// ===== 搜尋處理函數 - Search Handler Functions =====

// 處理搜尋輸入 - Handle Search Input
function handleSearchInput(e) {
    const searchTerm = e.target.value.trim();

    clearTimeout(debounceTimer);

    if (searchTerm === '') {
        hideSuggestions();
        return;
    }

    debounceTimer = setTimeout(() => {
        searchItem(searchTerm);
    }, debounceDelay);
}

// 處理文檔點擊 - Handle Document Click
function handleDocumentClick(e) {
    if (searchInput && !e.target.closest('.search-wrapper')) {
        hideSuggestions();
    }
}

// 處理建議項目點擊 - Handle Suggestion Item Click
function handleSuggestionItemClick(e) {
    selectedItemId = e.target.dataset.id;
    if (searchInput && searchButton) {
        searchInput.value = e.target.textContent;
        searchButton.disabled = false;
        hideSuggestions();
    }
    console.log(`選擇的物品 - ID: ${e.target.dataset.id}, Name: ${e.target.textContent}`);
}

// 處理搜尋按鈕點擊 - Handle Search Button Click
async function handleSearchButtonClick() {
    if (!selectedItemId) {
        alert('請先選擇一個物品');
        return;
    }

    await fetchItemDetails(selectedItemId);
}

// ===== 搜尋功能 - Search Functions =====

// 搜尋物品函數（帶重試機制和快取系統） - Search Item Function with Retry Mechanism and Cache System
async function searchItem(searchTerm) {
    showLoading();

    // 檢查快取中是否有搜尋結果
    const cachedResult = getCachedSearchResult(searchTerm);
    if (cachedResult) {
        console.log(`使用快取搜尋結果: ${searchTerm}`);
        updateDictionaryAndShowSuggestions(cachedResult.items);
        return;
    }

    console.log(`快取中未找到 "${searchTerm}"，進行API搜尋`);

    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await performItemSearch(searchTerm);

            if (response.ok) {
                const data = await response.json();

                // 將搜尋結果儲存到快取
                setCachedSearchResult(searchTerm, data);

                updateDictionaryAndShowSuggestions(data.items || []);
                console.log(`搜尋成功完成於嘗試 ${attempt + 1}，結果已快取`);
                return;
            } else {
                throw new Error(`請求失敗: ${response.status}`);
            }

        } catch (error) {
            lastError = error;
            console.error(`搜尋嘗試 ${attempt + 1} 失敗:`, error);

            if (attempt < maxRetries) {
                const delay = (attempt + 1) * 1000;
                console.log(`等待 ${delay}ms 後進行第 ${attempt + 2} 次嘗試`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    console.error('搜尋最終失敗，經過所有重試:', lastError);
    showError('搜尋時發生錯誤，請稍後再試');
}

// 執行物品搜尋 - Perform Item Search
async function performItemSearch(searchTerm) {
    const apiUrl = `https://chronostory.onrender.com/api/unified-search`;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(apiUrl);

    return await fetch(proxyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: searchTerm
        })
    });
}

// 更新搜尋結果並顯示建議 - Update Search Results and Show Suggestions
function updateDictionaryAndShowSuggestions(items) {
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (!items || items.length === 0) {
        showNoResults();
        return;
    }

    // 儲存搜尋回應
    lastSearchResponse = { items };

    items.forEach(item => processItemData(item));
    showSuggestions();

    console.log('搜尋結果已更新:', items);
}

// 處理物品資料 - Process Item Data
function processItemData(item) {
    if (!item.item_id || !item.item_name) return;

    // 創建建議項目
    const suggestionItem = createSuggestionItem(item);
    suggestionsDiv.appendChild(suggestionItem);
}

// 創建建議項目 - Create Suggestion Item
function createSuggestionItem(item) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.textContent = item.item_name;
    suggestionItem.dataset.id = item.item_id;

    suggestionItem.addEventListener('click', handleSuggestionItemClick);

    return suggestionItem;
}

// ===== UI 顯示函數 - UI Display Functions =====

// 顯示載入中 - Show Loading
function showLoading() {
    if (suggestionsDiv) {
        suggestionsDiv.innerHTML = '<div class="loading">搜尋中...</div>';
        showSuggestions();
    }
}

// 顯示無結果 - Show No Results
function showNoResults() {
    if (suggestionsDiv) {
        suggestionsDiv.innerHTML = '<div class="no-results">找不到相關物品</div>';
        showSuggestions();
    }
}

// 顯示錯誤訊息 - Show Error Message
function showError(message) {
    if (suggestionsDiv) {
        suggestionsDiv.innerHTML = `<div class="no-results">${message}</div>`;
        showSuggestions();
    }
}

// 顯示建議框 - Show Suggestions
function showSuggestions() {
    if (suggestionsDiv) {
        suggestionsDiv.classList.add('show');
    }
}

// 隱藏建議框 - Hide Suggestions
function hideSuggestions() {
    if (suggestionsDiv) {
        suggestionsDiv.classList.remove('show');
    }
}

// ===== 物品詳情功能 - Item Details Functions =====

// 獲取物品詳細資訊 - Fetch Item Details
async function fetchItemDetails(itemId) {
    if (!resultDisplay) return;

    resultDisplay.classList.remove('empty');
    resultDisplay.innerHTML = '<div class="loading-message">載入中...</div>';

    try {
        const itemInfo = await fetchItemInfo(itemId);
        const iconUrl = await getItemIconUrl(itemId);
        await fetchMobDropInfo(itemId, iconUrl, itemInfo);
    } catch (error) {
        console.error('獲取物品詳細資訊錯誤:', error);
        resultDisplay.innerHTML = '<div class="error-message">獲取物品資訊時發生錯誤，請稍後再試</div>';
    }
}

// 獲取物品資訊 - Fetch Item Info
async function fetchItemInfo(itemId) {
    const infoUrl = `https://chronostory.onrender.com/api/item-info?itemId=${itemId}`;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(infoUrl);

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error('無法獲取物品資訊');
    }

    const itemInfo = await response.json();
    console.log('成功獲取物品資訊:', itemInfo);
    return itemInfo;
}

// 獲取物品圖標URL - Get Item Icon URL
async function getItemIconUrl(itemId) {
    // 優先使用搜尋回應中的 sprite_override.url
    if (lastSearchResponse && lastSearchResponse.items) {
        const item = lastSearchResponse.items.find(item => item.item_id === itemId);
        if (item && item.sprite_override && item.sprite_override.url) {
            const spriteUrl = item.sprite_override.url.startsWith('http')
                ? item.sprite_override.url
                : 'https://chronostory.onrender.com' + item.sprite_override.url;
            console.log('使用搜尋回應中的物品 sprite_override.url:', spriteUrl);
            return spriteUrl;
        }
    }

    // 嘗試從 API 獲取圖標
    try {
        const iconUrlApi = `https://maplestory.io/api/GMS/62/item/${itemId}/icon`;
        const response = await fetch(iconUrlApi);

        if (response.ok) {
            const iconBlob = await response.blob();
            const iconUrl = URL.createObjectURL(iconBlob);
            console.log('成功獲取物品圖標來自:', iconUrlApi);
            return iconUrl;
        }
    } catch (error) {
        console.log('獲取物品圖標失敗:', error);
    }

    // 嘗試備用圖標來源
    try {
        const fallbackIconUrl = `https://chronostory.onrender.com/sprites/${itemId}.png`;
        const fallbackProxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(fallbackIconUrl);
        const fallbackResponse = await fetch(fallbackProxyUrl);

        if (fallbackResponse.ok) {
            const iconBlob = await fallbackResponse.blob();
            const iconUrl = URL.createObjectURL(iconBlob);
            console.log('成功獲取備用物品圖標來自:', fallbackIconUrl);
            return iconUrl;
        }
    } catch (error) {
        console.error('獲取備用物品圖標時發生錯誤:', error);
    }

    // 使用預設圖標
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjMyIiB5PSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOTk5Ij5ObyBJY29uPC90ZXh0Pgo8L3N2Zz4K';
}

// 獲取怪物掉落資訊 - Fetch Mob Drop Info
async function fetchMobDropInfo(itemId, iconUrl, itemInfo) {
    try {
        const mobSearchUrl = `https://chronostory.onrender.com/api/mob-search?itemId=${itemId}`;
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(mobSearchUrl);
        const response = await fetch(proxyUrl);

        if (response.ok) {
            const mobData = await response.json();
            console.log('成功獲取怪物掉落資訊:', mobData);
            displayItemDetailsWithDrops(iconUrl, itemInfo, mobData);
        } else {
            console.log('無法獲取怪物掉落資訊，僅顯示物品資訊');
            displayItemDetailsWithDrops(iconUrl, itemInfo, []);
        }
    } catch (error) {
        console.error('獲取怪物掉落資訊錯誤:', error);
        displayItemDetailsWithDrops(iconUrl, itemInfo, []);
    }
}

// ===== 顯示函數 - Display Functions =====

// 顯示物品詳細資訊（包含怪物掉落資訊） - Display Item Details with Drops
function displayItemDetailsWithDrops(iconUrl, itemInfo, mobData) {
    if (!resultDisplay) return;

    // 根據物品類型決定顯示函數
    if (itemInfo.type === 'Eqp') {
        displayEqpDetailsWithDrops(iconUrl, itemInfo, mobData);
    } else if (itemInfo.sub_type === 'Scroll') {
        displayScrollDetailsWithDrops(iconUrl, itemInfo, mobData);
    } else if (itemInfo.sub_type === 'Potion') {
        displayPotionDetailsWithDrops(iconUrl, itemInfo, mobData);
    } else {
        displayItemDetails(iconUrl, itemInfo, mobData);
    }
}

// 顯示裝備詳細資訊（包含怪物掉落資訊） - Display Equipment Details with Drops
function displayEqpDetailsWithDrops(iconUrl, itemInfo, mobData) {
    const equipment = itemInfo.equipment;

    let html = generateItemHeaderHTML(iconUrl, itemInfo);
    html += generateEquipmentClassHTML(equipment);
    html += generateItemBasicInfoHTML(itemInfo, equipment);
    html += generateEquipmentReqStatHTML(equipment);
    html += generateMobDropsHTML(mobData);

    resultDisplay.innerHTML = html;
}

// 顯示捲軸詳細資訊（包含怪物掉落資訊） - Display Scroll Details with Drops
function displayScrollDetailsWithDrops(iconUrl, itemInfo, mobData) {
    const scroll = itemInfo.scroll;

    let html = generateItemHeaderHTML(iconUrl, itemInfo);
    html += generateItemBasicInfoHTML(itemInfo, scroll);
    html += generateScrollStatsHTML(itemInfo.scroll);
    html += generateMobDropsHTML(mobData);

    resultDisplay.innerHTML = html;
}

// 顯示藥水詳細資訊（包含怪物掉落資訊） - Display Potion Details with Drops
function displayPotionDetailsWithDrops(iconUrl, itemInfo, mobData) {
    const potion = itemInfo.potion;

    let html = generateItemHeaderHTML(iconUrl, itemInfo);
    html += generateItemBasicInfoHTML(itemInfo, potion);
    html += generatePotionEffectsHTML(itemInfo.potion);
    html += generateMobDropsHTML(mobData);

    resultDisplay.innerHTML = html;
}

// 顯示物品詳細資訊 - Display Item Details
function displayItemDetails(iconUrl, itemInfo, mobData) {
    let html = generateItemHeaderHTML(iconUrl, itemInfo);
    html += generateItemBasicInfoHTML(itemInfo, {});
    html += generateMobDropsHTML(mobData);

    resultDisplay.innerHTML = html;
}

// 生成物品標頭HTML - Generate Item Header HTML
function generateItemHeaderHTML(iconUrl, itemInfo) {
    const itemType = (itemInfo.type && itemInfo.sub_type)
        ? `${translateType(itemInfo.type)} - ${translateSubType(itemInfo.sub_type)}`
        : '';

    return `
        <div class="item-header">
            <img src="${iconUrl}" alt="${itemInfo.item_name}" class="item-icon" />
            <div class="item-title">
                <h2>${itemInfo.item_name}</h2>
                ${itemType ? `<div class="item-type">${itemType}</div>` : ''}
                ${itemInfo.item_description ? `<div class="item-description">${itemInfo.item_description.replace(/\\n/g, '<br>')}</div>` : ''}
            </div>
        </div>
        <div class="item-info">
    `;
}

// 生成裝備職業HTML - Generate Equipment Class HTML
function generateEquipmentClassHTML(equipment) {
    if (!equipment || !equipment.classes) return '';

    const allClasses = [
        { key: 'beginner', name: '初心者', active: equipment.classes.beginner },
        { key: 'warrior', name: '劍士', active: equipment.classes.warrior },
        { key: 'magician', name: '法師', active: equipment.classes.magician },
        { key: 'bowman', name: '弓箭手', active: equipment.classes.bowman },
        { key: 'thief', name: '盜賊', active: equipment.classes.thief },
        { key: 'pirate', name: '海盜', active: equipment.classes.pirate }
    ];

    const classTags = allClasses.map(cls =>
        `<span class="class-tag ${cls.active ? 'active' : 'inactive'}">${cls.name}</span>`
    ).join('');

    return `<div class="class-tags">${classTags}</div></div><div class="item-info">`;
}

// 生成物品基本資訊HTML - Generate Item Basic Info HTML
function generateItemBasicInfoHTML(itemInfo, item) {
    let html = `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">物品ID:</span><span class="info-value">${itemInfo.item_id}</span></div>
            ${item.category ? `<div class="info-row"><span class="info-label">類別:</span><span class="info-value">${translateCategory(item.category)}</span></div>` : ''}
            <div class="info-row"><span class="info-label">販賣價格:</span><span class="info-value">${itemInfo.sale_price.toLocaleString()} 楓幣</span></div>
            ${itemInfo.untradeable ? '<div class="info-row"><span class="info-label">不可交易</span></div>' : ''}
        </div>
    `;

    return html;
}

// 生成裝備需求HTML - Generate Equipment Requirements HTML
function generateEquipmentReqStatHTML(equipment) {
    if (!equipment || !equipment.requirements) return '';

    const requirements = equipment.requirements;
    let html = ''
    const reqHtml = [];

    if (requirements.req_level) reqHtml.push(`<div class="info-row"><span class="info-label">等級:</span><span class="info-value">${requirements.req_level}</span></div>`);
    if (requirements.req_str) reqHtml.push(`<div class="info-row"><span class="info-label">力量:</span><span class="info-value">${requirements.req_str}</span></div>`);
    if (requirements.req_dex) reqHtml.push(`<div class="info-row"><span class="info-label">敏捷:</span><span class="info-value">${requirements.req_dex}</span></div>`);
    if (requirements.req_int) reqHtml.push(`<div class="info-row"><span class="info-label">智力:</span><span class="info-value">${requirements.req_int}</span></div>`);
    if (requirements.req_luk) reqHtml.push(`<div class="info-row"><span class="info-label">幸運:</span><span class="info-value">${requirements.req_luk}</span></div>`);

    if (reqHtml.length > 0) {
        html += `
            <div class="info-section">
                <h3>需求條件</h3>
                ${reqHtml.join('')}
        `
    }

    if (!equipment || !equipment.stats || typeof equipment.stats !== 'object') return html + "</div>";

    const stats = equipment.stats;
    let statsHtml = '';

    for (const [key, val] of Object.entries(stats)) {
        if (val != null) {
            const formattedVal = val.toString().padStart(3, ' ');
            let statDisplay = `<span class="info-value positive stat-value">${formattedVal}</span>`;

            // 如果存在對應的屬性變化
            if (equipment.stat_variation && equipment.stat_variation[key] && typeof equipment.stat_variation[key] === 'object') {
                const variation = equipment.stat_variation[key];
                if (variation.min !== null && variation.max !== null) {
                    statDisplay = `<span class="info-value neutral variation-range">(${variation.min}~${variation.max})</span> ` + statDisplay;
                }
            }

            statsHtml += `
                <div class="info-row">
                    <span class="info-label">${translateStatName(key)}:</span>
                    <span class="info-value-container">${statDisplay}</span>
                </div>
            `;
        }
    }

    if (statsHtml && html) {
        html += `
                <br>
                <h3>能力值</h3>
                ${statsHtml}
            </div>
        `
    } else if (html){
        html += "</div>"
    }

    return html
}


// 生成捲軸統計HTML - Generate Scroll Stats HTML
function generateScrollStatsHTML(scroll) {
    if (!scroll || !scroll.stats || typeof scroll.stats !== 'object') return '';

    const stats = {...scroll.stats, ...{"成功率": scroll.success_rate}, ...{"破壞率": scroll.destroy_rate}};
    let statsHtml = '';

    for (const [key, val] of Object.entries(stats)) {
        if (val != null) {
            const formattedVal = val.toString().padStart(3, ' ');
            statsHtml += `
                <div class="info-row">
                    <span class="info-label">${translateStatName(key)}:</span>
                    ${key === "破壞率" ? `<span class="info-value negative stat-value">${formattedVal}</span>` : `<span class="info-value positive stat-value">${formattedVal}</span>`}
                </div>
            `;
        }
    }

    return statsHtml !== '' ? `
        <div class="info-section">
            <h3>卷軸效果</h3>
            ${statsHtml}
        </div>
    ` : '';
}

// 生成藥水效果HTML - Generate Potion Effects HTML
function generatePotionEffectsHTML(potion) {
    if (!potion) return '';

    let html = `<div class="info-section"><h3>藥水效果</h3>`;

    if (potion.duration) html += `<div class="info-row"><span class="info-label">持續時間:</span><span class="info-value positive stat-value">${potion.duration}</span></div>`;
    if (potion.cooldown) html += `<div class="info-row"><span class="info-label">冷卻時間:</span><span class="info-value positive stat-value">${potion.cooldown}</span></div>`;

    // 顯示藥水效果屬性
    if (potion.stats && typeof potion.stats === 'object') {
        const stats = potion.stats;

        for (const [key, val] of Object.entries(stats)) {
            if (val != null) {
                let displayVal;
                if ((val === 1 || (typeof val === 'number' && val % 1 !== 0)) && (key === 'hp' || key === 'mp')) {
                    if (typeof val === 'number' && val % 1 !== 0) {
                        displayVal = `${Math.round(val * 100)}%`;
                    } else {
                        displayVal = '100%';
                    }
                } else {
                    displayVal = val;
                }

                html += `
                    <div class="info-row">
                        <span class="info-label">${translateStatName(key)}:</span>
                        <span class="info-value positive stat-value">${displayVal}</span>
                    </div>
                `;
            }
        }
    }

    html += `</div>`;
    return html;
}

// 生成怪物掉落HTML - Generate Mob Drops HTML
function generateMobDropsHTML(mobData) {
    if (!mobData || mobData.length === 0) return '';

    const dropsHtml = mobData.map(mob => {
        const mobImageUrl = getMobIconUrl(mob);
        return `
            <div class="mob-drop-item">
                <img src="${mobImageUrl}" alt="${mob.mob_name}" class="mob-image" />
                <div class="mob-info">
                    <div class="mob-name">${mob.mob_name}</div>
                    <div class="mob-chance">掉落率: ${(mob.chance).toFixed(2)}%</div>
                </div>
            </div>
        `;
    }).join('');

    const sectionClass = mobData.length > 6 ? 'info-section drops-section' : 'info-section';
    return `
        <div class="${sectionClass}">
            <h3>怪物掉落</h3>
            <div class="mob-drops">${dropsHtml}</div>
        </div>
    `;
}

// 獲取怪物圖標URL - Get Mob Icon URL
function getMobIconUrl(mob) {
    if (mob.sprite_override && mob.sprite_override.url) {
        return mob.sprite_override.url.startsWith('http')
            ? mob.sprite_override.url
            : 'https://chronostory.onrender.com' + mob.sprite_override.url;
    }

    return `https://maplestory.io/api/gms/83/mob/${mob.mob_id}/render/stand`;
}

// ===== 快取管理函數 - Cache Management Functions =====

// 獲取快取中的搜尋結果 - Get Cached Search Result
function getCachedSearchResult(searchTerm) {
    const cached = searchCache.get(searchTerm);
    if (!cached) return null;

    // 檢查快取是否過期
    if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
        searchCache.delete(searchTerm);
        console.log(`快取過期，已刪除: ${searchTerm}`);
        return null;
    }

    return cached.data;
}

// 設定快取搜尋結果 - Set Cached Search Result
function setCachedSearchResult(searchTerm, data) {
    searchCache.set(searchTerm, {
        data: data,
        timestamp: Date.now()
    });
    console.log(`已快取搜尋結果: ${searchTerm}`);
}

// 清理過期的快取 - Clean Expired Cache
function cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of searchCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            searchCache.delete(key);
            cleanedCount++;
        }
    }

    for (const [key, value] of itemDetailsCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            itemDetailsCache.delete(key);
            cleanedCount++;
        }
    }

    for (const [key, value] of itemIconCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            itemIconCache.delete(key);
            cleanedCount++;
        }
    }

    for (const [key, value] of mobDropCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            mobDropCache.delete(key);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`已清理 ${cleanedCount} 個過期快取項目`);
    }
}

// 獲取快取統計資訊 - Get Cache Statistics
function getCacheStats() {
    return {
        searchCache: searchCache.size,
        itemDetailsCache: itemDetailsCache.size,
        itemIconCache: itemIconCache.size,
        mobDropCache: mobDropCache.size,
        totalCacheSize: searchCache.size + itemDetailsCache.size + itemIconCache.size + mobDropCache.size
    };
}

// 匯出快取資料（用於備份或遷移） - Export Cache Data
function exportCacheData() {
    const cacheData = {
        searchCache: Object.fromEntries(searchCache),
        itemDetailsCache: Object.fromEntries(itemDetailsCache),
        itemIconCache: Object.fromEntries(itemIconCache),
        mobDropCache: Object.fromEntries(mobDropCache),
        exportTime: Date.now()
    };

    const blob = new Blob([JSON.stringify(cacheData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `item-search-cache-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('快取資料已匯出');
}

// 匯入快取資料 - Import Cache Data
function importCacheData(jsonData) {
    try {
        const cacheData = JSON.parse(jsonData);

        if (cacheData.searchCache) {
            for (const [key, value] of Object.entries(cacheData.searchCache)) {
                searchCache.set(key, value);
            }
        }

        if (cacheData.itemDetailsCache) {
            for (const [key, value] of Object.entries(cacheData.itemDetailsCache)) {
                itemDetailsCache.set(key, value);
            }
        }

        if (cacheData.itemIconCache) {
            for (const [key, value] of Object.entries(cacheData.itemIconCache)) {
                itemIconCache.set(key, value);
            }
        }

        if (cacheData.mobDropCache) {
            for (const [key, value] of Object.entries(cacheData.mobDropCache)) {
                mobDropCache.set(key, value);
            }
        }

        console.log('快取資料已匯入');
        return true;
    } catch (error) {
        console.error('匯入快取資料失敗:', error);
        return false;
    }
}

// ===== 工具函數 - Utility Functions =====

// 根據ID從搜尋回應獲取物品名稱 - Get Item Name by ID from Search Response
function getItemNameById(id) {
    if (lastSearchResponse && lastSearchResponse.items) {
        const item = lastSearchResponse.items.find(item => item.item_id === id);
        return item ? item.item_name : null;
    }
    return null;
}

// 根據名稱從搜尋回應獲取物品ID - Get Item ID by Name from Search Response
function getItemIdByName(name) {
    if (lastSearchResponse && lastSearchResponse.items) {
        const item = lastSearchResponse.items.find(item => item.item_name === name);
        return item ? item.item_id : null;
    }
    return null;
}

// 獲取最後搜尋回應 - Get Last Search Response
function getLastSearchResponse() {
    return lastSearchResponse;
}

// 檢查是否有搜尋結果 - Has Search Results
function hasSearchResults() {
    return lastSearchResponse && lastSearchResponse.items && lastSearchResponse.items.length > 0;
}

// 獲取搜尋結果數量 - Get Search Results Count
function getSearchResultsCount() {
    return lastSearchResponse && lastSearchResponse.items ? lastSearchResponse.items.length : 0;
}

// 清空所有快取和狀態 - Clear All Cache and State
function clearAllCache() {
    searchCache.clear();
    itemDetailsCache.clear();
    itemIconCache.clear();
    mobDropCache.clear();
    lastSearchResponse = null;
    if (searchInput) searchInput.value = '';
    if (searchButton) searchButton.disabled = true;
    selectedItemId = null;
    hideSuggestions();
    console.log('所有快取已清空');
}

// ===== 翻譯函數 - Translation Functions =====

// 翻譯類型 - Translate Type
function translateType(type) {
    const map = { 'Eqp': '裝備', 'Use': '消耗', 'Setup': '裝飾', 'Etc': '其他', 'Cash': '現金', 'Consume': '消耗' };
    return map[type] || type;
}

// 翻譯子類型 - Translate Sub Type
function translateSubType(subType) {
    const map = {
        'Cap': '帽子', 'Coat': '上衣', 'Pants': '褲裙', 'Shoes': '鞋子', 'Glove': '手套',
        'Cape': '披風', 'Shield': '盾牌', 'Weapon': '武器', 'Ring': '戒指', 'Pendant': '項鍊',
        'Belt': '腰帶', 'Medal': '勳章', 'Shoulder': '肩膀', 'Pocket': '口袋道具',
        'Badge': '徽章', 'Emblem': '紋章', 'Android': '機器人', 'Mechanic': '機甲',
        'Bits': '零件', 'Face': '臉飾', 'Eye': '眼飾', 'Earring': '耳環', 'Projectile': '投擲物',
        'Scroll': '卷軸', 'Potion': '藥水'
    };
    return map[subType] || subType;
}

// 翻譯類別 - Translate Category
function translateCategory(category) {
    const map = {
        'Hat': '帽子', 'Top': '上衣', 'Bottom': '褲裙', 'Overall': '套服',
        'Shoes': '鞋子', 'Gloves': '手套', 'Cape': '披風', 'Shield': '盾牌',
        'Weapon': '武器', 'Ring': '戒指', 'Pendant': '項鍊', 'Belt': '腰帶',
        'Medal': '勳章', 'Shoulder': '肩膀', 'Pocket': '口袋道具',
        'Badge': '徽章', 'Emblem': '紋章', 'Projectile': '投擲物',
        'Claw': '拳套', 'Bow': '弓', 'Crossbow': '弩', 'Spear': '槍',
        'Polearm': '矛', 'Gun': '火槍', 'One Handed Sword': '單手劍',
        'One Handed Axe': '單手斧', 'One Handed BW': '單手棍',
        'Two Handed SwordS': '雙手劍', 'Two Handed Axe': '雙手斧',
        'Two Handed BW': '雙手棍', 'Dagger': '短劍', 'Earring': '耳環',
        'Staff': '長杖', 'Wand': '短杖', 'Knuckle': '指虎'
    };
    return map[category] || category;
}

// 翻譯屬性名稱 - Translate Stat Name
function translateStatName(statKey) {
    const map = {
        attack_speed: '攻速', str: '力量', dex: '敏捷', int: '智力', luk: '幸運',
        hp: 'HP', mp: 'MP', watk: '物理攻擊力', matk: '魔法攻擊力',
        wdef: '物理防禦力', mdef: '魔法防禦力', accuracy: '命中率',
        avoidability: '迴避率', speed: '移動速度', jump: '跳躍力', upgrades: '可升級次數'
    };
    return map[statKey] || statKey;
}

// 翻譯捲軸類別 - Translate Scroll Category
function translateScrollCategory(category) {
    const map = {
        'Earring': '耳環', 'Hat': '帽子', 'Top': '上衣', 'Overall': '套服',
        'Bottom': '褲裙', 'Shoes': '鞋子', 'Gloves': '手套', 'Cape': '披風',
        'Shield': '盾牌', 'Weapon': '武器', 'Ring': '戒指', 'Pendant': '項鍊',
        'Belt': '腰帶', 'Medal': '勳章', 'Shoulder': '肩膀', 'Face': '臉飾',
        'Eye': '眼飾', 'Badge': '徽章', 'Emblem': '紋章', 'Android': '機器人',
        'Mechanic': '機甲', 'Bits': '零件', 'Pocket': '口袋道具',
        'Projectile': '投擲物', 'Claw': '拳套', 'Bow': '弓', 'Crossbow': '弩',
        'Spear': '槍', 'Polearm': '矛', 'Gun': '火槍', 'One Handed Sword': '單手劍',
        'One Handed Axe': '單手斧', 'One Handed BW': '單手棍',
        'Two Handed Sword': '雙手劍', 'Two Handed Axe': '雙手斧',
        'Two Handed BW': '雙手棍', 'Dagger': '短劍', 'Staff': '長杖', 'Wand': '短杖'
    };
    return map[category] || category;
}
