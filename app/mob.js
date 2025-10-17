// ===== 怪物查詢功能 - Mob Query System =====

// DOM 元素引用 - DOM Element References
const searchInput = document.getElementById('searchInput');
const suggestionsDiv = document.getElementById('suggestions');
const searchButton = document.getElementById('searchButton');
const resultDisplay = document.getElementById('resultDisplay');

// 搜尋相關變數 - Search Related Variables
let selectedItemId = null;          // 當前選擇的怪物ID
let lastSearchResponse = null;       // 最後一次搜尋的API回應
let debounceTimer;                  // 防抖計時器
const debounceDelay = 300;          // 防抖延遲時間 (ms)

// 快取系統變數 - Cache System Variables
let searchCache = new Map();        // 搜尋結果快取：搜尋詞 -> 搜尋結果
let mobDetailsCache = new Map();    // 怪物詳情快取：怪物ID -> 詳情資料
let mobDropCache = new Map();       // 怪物掉落資料快取：怪物ID -> 掉落資料
let mobIconCache = new Map();       // 怪物圖標快取：怪物ID -> 圖標URL
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 快取過期時間：24小時

// ===== 初始化設定 - Initialization =====
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
    initializeEventListeners();
});

// 初始化搜尋功能 - Initialize Search Functionality
function initializeSearch() {
    if (!searchInput) return;

    console.log('初始化怪物搜尋功能 - Initializing mob search functionality');

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
        const cachedData = localStorage.getItem('mobSearchCache');
        if (cachedData) {
            const cacheData = JSON.parse(cachedData);

            // 檢查快取資料是否過期（超過24小時）
            if (Date.now() - cacheData.timestamp < CACHE_EXPIRY) {
                if (cacheData.searchCache) {
                    for (const [key, value] of Object.entries(cacheData.searchCache)) {
                        searchCache.set(key, value);
                    }
                }

                if (cacheData.mobDetailsCache) {
                    for (const [key, value] of Object.entries(cacheData.mobDetailsCache)) {
                        mobDetailsCache.set(key, value);
                    }
                }

                if (cacheData.mobDropCache) {
                    for (const [key, value] of Object.entries(cacheData.mobDropCache)) {
                        mobDropCache.set(key, value);
                    }
                }

                if (cacheData.mobIconCache) {
                    for (const [key, value] of Object.entries(cacheData.mobIconCache)) {
                        mobIconCache.set(key, value);
                    }
                }

                console.log('已從本地儲存載入快取資料');
            } else {
                console.log('本地儲存的快取資料已過期，已清除');
                localStorage.removeItem('mobSearchCache');
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
            mobDetailsCache: Object.fromEntries(mobDetailsCache),
            mobDropCache: Object.fromEntries(mobDropCache),
            mobIconCache: Object.fromEntries(mobIconCache),
            timestamp: Date.now()
        };

        localStorage.setItem('mobSearchCache', JSON.stringify(cacheData));
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
        searchMob(searchTerm);
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
    console.log(`選擇的怪物 - ID: ${e.target.dataset.id}, Name: ${e.target.textContent}`);
}

// 處理搜尋按鈕點擊 - Handle Search Button Click
async function handleSearchButtonClick() {
    if (!selectedItemId) {
        alert('請先選擇一個怪物');
        return;
    }

    await fetchMobDetails(selectedItemId);
}

// ===== 搜尋功能 - Search Functions =====

// 搜尋怪物函數（帶重試機制和快取系統） - Search Mob Function with Retry Mechanism and Cache System
async function searchMob(searchTerm) {
    showLoading();

    // 檢查快取中是否有搜尋結果
    const cachedResult = getCachedSearchResult(searchTerm);
    if (cachedResult) {
        console.log(`使用快取搜尋結果: ${searchTerm}`);
        updateMobDictionaryAndShowSuggestions(cachedResult.mobs);
        return;
    }

    console.log(`快取中未找到 "${searchTerm}"，進行API搜尋`);

    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await performMobSearch(searchTerm);

            if (response.ok) {
                const data = await response.json();

                // 將搜尋結果儲存到快取
                setCachedSearchResult(searchTerm, data);

                updateMobDictionaryAndShowSuggestions(data.mobs || []);
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

// 執行怪物搜尋 - Perform Mob Search
async function performMobSearch(searchTerm) {
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
function updateMobDictionaryAndShowSuggestions(mobs) {
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (!mobs || mobs.length === 0) {
        showMobNoResults();
        return;
    }

    // 儲存搜尋回應
    lastSearchResponse = { mobs };

    mobs.forEach(mob => {
        const suggestionItem = createSuggestionItem(mob);
        suggestionsDiv.appendChild(suggestionItem);
    });

    showSuggestions();
    console.log('搜尋結果已更新:', mobs);
}

// 創建建議項目 - Create Suggestion Item
function createSuggestionItem(mob) {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.textContent = mob.mob_name;
    suggestionItem.dataset.id = mob.mob_id;

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

// 顯示怪物無結果 - Show Mob No Results
function showMobNoResults() {
    if (suggestionsDiv) {
        suggestionsDiv.innerHTML = '<div class="no-results">找不到相關怪物</div>';
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

// ===== 怪物詳情功能 - Mob Details Functions =====

// 獲取怪物詳細資訊 - Fetch Mob Details
async function fetchMobDetails(mobId) {
    if (!resultDisplay) return;

    resultDisplay.classList.remove('empty');
    resultDisplay.innerHTML = '<div class="loading-message">載入中...</div>';

    try {
        const mobInfo = await fetchMobInfo(mobId);
        const iconUrl = await getMobIconUrl(mobId);
        await fetchMobDropData(mobId, iconUrl, mobInfo);
    } catch (error) {
        console.error('獲取怪物詳細資訊錯誤:', error);
        resultDisplay.innerHTML = '<div class="error-message">獲取怪物資訊時發生錯誤，請稍後再試</div>';
    }
}

// 獲取怪物資訊 - Fetch Mob Info
async function fetchMobInfo(mobId) {
    // 檢查快取中是否有怪物資訊
    const cachedInfo = getCachedMobInfo(mobId);
    if (cachedInfo) {
        console.log(`使用快取怪物資訊: ${mobId}`);
        return cachedInfo;
    }

    console.log(`快取中未找到怪物資訊 "${mobId}"，進行API搜尋`);

    const infoUrl = `https://chronostory.onrender.com/api/mob-info?mobId=${mobId}`;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(infoUrl);

    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error('無法獲取怪物資訊');
    }

    const mobInfo = await response.json();
    console.log('成功獲取怪物資訊:', mobInfo);

    // 將怪物資訊儲存到快取
    setCachedMobInfo(mobId, mobInfo);

    return mobInfo;
}

// 獲取怪物圖標URL - Get Mob Icon URL
async function getMobIconUrl(mobId) {
    // 檢查最後搜尋回應中是否有 sprite_override.url
    if (lastSearchResponse && lastSearchResponse.mobs) {
        const mobData = lastSearchResponse.mobs.find(mob => mob.mob_id === mobId);
        if (mobData && mobData.sprite_override && mobData.sprite_override.url) {
            const spriteUrl = mobData.sprite_override.url.startsWith('http')
                ? mobData.sprite_override.url
                : 'https://chronostory.onrender.com' + mobData.sprite_override.url;
            console.log('使用搜尋回應中的怪物 sprite_override.url:', spriteUrl);
            return spriteUrl;
        }
    }

    // 嘗試從 API 獲取圖標
    try {
        const iconUrlApi = `https://maplestory.io/api/GMS/62/mob/${mobId}/render/stand`;
        const response = await fetch(iconUrlApi);

        if (response.ok) {
            const iconBlob = await response.blob();
            const iconUrl = URL.createObjectURL(iconBlob);
            console.log('成功獲取怪物圖標來自:', iconUrlApi);
            return iconUrl;
        }
    } catch (error) {
        console.log('獲取怪物圖標失敗:', error);
    }

    // 使用預設圖標
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjMyIiB5PSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOTk5Ij5ObyBJY29uPC90ZXh0Pgo8L3N2Zz4K';
}

// 獲取怪物掉落資訊 - Fetch Mob Drop Data
async function fetchMobDropData(mobId, iconUrl, mobInfo) {
    // 檢查快取中是否有怪物掉落資訊
    const cachedDropData = getCachedMobDropData(mobId);
    if (cachedDropData) {
        console.log(`使用快取怪物掉落資訊: ${mobId}`);
        displayMobDetailsWithDrops(iconUrl, mobInfo, cachedDropData);
        return;
    }

    console.log(`快取中未找到怪物掉落資訊 "${mobId}"，進行API搜尋`);

    try {
        const dropSearchUrl = `https://chronostory.onrender.com/api/mob-drops?mobId=${mobId}`;
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(dropSearchUrl);
        const response = await fetch(proxyUrl);

        if (response.ok) {
            const dropData = await response.json();
            console.log('成功獲取怪物掉落物品資訊:', dropData);

            // 將怪物掉落資訊儲存到快取
            setCachedMobDropData(mobId, dropData);

            displayMobDetailsWithDrops(iconUrl, mobInfo, dropData);
        } else {
            console.log('無法獲取怪物掉落物品資訊，僅顯示怪物資訊');
            displayMobDetails(iconUrl, mobInfo);
        }
    } catch (error) {
        console.error('獲取怪物掉落物品資訊錯誤:', error);
        displayMobDetails(iconUrl, mobInfo);
    }
}

// ===== 顯示函數 - Display Functions =====

// 顯示怪物詳細資訊（包含掉落物品） - Display Mob Details with Drops
function displayMobDetailsWithDrops(iconUrl, mobInfo, dropData) {
    if (!resultDisplay) return;

    const mob = mobInfo.mob;
    let html = generateMobHeaderHTML(iconUrl, mob, mobInfo);
    html += generateMobWeaknessHTML(mob);
    html += generateMobBasicInfoHTML(mob);
    html += generateMobCombatStatsHTML(mob);
    html += generateMobDropsHTML(dropData);

    resultDisplay.innerHTML = html;
}

// 顯示怪物詳細資訊 - Display Mob Details
function displayMobDetails(iconUrl, mobInfo) {
    if (!resultDisplay) return;

    const mob = mobInfo.mob;
    let html = generateMobHeaderHTML(iconUrl, mob, mobInfo);
    html += generateMobWeaknessHTML(mob);
    html += generateMobBasicInfoHTML(mob);
    html += generateMobCombatStatsHTML(mob);
    html += generateMobSpecialStatusHTML(mob);

    resultDisplay.innerHTML = html;
}

// 生成怪物標頭HTML - Generate Mob Header HTML
function generateMobHeaderHTML(iconUrl, mob, mobInfo) {
    return `
        <div class="item-header">
            <img src="${iconUrl}" alt="${mob.mob_name}" class="item-icon" />
            <div class="item-title">
                <h2>${mob.mob_name}</h2>
                ${mobInfo.description ? `<div class="item-description">${mobInfo.description.replace(/\\n/g, '<br>')}</div>` : ''}
            </div>
        </div>
        <div class="class-info">
    `;
}

// 生成怪物弱點HTML - Generate Mob Weakness HTML
function generateMobWeaknessHTML(mob) {
    if (!mob) return '';

    const allWeakness = [
        { key: 'fire_weakness', name: '火', active: mob.fire_weakness === 1 },
        { key: 'ice_weakness', name: '冰', active: mob.ice_weakness === 1 },
        { key: 'lightning_weakness', name: '雷', active: mob.lightning_weakness === 1 },
        { key: 'holy_weakness', name: '聖', active: mob.holy_weakness === 1 },
        { key: 'poison_weakness', name: '毒', active: mob.poison_weakness === 1 }
    ];

    const weaknessTags = allWeakness.map(cls =>
        `<span class="class-tag ${cls.active ? 'active' : 'inactive'}">${cls.name}</span>`
    ).join('');

    return `<div class="class-tags">${weaknessTags}</div></div><div class="item-info">`;
}

// 生成怪物基本資訊HTML - Generate Mob Basic Info HTML
function generateMobBasicInfoHTML(mob) {
    return `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">怪物ID:</span><span class="info-value">${mob.mob_id}</span></div>
            <div class="info-row"><span class="info-label">等級:</span><span class="info-value">${mob.level}</span></div>
            <div class="info-row"><span class="info-label">最大HP:</span><span class="info-value">${mob.max_hp.toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">經驗值:</span><span class="info-value">${mob.exp.toLocaleString()}</span></div>
        </div>
    `;
}

// 生成怪物戰鬥屬性HTML - Generate Mob Combat Stats HTML
function generateMobCombatStatsHTML(mob) {
    const stats = [];
    if (mob.phys_def !== undefined) stats.push(`<div class="info-row"><span class="info-label">物理防禦:</span><span class="info-value">${mob.phys_def}</span></div>`);
    if (mob.mag_def !== undefined) stats.push(`<div class="info-row"><span class="info-label">魔法防禦:</span><span class="info-value">${mob.mag_def}</span></div>`);
    if (mob.acc !== undefined) stats.push(`<div class="info-row"><span class="info-label">命中率:</span><span class="info-value">${mob.acc}</span></div>`);
    if (mob.avoid !== undefined) stats.push(`<div class="info-row"><span class="info-label">迴避率:</span><span class="info-value">${mob.avoid}</span></div>`);

    return stats.length > 0 ? `
        <div class="info-section">
            <h3>戰鬥屬性</h3>
            ${stats.join('')}
        </div>
    ` : '';
}

// 生成怪物掉落物品HTML - Generate Mob Drops HTML
function generateMobDropsHTML(dropData) {
    if (!dropData || dropData.length === 0) return '';

    const dropsHtml = dropData.map(item => {
        const itemIconUrl = getItemIconUrl(item);
        return `
            <div class="mob-drop-item">
                <img src="${itemIconUrl}" alt="${item.item_name}" class="mob-image" />
                <div class="mob-info">
                    <div class="mob-name">${item.item_name}</div>
                    <div class="mob-chance">掉落率: ${item.chance}%</div>
                </div>
            </div>
        `;
    }).join('');

    const sectionClass = dropData.length > 6 ? 'info-section drops-section' : 'info-section';
    return `
        <div class="${sectionClass}">
            <h3>掉落物品</h3>
            <div class="mob-drops">${dropsHtml}</div>
        </div>
    `;
}

// 生成怪物特殊狀態HTML - Generate Mob Special Status HTML
function generateMobSpecialStatusHTML(mob) {
    if (!mob.immune_to_poison_status) return '';

    return `
        <div class="info-section">
            <h3>特殊狀態</h3>
            <div class="info-row"><span class="info-label">中毒免疫:</span><span class="info-value">是</span></div>
        </div>
    `;
}

// 獲取物品圖標URL - Get Item Icon URL
function getItemIconUrl(item) {
    // 檢查是否有sprite_override
    if (item.sprite_override && item.sprite_override.url) {
        return item.sprite_override.url.startsWith('http')
            ? item.sprite_override.url
            : 'https://chronostory.onrender.com' + item.sprite_override.url;
    }

    // 使用預設圖標
    return `https://maplestory.io/api/GMS/62/item/${item.item_id}/icon`;
}

// ===== 快取顯示函數 - Cache Display Functions =====

// 顯示快取狀態區域 - Show Cache Status
function showCacheStatus() {
    const cacheStatus = document.getElementById('cacheStatus');
    const cacheDetails = document.getElementById('cacheDetails');

    if (!cacheStatus || !cacheDetails) return;

    const stats = getCacheStats();
    const totalSize = stats.totalCacheSize;

    if (totalSize > 0) {
        cacheStatus.style.display = 'block';
        cacheDetails.textContent = `搜尋快取: ${stats.searchCache} | 詳情快取: ${stats.mobDetailsCache} | 圖標快取: ${stats.mobIconCache} | 總計: ${totalSize}`;
    } else {
        cacheStatus.style.display = 'none';
    }
}

// 顯示快取統計 - Show Cache Statistics
function showCacheStats() {
    const stats = getCacheStats();
    const cacheDetails = [
        `搜尋結果快取: ${stats.searchCache} 項`,
        `怪物詳情快取: ${stats.mobDetailsCache} 項`,
        `怪物掉落快取: ${stats.mobDropCache} 項`,
        `怪物圖標快取: ${stats.mobIconCache} 項`,
        `總計: ${stats.totalCacheSize} 項快取`
    ];

    alert(`快取統計:\n${cacheDetails.join('\n')}`);
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

    for (const [key, value] of mobDetailsCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            mobDetailsCache.delete(key);
            cleanedCount++;
        }
    }

    for (const [key, value] of mobDropCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            mobDropCache.delete(key);
            cleanedCount++;
        }
    }

    for (const [key, value] of mobIconCache.entries()) {
        if (now - value.timestamp > CACHE_EXPIRY) {
            mobIconCache.delete(key);
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
        mobDetailsCache: mobDetailsCache.size,
        mobDropCache: mobDropCache.size,
        mobIconCache: mobIconCache.size,
        totalCacheSize: searchCache.size + mobDetailsCache.size + mobDropCache.size + mobIconCache.size
    };
}

// 獲取快取中的怪物資訊 - Get Cached Mob Info
function getCachedMobInfo(mobId) {
    const cached = mobDetailsCache.get(mobId);
    if (!cached) return null;

    // 檢查快取是否過期
    if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
        mobDetailsCache.delete(mobId);
        console.log(`怪物資訊快取過期，已刪除: ${mobId}`);
        return null;
    }

    return cached.data;
}

// 設定快取怪物資訊 - Set Cached Mob Info
function setCachedMobInfo(mobId, data) {
    mobDetailsCache.set(mobId, {
        data: data,
        timestamp: Date.now()
    });
    console.log(`已快取怪物資訊: ${mobId}`);
}

// 獲取快取中的怪物掉落資料 - Get Cached Mob Drop Data
function getCachedMobDropData(mobId) {
    const cached = mobDropCache.get(mobId);
    if (!cached) return null;

    // 檢查快取是否過期
    if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
        mobDropCache.delete(mobId);
        console.log(`怪物掉落資料快取過期，已刪除: ${mobId}`);
        return null;
    }

    return cached.data;
}

// 設定快取怪物掉落資料 - Set Cached Mob Drop Data
function setCachedMobDropData(mobId, data) {
    mobDropCache.set(mobId, {
        data: data,
        timestamp: Date.now()
    });
    console.log(`已快取怪物掉落資料: ${mobId}`);
}



// 匯出快取資料（用於備份或遷移） - Export Cache Data
function exportCacheData() {
    const cacheData = {
        searchCache: Object.fromEntries(searchCache),
        mobDetailsCache: Object.fromEntries(mobDetailsCache),
        mobDropCache: Object.fromEntries(mobDropCache),
        mobIconCache: Object.fromEntries(mobIconCache),
        exportTime: Date.now()
    };

    const blob = new Blob([JSON.stringify(cacheData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mob-search-cache-${new Date().toISOString().split('T')[0]}.json`;
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

        if (cacheData.mobDetailsCache) {
            for (const [key, value] of Object.entries(cacheData.mobDetailsCache)) {
                mobDetailsCache.set(key, value);
            }
        }

        if (cacheData.mobDropCache) {
            for (const [key, value] of Object.entries(cacheData.mobDropCache)) {
                mobDropCache.set(key, value);
            }
        }

        if (cacheData.mobIconCache) {
            for (const [key, value] of Object.entries(cacheData.mobIconCache)) {
                mobIconCache.set(key, value);
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

// 根據ID從搜尋回應獲取怪物名稱 - Get Mob Name by ID from Search Response
function getMobNameById(id) {
    if (lastSearchResponse && lastSearchResponse.mobs) {
        const mob = lastSearchResponse.mobs.find(mob => mob.mob_id === id);
        return mob ? mob.mob_name : null;
    }
    return null;
}

// 根據名稱從搜尋回應獲取怪物ID - Get Mob ID by Name from Search Response
function getMobIdByName(name) {
    if (lastSearchResponse && lastSearchResponse.mobs) {
        const mob = lastSearchResponse.mobs.find(mob => mob.mob_name === name);
        return mob ? mob.mob_id : null;
    }
    return null;
}

// 獲取最後搜尋回應 - Get Last Search Response
function getLastSearchResponse() {
    return lastSearchResponse;
}

// 檢查是否有搜尋結果 - Has Search Results
function hasSearchResults() {
    return lastSearchResponse && lastSearchResponse.mobs && lastSearchResponse.mobs.length > 0;
}

// 獲取搜尋結果數量 - Get Search Results Count
function getSearchResultsCount() {
    return lastSearchResponse && lastSearchResponse.mobs ? lastSearchResponse.mobs.length : 0;
}

// 清空所有快取和狀態 - Clear All Cache and State
function clearAllCache() {
    searchCache.clear();
    mobDetailsCache.clear();
    mobDropCache.clear();
    mobIconCache.clear();
    lastSearchResponse = null;
    if (searchInput) searchInput.value = '';
    if (searchButton) searchButton.disabled = true;
    selectedItemId = null;
    hideSuggestions();
    console.log('所有快取已清空');
}

// 中英翻譯選單切換功能 - Translation Menu Toggle Function
function toggleTranslateMenu() {
    const translateMenu = document.getElementById('translate-menu');
    if (translateMenu) {
        translateMenu.style.display = (translateMenu.style.display === 'none' || translateMenu.style.display === '')
            ? 'block'
            : 'none';
    }
}
