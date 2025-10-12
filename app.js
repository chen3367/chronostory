// 儲存 {id: name} 的字典
const equipmentDictionary = {};
// 儲存 {id: sprite_override_url} 的字典
const spriteDictionary = {};
// 儲存怪物 {id: name} 的字典
const mobDictionary = {};
// 儲存怪物 {id: sprite_override_url} 的字典
const mobSpriteDictionary = {};

// 獲取 DOM 元素
const searchInput = document.getElementById('searchInput');
const suggestionsDiv = document.getElementById('suggestions');

// 防抖函數，避免頻繁發送請求
let debounceTimer;
const debounceDelay = 300; // 300ms

// 只有當元素存在時才添加事件監聽器
if (searchInput) {
    // 監聽輸入事件
    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.trim();

        clearTimeout(debounceTimer);

        if (searchTerm === '') {
            hideSuggestions();
            return;
        }

        debounceTimer = setTimeout(() => {
            // 檢查是否在怪物搜尋頁面
            if (window.location.pathname.includes('mob.html')) {
                searchMob(searchTerm);
            } else {
                searchItem(searchTerm);
            }
        }, debounceDelay);
    });
}

// 點擊外部時隱藏建議框
document.addEventListener('click', function(e) {
    if (searchInput && !e.target.closest('.search-wrapper')) {
        hideSuggestions();
    }
});

// 搜尋物品函數（帶重試機制）
async function searchItem(searchTerm) {
    showLoading();

    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`搜尋嘗試 ${attempt + 1}/${maxRetries + 1}`);

            const apiUrl = `https://chronostory.onrender.com/api/unified-search`;

            // 嘗試多個代理服務
            const proxies = [
                'https://corsproxy.io/?' + encodeURIComponent(apiUrl),
                'https://api.allorigins.win/raw?url=' + encodeURIComponent(apiUrl),
                'https://cors-anywhere.herokuapp.com/' + apiUrl
            ];

            let response;
            let data;

            for (const proxyUrl of proxies) {
                try {
                    console.log('嘗試代理服務:', proxyUrl);
                    response = await fetch(proxyUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            query: searchTerm
                        })
                    });

                    if (response.ok) {
                        data = await response.json();
                        console.log('成功使用代理服務:', proxyUrl);
                        break;
                    }
                } catch (error) {
                    console.log('代理服務失敗:', proxyUrl, error);
                    continue;
                }
            }

            if (!response || !response.ok) {
                throw new Error('所有代理服務都無法使用');
            }

            // 只需要處理 response.items
            if (data.items) {
                updateDictionaryAndShowSuggestions(data.items);
            } else {
                updateDictionaryAndShowSuggestions([]);
            }

            console.log(`搜尋成功完成於嘗試 ${attempt + 1}`);
            return; // 成功則退出函數

        } catch (error) {
            lastError = error;
            console.error(`搜尋嘗試 ${attempt + 1} 失敗:`, error);

            // 如果不是最後一次嘗試，等待一段時間後重試
            if (attempt < maxRetries) {
                const delay = (attempt + 1) * 1000; // 遞增延遲：1秒，2秒
                console.log(`等待 ${delay}ms 後進行第 ${attempt + 2} 次嘗試`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // 所有重試都失敗了
    console.error('搜尋最終失敗，經過所有重試:', lastError);
    showError('搜尋時發生錯誤，請稍後再試');
}

// 更新字典並顯示建議
function updateDictionaryAndShowSuggestions(items) {
    if (!suggestionsDiv) return;

    suggestionsDiv.innerHTML = '';

    if (!items || items.length === 0) {
        showNoResults();
        return;
    }

    items.forEach(item => {
        // 使用新的響應格式：item_id 和 item_name
        if (item.item_id && item.item_name) {
            equipmentDictionary[item.item_id] = item.item_name;

            // 如果存在 sprite_override.url，將其儲存在字典中
            if (item.sprite_override && item.sprite_override.url) {
                let spriteUrl = item.sprite_override.url;

                // 如果 URL 不以 http 開頭，補全為完整 URL
                if (!spriteUrl.startsWith('http')) {
                    spriteUrl = 'https://chronostory.onrender.com' + spriteUrl;
                }

                spriteDictionary[item.item_id] = spriteUrl;
                console.log(`儲存 sprite_override.url 對於項目 ${item.item_id}:`, spriteUrl);
            }

            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = item.item_name;
            suggestionItem.dataset.id = item.item_id;

            suggestionItem.addEventListener('click', function() {
                if (searchInput) {
                    searchInput.value = item.item_name;
                }
                hideSuggestions();
                console.log(`選擇的物品 - ID: ${item.item_id}, Name: ${item.item_name}`);
            });

            suggestionsDiv.appendChild(suggestionItem);
        }
    });

    showSuggestions();
    console.log('當前物品字典:', equipmentDictionary);
    console.log('當前 sprite 字典:', spriteDictionary);
}

// 更新怪物字典並顯示建議
function updateMobDictionaryAndShowSuggestions(mobs) {
    if (!suggestionsDiv) return;
    console.log(mobs)
    suggestionsDiv.innerHTML = '';

    if (!mobs || mobs.length === 0) {
        showNoResults();
        return;
    }

    mobs.forEach(mob => {
        // 使用新的響應格式：mob_id 和 mob_name
        if (mob.mob_id && mob.mob_name) {
            mobDictionary[mob.mob_id] = mob.mob_name;

            // 如果存在 sprite_override.url，將其儲存在字典中
            if (mob.sprite_override && mob.sprite_override.url) {
                let spriteUrl = mob.sprite_override.url;

                // 如果 URL 不以 http 開頭，補全為完整 URL
                if (!spriteUrl.startsWith('http')) {
                    spriteUrl = 'https://chronostory.onrender.com' + spriteUrl;
                }

                mobSpriteDictionary[mob.mob_id] = spriteUrl;
                console.log(`儲存 sprite_override.url 對於怪物 ${mob.mob_id}:`, spriteUrl);
            }

            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = mob.mob_name;
            suggestionItem.dataset.id = mob.mob_id;

            suggestionItem.addEventListener('click', function() {
                if (searchInput) {
                    searchInput.value = mob.mob_name;
                }
                hideSuggestions();
                console.log(`選擇的怪物 - ID: ${mob.mob_id}, Name: ${mob.mob_name}`);
            });

            suggestionsDiv.appendChild(suggestionItem);
        }
    });

    showSuggestions();
    console.log('當前怪物字典:', mobDictionary);
    console.log('當前怪物 sprite 字典:', mobSpriteDictionary);
}

// 顯示載入中
function showLoading() {
    suggestionsDiv.innerHTML = '<div class="loading">搜尋中...</div>';
    showSuggestions();
}

// 顯示無結果
function showNoResults() {
    suggestionsDiv.innerHTML = '<div class="no-results">找不到相關物品</div>';
    showSuggestions();
}

// 顯示錯誤訊息
function showError(message) {
    suggestionsDiv.innerHTML = `<div class="no-results">${message}</div>`;
    showSuggestions();
}

// 顯示建議框
function showSuggestions() {
    suggestionsDiv.classList.add('show');
}

// 隱藏建議框
function hideSuggestions() {
    suggestionsDiv.classList.remove('show');
}

// ===== 供外部使用的輔助函數 =====
function getEquipmentDictionary() {
    return equipmentDictionary;
}
function getEquipmentNameById(id) {
    return equipmentDictionary[id] || null;
}
function getEquipmentIdByName(name) {
    for (const [id, itemName] of Object.entries(equipmentDictionary)) {
        if (itemName === name) {
            return id;
        }
    }
    return null;
}

// ===== 物品詳細資訊搜尋功能 =====
const searchButton = document.getElementById('searchButton');
const resultDisplay = document.getElementById('resultDisplay');
let selectedItemId = null;

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('suggestion-item')) {
        selectedItemId = e.target.dataset.id;
        if (searchButton) {
            searchButton.disabled = false;
        }
    }
});

// 搜尋怪物函數（帶重試機制）
async function searchMob(searchTerm)  {
    showLoading();

    const maxRetries = 2;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`搜尋嘗試 ${attempt + 1}/${maxRetries + 1}`);

            const apiUrl = `https://chronostory.onrender.com/api/unified-search`;

            // 嘗試多個代理服務
            const proxies = [
                'https://corsproxy.io/?' + encodeURIComponent(apiUrl),
                'https://api.allorigins.win/raw?url=' + encodeURIComponent(apiUrl),
                'https://cors-anywhere.herokuapp.com/' + apiUrl
            ];

            let response;
            let data;

            for (const proxyUrl of proxies) {
                try {
                    console.log('嘗試代理服務:', proxyUrl);
                    response = await fetch(proxyUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            query: searchTerm
                        })
                    });

                    if (response.ok) {
                        data = await response.json();
                        console.log('成功使用代理服務:', proxyUrl);
                        break;
                    }
                } catch (error) {
                    console.log('代理服務失敗:', proxyUrl, error);
                    continue;
                }
            }

            if (!response || !response.ok) {
                throw new Error('所有代理服務都無法使用');
            }

            // 只需要處理 response.mobs
            if (data.mobs) {
                updateMobDictionaryAndShowSuggestions(data.mobs);
            } else {
                updateMobDictionaryAndShowSuggestions([]);
            }

            console.log(`搜尋成功完成於嘗試 ${attempt + 1}`);
            return; // 成功則退出函數

        } catch (error) {
            lastError = error;
            console.error(`搜尋嘗試 ${attempt + 1} 失敗:`, error);

            // 如果不是最後一次嘗試，等待一段時間後重試
            if (attempt < maxRetries) {
                const delay = (attempt + 1) * 1000; // 遞增延遲：1秒，2秒
                console.log(`等待 ${delay}ms 後進行第 ${attempt + 2} 次嘗試`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // 所有重試都失敗了
    console.error('搜尋最終失敗，經過所有重試:', lastError);
    showError('搜尋時發生錯誤，請稍後再試');
}

if (searchButton) {
    searchButton.addEventListener('click', async function() {
        if (!selectedItemId) {
            alert('請先選擇一個物品');
            return;
        }
        // 檢查是否在怪物搜尋頁面
        if (window.location.pathname.includes('mob.html')) {
            await fetchMobDetails(selectedItemId);
        } else {
            await fetchItemDetails(selectedItemId);
        }
    });
}

// 獲取物品詳細資訊
async function fetchItemDetails(itemId) {
    if (!resultDisplay) return;

    resultDisplay.classList.remove('empty');
    resultDisplay.innerHTML = '<div class="loading-message">載入中...</div>';

    try {
        // 獲取物品資訊
        const infoUrl = `https://chronostory.onrender.com/api/item-info?itemId=${itemId}`;
        const infoProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(infoUrl);
        const infoResponse = await fetch(infoProxyUrl);

        if (!infoResponse.ok) {
            throw new Error('無法獲取物品資訊');
        }

        const itemInfo = await infoResponse.json();

        // 嘗試獲取圖標：優先使用 sprite_override.url，如果沒有則嘗試其他來源
        let iconUrl;

        // 檢查是否有儲存的 sprite_override.url
        if (spriteDictionary[itemId]) {
            // 直接使用儲存的 sprite_override.url
            iconUrl = spriteDictionary[itemId];
            console.log('使用儲存的 sprite_override.url:', iconUrl);
        } else {
            console.log('沒有儲存的 sprite_override.url，嘗試其他圖標來源');

            // 第一個圖標來源
            const iconUrlApi = `https://maplestory.io/api/GMS/62/item/${itemId}/icon`;
            const iconResponse = await fetch(iconUrlApi);

            if (iconResponse.ok) {
                // 第一個圖標來源成功
                const iconBlob = await iconResponse.blob();
                iconUrl = URL.createObjectURL(iconBlob);
                console.log('成功獲取圖標來自:', iconUrlApi);
            } else {
                console.log('第一個圖標來源失敗，嘗試備用來源，狀態碼:', iconResponse.status);
                // 第一個圖標來源失敗，使用備用圖標
                const fallbackIconUrl = `https://chronostory.onrender.com/sprites/${itemId}.png`;
                const fallbackIconProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(fallbackIconUrl);

                try {
                    const fallbackResponse = await fetch(fallbackIconProxyUrl);
                    if (fallbackResponse.ok) {
                        const iconBlob = await fallbackResponse.blob();
                        iconUrl = URL.createObjectURL(iconBlob);
                        console.log('成功獲取備用圖標來自:', fallbackIconUrl);
                    } else {
                        console.error('備用圖標來源失敗，狀態碼:', fallbackResponse.status);
                        // 如果都失敗，使用預設圖標
                        iconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjMyIiB5PSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOTk5Ij5ObyBJY29uPC90ZXh0Pgo8L3N2Zz4K';
                    }
                } catch (error) {
                    console.error('獲取備用圖標時發生錯誤:', error);
                    // 使用預設圖標
                    iconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjMyIiB5PSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOTk5Ij5ObyBJY29uPC90ZXh0Pgo8L3N2Zz4K';
                }
            }
        }

        // 獲取怪物掉落資訊
        await fetchMobDropInfo(itemId, iconUrl, itemInfo);

    } catch (error) {
        console.error('獲取物品詳細資訊錯誤:', error);
        resultDisplay.innerHTML = '<div class="error-message">獲取物品資訊時發生錯誤，請稍後再試</div>';
    }
}

// 獲取怪物詳細資訊
async function fetchMobDetails(mobId) {
    if (!resultDisplay) return;

    resultDisplay.classList.remove('empty');
    resultDisplay.innerHTML = '<div class="loading-message">載入中...</div>';

    try {
        // 獲取怪物資訊
        const infoUrl = `https://chronostory.onrender.com/api/mob-info?mobId=${mobId}`;
        const infoProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(infoUrl);
        const infoResponse = await fetch(infoProxyUrl);

        if (!infoResponse.ok) {
            throw new Error('無法獲取怪物資訊');
        }

        const mobInfo = await infoResponse.json();
        console.log('成功獲取怪物資訊:', mobInfo);

        // 嘗試獲取圖標：優先使用 sprite_override.url，如果沒有則嘗試其他來源
        let iconUrl;

        // 檢查是否有儲存的 sprite_override.url
        if (mobSpriteDictionary[mobId]) {
            // 直接使用儲存的 sprite_override.url
            iconUrl = mobSpriteDictionary[mobId];
            console.log('使用儲存的怪物 sprite_override.url:', iconUrl);
        } else {
            console.log('沒有儲存的怪物 sprite_override.url，嘗試其他圖標來源');

            // 第一個圖標來源
            const iconUrlApi = `https://maplestory.io/api/GMS/62/mob/${mobId}/render/stand`;
            const iconResponse = await fetch(iconUrlApi);

            if (iconResponse.ok) {
                // 第一個圖標來源成功
                const iconBlob = await iconResponse.blob();
                iconUrl = URL.createObjectURL(iconBlob);
                console.log('成功獲取怪物圖標來自:', iconUrlApi);
            } else {
                console.log('第一個怪物圖標來源失敗，嘗試備用來源，狀態碼:', iconResponse.status);
                // 第一個圖標來源失敗，使用預設圖標
                iconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjMyIiB5PSI0MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOTk5Ij5ObyBJY29uPC90ZXh0Pgo8L3N2Zz4K';
            }
        }

        // 獲取怪物掉落資訊並顯示怪物詳細資訊
        await fetchMobDropData(mobId, iconUrl, mobInfo);

    } catch (error) {
        console.error('獲取怪物詳細資訊錯誤:', error);
        resultDisplay.innerHTML = '<div class="error-message">獲取怪物資訊時發生錯誤，請稍後再試</div>';
    }
}

// 獲取怪物掉落資訊（用於物品）
async function fetchMobDropInfo(itemId, iconUrl, itemInfo) {
    try {
        const mobSearchUrl = `https://chronostory.onrender.com/api/mob-search?itemId=${itemId}`;
        const mobProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(mobSearchUrl);
        const mobResponse = await fetch(mobProxyUrl);

        if (mobResponse.ok) {
            const mobData = await mobResponse.json();
            console.log('成功獲取怪物掉落資訊:', mobData);

            // 檢查物品類型和子類型來決定使用哪個顯示函數
            if (itemInfo.type === 'Eqp') {
                displayEqpDetailsWithDrops(iconUrl, itemInfo, mobData);
            } else if (itemInfo.sub_type === 'Scroll') {
                displayScrollDetailsWithDrops(iconUrl, itemInfo, mobData);
            } else if (itemInfo.sub_type === 'Potion') {
                displayPotionDetailsWithDrops(iconUrl, itemInfo, mobData);
            } else {
                displayItemDetails(iconUrl, itemInfo, mobData);
            }
        } else {
            console.log('無法獲取怪物掉落資訊，僅顯示物品資訊');
            // 呼叫各個函數時傳入空的mobData陣列，讓函數自行處理
            if (itemInfo.type === 'Eqp') {
                displayEqpDetailsWithDrops(iconUrl, itemInfo, []);
            } else if (itemInfo.sub_type === 'Scroll') {
                displayScrollDetailsWithDrops(iconUrl, itemInfo, []);
            } else if (itemInfo.sub_type === 'Potion') {
                displayPotionDetailsWithDrops(iconUrl, itemInfo, []);
            } else {
                displayItemDetails(iconUrl, itemInfo, []);
            }
        }
    } catch (error) {
        console.error('獲取怪物掉落資訊錯誤:', error);
        // 呼叫各個函數時傳入空的mobData陣列，讓函數自行處理
        if (itemInfo.type === 'Eqp') {
            displayEqpDetailsWithDrops(iconUrl, itemInfo, []);
        } else if (itemInfo.sub_type === 'Scroll') {
            displayScrollDetailsWithDrops(iconUrl, itemInfo, []);
        } else if (itemInfo.sub_type === 'Potion') {
            displayPotionDetailsWithDrops(iconUrl, itemInfo, []);
        } else {
            displayItemDetails(iconUrl, itemInfo, []);
        }
    }
}

// 獲取怪物掉落資訊（用於怪物）
async function fetchMobDropData(mobId, iconUrl, mobInfo) {
    try {
        const dropSearchUrl = `https://chronostory.onrender.com/api/mob-drops?mobId=${mobId}`;
        const dropProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(dropSearchUrl);
        const dropResponse = await fetch(dropProxyUrl);

        if (dropResponse.ok) {
            const dropData = await dropResponse.json();
            console.log('成功獲取怪物掉落物品資訊:', dropData);

            // 顯示怪物詳細資訊（包含掉落物品）
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

// 顯示怪物詳細資訊（包含掉落物品）
function displayMobDetailsWithDrops(iconUrl, mobInfo, dropData) {
    if (!resultDisplay) return;

    const mob = mobInfo.mob;

    let html = `
        <div class="item-header">
            <img src="${iconUrl}" alt="${mob.mob_name}" class="item-icon" />
            <div class="item-title">
                <h2>${mob.mob_name}</h2>
                ${mobInfo.description ? `<div class="item-description">${mobInfo.description.replace(/\\n/g, '<br>')}</div>` : ''}
            </div>
        </div>
        <div class="class-info">
    `;

    // 屬性弱點標籤顯示
    if (mob) {
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

        html += `<div class="class-tags">${weaknessTags}</div>`;
    }

    html += `</div><div class="item-info">`;

    html += `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">怪物ID:</span><span class="info-value">${mob.mob_id}</span></div>
            <div class="info-row"><span class="info-label">等級:</span><span class="info-value">${mob.level}</span></div>
            <div class="info-row"><span class="info-label">最大HP:</span><span class="info-value">${mob.max_hp.toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">經驗值:</span><span class="info-value">${mob.exp.toLocaleString()}</span></div>
        </div>
    `;

    // 顯示怪物屬性
    if (mob.phys_def !== undefined || mob.mag_def !== undefined || mob.acc !== undefined || mob.avoid !== undefined) {
        html += `
            <div class="info-section">
                <h3>戰鬥屬性</h3>
                ${mob.phys_def !== undefined ? `<div class="info-row"><span class="info-label">物理防禦:</span><span class="info-value">${mob.phys_def}</span></div>` : ''}
                ${mob.mag_def !== undefined ? `<div class="info-row"><span class="info-label">魔法防禦:</span><span class="info-value">${mob.mag_def}</span></div>` : ''}
                ${mob.acc !== undefined ? `<div class="info-row"><span class="info-label">命中率:</span><span class="info-value">${mob.acc}</span></div>` : ''}
                ${mob.avoid !== undefined ? `<div class="info-row"><span class="info-label">迴避率:</span><span class="info-value">${mob.avoid}</span></div>` : ''}
            </div>
        `;
    }

    // 顯示怪物掉落物品
    if (dropData && dropData.length > 0) {
        let dropsHtml = '';

        dropData.forEach(item => {
            // 嘗試獲取物品圖標
            let itemIconUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjRjVGNUY1Ii8+Cjx0ZXh0IHg9IjE2IiB5PSIyMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjgiIGZpbGw9IiM5OTkiPk5vPC90ZXh0Pgo8L3N2Zz4K';

            // 檢查是否有sprite_override
            if (item.sprite_override && item.sprite_override.url) {
                let spriteUrl = item.sprite_override.url;
                if (!spriteUrl.startsWith('http')) {
                    spriteUrl = 'https://chronostory.onrender.com' + spriteUrl;
                }
                itemIconUrl = spriteUrl;
            } else {
                // 使用預設圖標，之後可以改為同步獲取
                itemIconUrl = `https://maplestory.io/api/GMS/62/item/${item.item_id}/icon`;
            }

            dropsHtml += `
                <div class="mob-drop-item">
                    <img src="${itemIconUrl}" alt="${item.item_name}" class="mob-image" />
                    <div class="mob-info">
                        <div class="mob-name">${item.item_name}</div>
                        <div class="mob-chance">掉落率: ${item.chance}%</div>
                    </div>
                </div>
            `;
        });

        if (dropsHtml !== '') {
            html += `
                <div class="info-section">
                    <h3>掉落物品</h3>
                    <div class="mob-drops">${dropsHtml}</div>
                </div>
            `;
        }
    }

    resultDisplay.innerHTML = html;
}

// 獲取怪物掉落資訊
async function fetchMobDropInfo(itemId, iconUrl, itemInfo) {
    try {
        const mobSearchUrl = `https://chronostory.onrender.com/api/mob-search?itemId=${itemId}`;
        const mobProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(mobSearchUrl);
        const mobResponse = await fetch(mobProxyUrl);

        if (mobResponse.ok) {
            const mobData = await mobResponse.json();
            console.log('成功獲取怪物掉落資訊:', mobData);

            // 檢查物品類型和子類型來決定使用哪個顯示函數
            if (itemInfo.type === 'Eqp') {
                displayEqpDetailsWithDrops(iconUrl, itemInfo, mobData);
            } else if (itemInfo.sub_type === 'Scroll') {
                displayScrollDetailsWithDrops(iconUrl, itemInfo, mobData);
            } else if (itemInfo.sub_type === 'Potion') {
                displayPotionDetailsWithDrops(iconUrl, itemInfo, mobData);
            } else {
                displayItemDetails(iconUrl, itemInfo, mobData);
            }
        } else {
            console.log('無法獲取怪物掉落資訊，僅顯示物品資訊');
            // 呼叫各個函數時傳入空的mobData陣列，讓函數自行處理
            if (itemInfo.type === 'Eqp') {
                displayEqpDetailsWithDrops(iconUrl, itemInfo, []);
            } else if (itemInfo.sub_type === 'Scroll') {
                displayScrollDetailsWithDrops(iconUrl, itemInfo, []);
            } else if (itemInfo.sub_type === 'Potion') {
                displayPotionDetailsWithDrops(iconUrl, itemInfo, []);
            } else {
                displayItemDetails(iconUrl, itemInfo, []);
            }
        }
    } catch (error) {
        console.error('獲取怪物掉落資訊錯誤:', error);
        // 呼叫各個函數時傳入空的mobData陣列，讓函數自行處理
        if (itemInfo.type === 'Eqp') {
            displayEqpDetailsWithDrops(iconUrl, itemInfo, []);
        } else if (itemInfo.sub_type === 'Scroll') {
            displayScrollDetailsWithDrops(iconUrl, itemInfo, []);
        } else if (itemInfo.sub_type === 'Potion') {
            displayPotionDetailsWithDrops(iconUrl, itemInfo, []);
        } else {
            displayItemDetails(iconUrl, itemInfo, []);
        }
    }
}

// 顯示物品詳細資訊（包含怪物掉落資訊）
function displayEqpDetailsWithDrops(iconUrl, itemInfo, mobData) {
    const equipment = itemInfo.equipment;

    let html = `
        <div class="item-header">
            <img src="${iconUrl}" alt="${itemInfo.item_name}" class="item-icon" />
            <div class="item-title">
                <h2>${itemInfo.item_name}</h2>
                <div class="item-type">${translateType(itemInfo.type)} - ${translateSubType(itemInfo.sub_type)}</div>
            </div>
        </div>
        <div class="class-info">
    `;

    // 職業標籤顯示 - 顯示所有職業，不顯示標題
    if (equipment.classes) {
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

        html += `<div class="class-tags">${classTags}</div>`;
    }

    html += `</div><div class="item-info">`;

    html += `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">物品ID:</span><span class="info-value">${itemInfo.item_id}</span></div>
            <div class="info-row"><span class="info-label">類別:</span><span class="info-value">${translateCategory(equipment.category)}</span></div>
            <div class="info-row"><span class="info-label">販賣價格:</span><span class="info-value">${itemInfo.sale_price.toLocaleString()} 楓幣</span></div>
            ${itemInfo.untradeable ? '<div class="info-row"><span class="info-label">不可交易</span></div>' : ''}
        </div>
    `;

    if (equipment.requirements) {
        html += `
            <div class="info-section">
                <h3>需求條件</h3>
                ${equipment.requirements.req_level ? `<div class="info-row"><span class="info-label">等級:</span><span class="info-value">${equipment.requirements.req_level}</span></div>` : ''}
                ${equipment.requirements.req_str ? `<div class="info-row"><span class="info-label">力量:</span><span class="info-value">${equipment.requirements.req_str}</span></div>` : ''}
                ${equipment.requirements.req_dex ? `<div class="info-row"><span class="info-label">敏捷:</span><span class="info-value">${equipment.requirements.req_dex}</span></div>` : ''}
                ${equipment.requirements.req_int ? `<div class="info-row"><span class="info-label">智力:</span><span class="info-value">${equipment.requirements.req_int}</span></div>` : ''}
                ${equipment.requirements.req_luk ? `<div class="info-row"><span class="info-label">幸運:</span><span class="info-value">${equipment.requirements.req_luk}</span></div>` : ''}
            </div>
        `;
    }

    if (equipment.stats && typeof equipment.stats === 'object') {
        const stats = equipment.stats;
        let statsHtml = '';

        for (const [key, val] of Object.entries(stats)) {
            // 避免 val 為 null、undefined 或非數值（例如 0 也要顯示）
            if (val != null) {
                // 格式化數值為 3 位寬度
                const formattedVal = val.toString().padStart(3, ' ');
                let statDisplay = `<span class="info-value positive stat-value">${formattedVal}</span>`;

                // 如果存在對應的屬性變化，將其附加在屬性值前面
                if (equipment.stat_variation) {
                    const variation = equipment.stat_variation;

                    // 嘗試匹配屬性變化（支援不同的鍵名格式）
                    let minVal = null;
                    let maxVal = null;

                    // 直接檢查是否有對應的變化值
                    if (variation[key] && typeof variation[key] === 'object') {
                        minVal = variation[key].min;
                        maxVal = variation[key].max;
                    }

                    // 如果有變化範圍，將其附加在屬性值前面並靠右對齊
                    if (minVal !== null && maxVal !== null) {
                        statDisplay = `<span class="info-value neutral variation-range">(${minVal}~${maxVal})</span> ` + statDisplay;
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

        if (statsHtml !== '') {
            html += `
                <div class="info-section">
                    <h3>基礎屬性</h3>
                    ${statsHtml}
                </div>
            `;
        }
    }

    // 顯示怪物掉落資訊
    if (mobData && mobData.length > 0) {
        let dropsHtml = '';

        mobData.forEach(mob => {
            // 優先檢查sprite_override.url
            let mobImageUrl;
            if (mob.sprite_override && mob.sprite_override.url) {
                let spriteUrl = mob.sprite_override.url;
                if (!spriteUrl.startsWith('http')) {
                    spriteUrl = 'https://chronostory.onrender.com' + spriteUrl;
                }
                mobImageUrl = spriteUrl;
            } else {
                mobImageUrl = `https://maplestory.io/api/gms/83/mob/${mob.mob_id}/render/stand`;
            }

            dropsHtml += `
                <div class="mob-drop-item">
                    <img src="${mobImageUrl}" alt="${mob.mob_name}" class="mob-image" />
                    <div class="mob-info">
                        <div class="mob-name">${mob.mob_name}</div>
                        <div class="mob-chance">掉落率: ${(mob.chance).toFixed(2)}%</div>
                    </div>
                </div>
            `;
        });

        if (dropsHtml !== '') {
            html += `
                <div class="info-section">
                    <h3>怪物掉落</h3>
                    <div class="mob-drops">${dropsHtml}</div>
                </div>
            `;
        }
    }

    resultDisplay.innerHTML = html;
}

// 顯示卷軸詳細資訊（包含怪物掉落資訊）
function displayScrollDetailsWithDrops(iconUrl, itemInfo, mobData) {
    let html = `
        <div class="item-header">
            <img src="${iconUrl}" alt="${itemInfo.item_name}" class="item-icon" />
            <div class="item-title">
                <h2>${itemInfo.item_name}</h2>
                <div class="item-type">${translateType(itemInfo.type)} - ${translateSubType(itemInfo.sub_type)}</div>
            </div>
        </div>
        <div class="item-info">
    `;

    html += `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">物品ID:</span><span class="info-value">${itemInfo.item_id}</span></div>
            <div class="info-row"><span class="info-label">販賣價格:</span><span class="info-value">${itemInfo.sale_price.toLocaleString()} 楓幣</span></div>
            ${itemInfo.untradeable ? '<div class="info-row"><span class="info-label">不可交易</span></div>' : ''}
        </div>
    `;

    // 如果有卷軸特定屬性，顯示它們
    if (itemInfo.scroll) {
        html += `
            <div class="info-section">
                <h3>卷軸屬性</h3>
        `;

        if (itemInfo.scroll.category) {
            html += `<div class="info-row"><span class="info-label">適用裝備:</span><span class="info-value">${translateScrollCategory(itemInfo.scroll.category)}</span></div>`;
        }
        if (itemInfo.scroll.success_rate) {
            html += `<div class="info-row"><span class="info-label">成功率:</span><span class="info-value">${itemInfo.scroll.success_rate}%</span></div>`;
        }
        if (itemInfo.scroll.destroy_rate) {
            html += `<div class="info-row"><span class="info-label">破壞率:</span><span class="info-value">${itemInfo.scroll.destroy_rate}%</span></div>`;
        }

        html += `</div>`;

        // 顯示捲軸統計屬性
        if (itemInfo.scroll.stats && typeof itemInfo.scroll.stats === 'object') {
            const stats = itemInfo.scroll.stats;
            let statsHtml = '';

            for (const [key, val] of Object.entries(stats)) {
                // 只顯示非 null 的值
                if (val != null) {
                    // 格式化數值為 3 位寬度
                    const formattedVal = val.toString().padStart(3, ' ');
                    statsHtml += `
                        <div class="info-row">
                            <span class="info-label">${translateStatName(key)}:</span>
                            <span class="info-value positive stat-value">${formattedVal}</span>
                        </div>
                    `;
                }
            }

            if (statsHtml !== '') {
                html += `
                    <div class="info-section">
                        <h3>卷軸效果</h3>
                        ${statsHtml}
                    </div>
                `;
            }
        }
    }

    // 顯示怪物掉落資訊
    if (mobData && mobData.length > 0) {
        let dropsHtml = '';

        mobData.forEach(mob => {
            const mobImageUrl = `https://maplestory.io/api/gms/83/mob/${mob.mob_id}/render/stand`;
            dropsHtml += `
                <div class="mob-drop-item">
                    <img src="${mobImageUrl}" alt="${mob.mob_name}" class="mob-image" />
                    <div class="mob-info">
                        <div class="mob-name">${mob.mob_name}</div>
                        <div class="mob-chance">掉落率: ${(mob.chance).toFixed(2)}%</div>
                    </div>
                </div>
            `;
        });

        if (dropsHtml !== '') {
            html += `
                <div class="info-section">
                    <h3>怪物掉落</h3>
                    <div class="mob-drops">${dropsHtml}</div>
                </div>
            `;
        }
    }

    resultDisplay.innerHTML = html;
}

// 顯示藥水詳細資訊（包含怪物掉落資訊）
function displayPotionDetailsWithDrops(iconUrl, itemInfo, mobData) {
    let html = `
        <div class="item-header">
            <img src="${iconUrl}" alt="${itemInfo.item_name}" class="item-icon" />
            <div class="item-title">
                <h2>${itemInfo.item_name}</h2>
                <div class="item-type">${translateType(itemInfo.type)} - ${translateSubType(itemInfo.sub_type)}</div>
            </div>
        </div>
        <div class="item-info">
    `;

    html += `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">物品ID:</span><span class="info-value">${itemInfo.item_id}</span></div>
            <div class="info-row"><span class="info-label">販賣價格:</span><span class="info-value">${itemInfo.sale_price.toLocaleString()} 楓幣</span></div>
            ${itemInfo.untradeable ? '<div class="info-row"><span class="info-label">不可交易</span></div>' : ''}
        </div>
    `;

    // 藥水效果
    if (itemInfo.potion) {
        html += `
            <div class="info-section">
                <h3>藥水效果</h3>
        `;

        if (itemInfo.potion.duration) {
            html += `<div class="info-row"><span class="info-label">持續時間:</span><span class="info-value positive stat-value">${itemInfo.potion.duration}</span></div>`;
        }
        if (itemInfo.potion.cooldown) {
            html += `<div class="info-row"><span class="info-label">冷卻時間:</span><span class="info-value positive stat-value">${itemInfo.potion.cooldown}</span></div>`;
        }

        // 顯示藥水效果屬性
        if (itemInfo.potion.stats && typeof itemInfo.potion.stats === 'object') {
            const stats = itemInfo.potion.stats;

            for (const [key, val] of Object.entries(stats)) {
                // 只顯示非 null 的值
                if (val != null) {
                    // 檢查是否為百分比相關屬性（val為1或浮點數）
                    let displayVal;
                    if ((val === 1 || (typeof val === 'number' && val % 1 !== 0)) && (key === 'hp' || key === 'mp')) {
                        // 轉換為百分比顯示格式
                        if (typeof val === 'number' && val % 1 !== 0) {
                            displayVal = `${Math.round(val * 100)}%`;
                        } else {
                            // val為1的情況，顯示為100%
                            displayVal = '100%';
                        }
                    } else {
                        displayVal = val
                    }

                    html += `
                        <div class="info-row">
                            <span class="info-label">${translateStatName(key)}:</span>
                            <span class="info-value positive stat-value">${displayVal}</span>
                        </div>
                    `;
                }
            }

        html += `</div>`;
        }
    }

    // 顯示怪物掉落資訊
    if (mobData && mobData.length > 0) {
        let dropsHtml = '';

        mobData.forEach(mob => {
            const mobImageUrl = `https://maplestory.io/api/gms/83/mob/${mob.mob_id}/render/stand`;
            dropsHtml += `
                <div class="mob-drop-item">
                    <img src="${mobImageUrl}" alt="${mob.mob_name}" class="mob-image" />
                    <div class="mob-info">
                        <div class="mob-name">${mob.mob_name}</div>
                        <div class="mob-chance">掉落率: ${(mob.chance).toFixed(2)}%</div>
                    </div>
                </div>
            `;
        });

        if (dropsHtml !== '') {
            html += `
                <div class="info-section">
                    <h3>怪物掉落</h3>
                    <div class="mob-drops">${dropsHtml}</div>
                </div>
            `;
        }
    }

    resultDisplay.innerHTML = html;
}

// 顯示物品詳細資訊
function displayItemDetails(iconUrl, itemInfo, mobData) {
    if (!resultDisplay) return;

    let html = `
        <div class="item-header">
            <img src="${iconUrl}" alt="${itemInfo.item_name}" class="item-icon" />
            <div class="item-title">
                <h2>${itemInfo.item_name}</h2>
                ${itemInfo.item_description ? `<div class="item-description">${itemInfo.item_description.replace(/\\n/g, '<br>')}</div>` : ''}
            </div>
        </div>
        <div class="item-info">
    `;

    html += `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">物品ID:</span><span class="info-value">${itemInfo.item_id}</span></div>
            <div class="info-row"><span class="info-label">販賣價格:</span><span class="info-value">${itemInfo.sale_price.toLocaleString()} 楓幣</span></div>
            ${itemInfo.untradeable ? '<div class="info-row"><span class="info-label">不可交易</span></div>' : ''}
        </div>
    `;

    // 顯示怪物掉落資訊
    if (mobData && mobData.length > 0) {
        let dropsHtml = '';

        mobData.forEach(mob => {
            const mobImageUrl = `https://maplestory.io/api/gms/83/mob/${mob.mob_id}/render/stand`;
            dropsHtml += `
                <div class="mob-drop-item">
                    <img src="${mobImageUrl}" alt="${mob.mob_name}" class="mob-image" />
                    <div class="mob-info">
                        <div class="mob-name">${mob.mob_name}</div>
                        <div class="mob-chance">掉落率: ${(mob.chance).toFixed(2)}%</div>
                    </div>
                </div>
            `;
        });

        if (dropsHtml !== '') {
            html += `
                <div class="info-section">
                    <h3>怪物掉落</h3>
                    <div class="mob-drops">${dropsHtml}</div>
                </div>
            `;
        }
    }

    resultDisplay.innerHTML = html;
}

// 顯示怪物詳細資訊
function displayMobDetails(iconUrl, mobInfo) {
    if (!resultDisplay) return;

    const mob = mobInfo.mob;

    let html = `
        <div class="item-header">
            <img src="${iconUrl}" alt="${mob.mob_name}" class="item-icon" />
            <div class="item-title">
                <h2>${mob.mob_name}</h2>
                ${mobInfo.description ? `<div class="item-description">${mobInfo.description.replace(/\\n/g, '<br>')}</div>` : ''}
            </div>
        </div>
        <div class="class-info">
    `;

    // 屬性弱點標籤顯示
    if (mob) {
        const allWeakness = [
            { key: 'fire_weakness', name: '火', active: mob.fire_weakness },
            { key: 'ice_weakness', name: '冰', active: mob.ice_weakness },
            { key: 'lightning_weakness', name: '雷', active: mob.lightning_weakness },
            { key: 'holy_weakness', name: '聖', active: mob.holy_weakness },
            { key: 'poison_weakness', name: '毒', active: mob.poison_weakness }
        ];

        const weaknessTags = allWeakness.map(cls =>
            `<span class="class-tag ${cls.active ? 'active' : 'inactive'}">${cls.name}</span>`
        ).join('');

        html += `<div class="class-tags">${weaknessTags}</div>`;
    }

    html += `</div><div class="item-info">`;

    html += `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row"><span class="info-label">怪物ID:</span><span class="info-value">${mob.mob_id}</span></div>
            <div class="info-row"><span class="info-label">等級:</span><span class="info-value">${mob.level}</span></div>
            <div class="info-row"><span class="info-label">最大HP:</span><span class="info-value">${mob.max_hp.toLocaleString()}</span></div>
            <div class="info-row"><span class="info-label">經驗值:</span><span class="info-value">${mob.exp.toLocaleString()}</span></div>
        </div>
    `;

    // 顯示怪物屬性
    if (mob.phys_def !== undefined || mob.mag_def !== undefined || mob.acc !== undefined || mob.avoid !== undefined) {
        html += `
            <div class="info-section">
                <h3>戰鬥屬性</h3>
                ${mob.phys_def !== undefined ? `<div class="info-row"><span class="info-label">物理防禦:</span><span class="info-value">${mob.phys_def}</span></div>` : ''}
                ${mob.mag_def !== undefined ? `<div class="info-row"><span class="info-label">魔法防禦:</span><span class="info-value">${mob.mag_def}</span></div>` : ''}
                ${mob.acc !== undefined ? `<div class="info-row"><span class="info-label">命中率:</span><span class="info-value">${mob.acc}</span></div>` : ''}
                ${mob.avoid !== undefined ? `<div class="info-row"><span class="info-label">迴避率:</span><span class="info-value">${mob.avoid}</span></div>` : ''}
            </div>
        `;
    }

    // 顯示特殊狀態
    if (mob.immune_to_poison_status) {
        html += `
            <div class="info-section">
                <h3>特殊狀態</h3>
                <div class="info-row"><span class="info-label">中毒免疫:</span><span class="info-value">是</span></div>
            </div>
        `;
    }

    resultDisplay.innerHTML = html;
}

// 翻譯類型
function translateType(type) {
    const map = { 'Eqp': '裝備', 'Use': '消耗', 'Setup': '裝飾', 'Etc': '其他', 'Cash': '現金', 'Consume': '消耗' };
    return map[type] || type;
}

// 翻譯子類型
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

// 翻譯類別
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
        'Staff': '長杖', 'Wand': '短杖'
    };
    return map[category] || category;
}

// 翻譯屬性名稱
function translateStatName(statKey) {
    const map = {
        attack_speed: '攻速', str: '力量', dex: '敏捷', int: '智力', luk: '幸運',
        hp: 'HP', mp: 'MP', watk: '物理攻擊力', matk: '魔法攻擊力',
        wdef: '物理防禦力', mdef: '魔法防禦力', accuracy: '命中率',
        avoidability: '迴避率', speed: '移動速度', jump: '跳躍力', upgrades: '可升級次數'
    };
    return map[statKey] || statKey;
}

// 翻譯捲軸類別
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

// 中英翻譯選單切換功能
function toggleTranslateMenu() {
    const translateMenu = document.getElementById('translate-menu');
    if (translateMenu) {
        if (translateMenu.style.display === 'none' || translateMenu.style.display === '') {
            translateMenu.style.display = 'block';
        } else {
            translateMenu.style.display = 'none';
        }
    }
}

// ===== 物品翻譯功能 =====
// 儲存物品翻譯字典 {name: [id1, id2, ...]} - 支援相同名稱的多個ID
const translateItemDictionary = {};
// 儲存當前選擇的物品ID（解決多個相同名稱的問題）
let selectedTranslateItemId = null;
// 儲存物品翻譯建議相關元素
let translateInput, translateSuggestions, translateButton, translateResultDisplay;

let currentTranslateMode = 'chToEn'; // 預設為中翻英

// 翻譯模式切換和初始化
document.addEventListener('DOMContentLoaded', function() {
    // 檢查是否在翻譯頁面
    translateInput = document.getElementById('translateInput');
    translateButton = document.getElementById('translateButton');
    translateResultDisplay = document.getElementById('translateResultDisplay');
    translateSuggestions = document.getElementById('translateSuggestions');

    if (translateInput && translateButton) {
        // 模式切換按鈕事件監聽
        const chToEnBtn = document.getElementById('chToEnBtn');
        const enToChBtn = document.getElementById('enToChBtn');

        if (chToEnBtn) {
            chToEnBtn.addEventListener('click', function() {
                currentTranslateMode = 'chToEn';
                chToEnBtn.classList.add('active');
                enToChBtn.classList.remove('active');
                updateTranslatePlaceholder();
                clearTranslateInput();
            });
        }

        if (enToChBtn) {
            enToChBtn.addEventListener('click', function() {
                currentTranslateMode = 'enToCh';
                enToChBtn.classList.add('active');
                chToEnBtn.classList.remove('active');
                updateTranslatePlaceholder();
                clearTranslateInput();
            });
        }

        // 翻譯輸入框事件監聽 - 添加自動建議功能
        translateInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.trim();

            clearTimeout(translateInput.debounceTimer);

            if (searchTerm === '') {
                hideTranslateSuggestions();
                return;
            }

            translateInput.debounceTimer = setTimeout(() => {
                searchTranslateItems(searchTerm);
            }, 300); // 300ms 防抖
        });

        // 點擊外部時隱藏翻譯建議框
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-wrapper') && e.target.id !== 'translateInput') {
                hideTranslateSuggestions();
            }
        });

        // 翻譯按鈕事件監聽
        translateButton.addEventListener('click', function() {
            const inputText = translateInput.value.trim();
            if (inputText) {
                performTranslation(inputText, currentTranslateMode);
            } else {
                alert('請輸入要翻譯的文字');
            }
        });
    }
});

// 搜尋翻譯物品（支援中翻英和英翻中模式）
async function searchTranslateItems(searchTerm) {
    showTranslateLoading();

    try {
        let apiUrl;

        if (currentTranslateMode === 'chToEn') {
            // 中翻英模式：使用TWMS API
            apiUrl = `https://maplestory.io/api/TWMS/256/item?&searchFor=${encodeURIComponent(searchTerm)}`;
        } else if (currentTranslateMode === 'enToCh') {
            // 英翻中模式：使用GMS/83 API
            apiUrl = `https://maplestory.io/api/GMS/83/item?&searchFor=${encodeURIComponent(searchTerm)}`;
        } else {
            return; // 不支援的模式
        }

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

// 更新翻譯字典並顯示建議
function updateTranslateDictionaryAndShowSuggestions(items) {
    if (!translateSuggestions) return;

    translateSuggestions.innerHTML = '';

    if (!items || items.length === 0) {
        showTranslateNoResults();
        return;
    }

    items.forEach(item => {
        if (item.id && item.name) {
            translateItemDictionary[item.id] = item.name;

            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = `${item.name} (${item.id})`;
            suggestionItem.dataset.id = item.id;

            suggestionItem.addEventListener('click', function() {
                translateInput.value = item.name;
                selectedTranslateItemId = item.id; // 儲存選擇的物品ID
                hideTranslateSuggestions();
                console.log(`選擇的翻譯物品 - ID: ${item.id}, Name: ${item.name}`);
            });

            translateSuggestions.appendChild(suggestionItem);
        }
    });

    showTranslateSuggestions();
    console.log('當前翻譯物品字典:', translateItemDictionary);
}

// 顯示翻譯載入中
function showTranslateLoading() {
    if (translateSuggestions) {
        translateSuggestions.innerHTML = '<div class="loading">搜尋中...</div>';
        showTranslateSuggestions();
    }
}

// 顯示翻譯無結果
function showTranslateNoResults() {
    if (translateSuggestions) {
        translateSuggestions.innerHTML = '<div class="no-results">找不到相關物品</div>';
        showTranslateSuggestions();
    }
}

// 顯示翻譯錯誤訊息
function showTranslateError(message) {
    if (translateSuggestions) {
        translateSuggestions.innerHTML = `<div class="no-results">${message}</div>`;
        showTranslateSuggestions();
    }
}

// 顯示翻譯建議框
function showTranslateSuggestions() {
    if (translateSuggestions) {
        translateSuggestions.classList.add('show');
    }
}

// 隱藏翻譯建議框
function hideTranslateSuggestions() {
    if (translateSuggestions) {
        translateSuggestions.classList.remove('show');
    }
}

// 執行翻譯功能
async function performTranslation(text, mode) {
    if (!translateResultDisplay) return;

    translateResultDisplay.classList.remove('empty');

    // 使用選中的物品ID，如果沒有選中的則嘗試從名稱查找
    let itemId = selectedTranslateItemId;

    // 如果沒有選中的ID，嘗試從名稱查找（備用邏輯）
    if (!itemId) {
        itemId = getTranslateItemIdByName(text);
    }

    if (itemId) {
        try {
            translateResultDisplay.innerHTML = `
                <div class="translate-result">
                    <div class="translate-original">原文: ${text}</div>
                    <div class="translate-translated">翻譯中...</div>
                </div>
            `;

            let apiUrl;
            if (mode === 'chToEn') {
                // 中翻英模式：使用GMS API獲取英文名稱
                apiUrl = `https://maplestory.io/api/GMS/62/item/${itemId}`;
                console.log('獲取物品英文名稱:', apiUrl);
            } else if (mode === 'enToCh') {
                // 英翻中模式：使用TWMS API獲取中文名稱
                apiUrl = `https://maplestory.io/api/TWMS/256/item/${itemId}`;
                console.log('獲取物品中文名稱:', apiUrl);
            } else {
                translateResultDisplay.innerHTML = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯結果: 不支援的翻譯模式</div>
                    </div>
                `;
                return;
            }

            const response = await fetch(apiUrl);

            if (response.ok) {
                const data = await response.json();
                translateResultDisplay.innerHTML = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯結果: ${data.description.name}</div>
                    </div>
                `;
                console.log('翻譯成功:', data.name);
            } else {
                translateResultDisplay.innerHTML = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯結果: ID: ${itemId} 不存在</div>
                    </div>
                `;
                console.log('翻譯失敗: ID不存在');
            }
        } catch (error) {
            console.error('翻譯錯誤:', error);
            translateResultDisplay.innerHTML = `
                <div class="translate-result">
                    <div class="translate-original">原文: ${text}</div>
                    <div class="translate-translated">翻譯結果: 翻譯時發生錯誤</div>
                </div>
            `;
        }
    } else {
        translateResultDisplay.innerHTML = `
            <div class="translate-result">
                <div class="translate-original">原文: ${text}</div>
                <div class="translate-translated">翻譯結果: 找不到對應的物品ID</div>
            </div>
        `;
    }

    // 清空選中的ID，準備下次選擇
    selectedTranslateItemId = null;
}

// 根據名稱獲取翻譯物品ID
function getTranslateItemIdByName(name) {
    for (const [id, itemName] of Object.entries(translateItemDictionary)) {
        if (itemName === name) {
            return id;
        }
    }
    return null;
}

// 更新翻譯輸入框的placeholder文字
function updateTranslatePlaceholder() {
    if (translateInput) {
        if (currentTranslateMode === 'chToEn') {
            translateInput.placeholder = '請輸入中文進行翻譯...';
        } else {
            translateInput.placeholder = '請輸入英文進行翻譯...';
        }
    }
}

// 清除翻譯輸入框和結果顯示
function clearTranslateInput() {
    if (translateInput) {
        translateInput.value = '';
    }
    if (translateResultDisplay) {
        translateResultDisplay.classList.add('empty');
        translateResultDisplay.innerHTML = '';
    }
    // 清空選中的物品ID
    selectedTranslateItemId = null;
    hideTranslateSuggestions();
}
