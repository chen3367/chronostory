// 儲存 {id: name} 的字典
const equipmentDictionary = {};
// 儲存 {id: sprite_override_url} 的字典
const spriteDictionary = {};

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
            searchEquipment(searchTerm);
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
async function searchEquipment(searchTerm) {
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

if (searchButton) {
    searchButton.addEventListener('click', async function() {
        if (!selectedItemId) {
            alert('請先選擇一個物品');
            return;
        }
        await fetchItemDetails(selectedItemId);
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
                displayItemDetails(iconUrl, itemInfo);
            }
        } else {
            console.log('無法獲取怪物掉落資訊，僅顯示物品資訊');
            displayItemDetails(iconUrl, itemInfo);
        }
    } catch (error) {
        console.error('獲取怪物掉落資訊錯誤:', error);
        displayItemDetails(iconUrl, itemInfo);
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
function displayItemDetails(iconUrl, itemInfo) {
    if (!resultDisplay) return;

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
        'Scroll': '卷軸'
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
// 儲存物品翻譯字典 {id: name}
const translateItemDictionary = {};
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

    if (mode === 'chToEn') {
        // 中翻英模式：從字典查找ID，然後呼叫API獲取英文名稱
        const itemId = getTranslateItemIdByName(text);

        if (itemId) {
            try {
                translateResultDisplay.innerHTML = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯中...</div>
                    </div>
                `;

                const apiUrl = `https://maplestory.io/api/GMS/62/item/${itemId}`;
                console.log('獲取物品英文名稱:', apiUrl);

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
    } else if (mode === 'enToCh') {
        // 英翻中模式：從字典查找ID，然後呼叫GMS/62 API獲取中文名稱
        const itemId = getTranslateItemIdByName(text);

        if (itemId) {
            try {
                translateResultDisplay.innerHTML = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯中...</div>
                    </div>
                `;

                const apiUrl = `https://maplestory.io/api/TWMS/256/item/${itemId}`;
                console.log('獲取物品中文名稱:', apiUrl);

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
    } else {
        // 不支援的模式
        translateResultDisplay.innerHTML = `
            <div class="translate-result">
                <div class="translate-original">原文: ${text}</div>
                <div class="translate-translated">翻譯結果: 不支援的翻譯模式</div>
            </div>
        `;
    }
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
    hideTranslateSuggestions();
}
