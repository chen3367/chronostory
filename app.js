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

// 點擊外部時隱藏建議框
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-wrapper')) {
        hideSuggestions();
    }
});

// 搜尋裝備函數（帶重試機制）
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
                spriteDictionary[item.item_id] = item.sprite_override.url;
                console.log(`儲存 sprite_override.url 對於項目 ${item.item_id}:`, item.sprite_override.url);
            }

            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = item.item_name;
            suggestionItem.dataset.id = item.item_id;

            suggestionItem.addEventListener('click', function() {
                searchInput.value = item.item_name;
                hideSuggestions();
                console.log(`選擇的裝備 - ID: ${item.item_id}, Name: ${item.item_name}`);
            });

            suggestionsDiv.appendChild(suggestionItem);
        }
    });

    showSuggestions();
    console.log('當前裝備字典:', equipmentDictionary);
    console.log('當前 sprite 字典:', spriteDictionary);
}

// 顯示載入中
function showLoading() {
    suggestionsDiv.innerHTML = '<div class="loading">搜尋中...</div>';
    showSuggestions();
}

// 顯示無結果
function showNoResults() {
    suggestionsDiv.innerHTML = '<div class="no-results">找不到相關裝備</div>';
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

// ===== 裝備詳細資訊搜尋功能 =====
const searchButton = document.getElementById('searchButton');
const resultDisplay = document.getElementById('resultDisplay');
let selectedItemId = null;

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('suggestion-item')) {
        selectedItemId = e.target.dataset.id;
        searchButton.disabled = false;
    }
});

searchButton.addEventListener('click', async function() {
    if (!selectedItemId) {
        alert('請先選擇一個裝備');
        return;
    }
    await fetchItemDetails(selectedItemId);
});

// 獲取裝備詳細資訊
async function fetchItemDetails(itemId) {
    resultDisplay.classList.remove('empty');
    resultDisplay.innerHTML = '<div class="loading-message">載入中...</div>';

    try {
        // 獲取裝備資訊
        const infoUrl = `https://chronostory.onrender.com/api/item-info?itemId=${itemId}`;
        const infoProxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(infoUrl);
        const infoResponse = await fetch(infoProxyUrl);

        if (!infoResponse.ok) {
            throw new Error('無法獲取裝備資訊');
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

        displayItemDetails(iconUrl, itemInfo);

    } catch (error) {
        console.error('獲取裝備詳細資訊錯誤:', error);
        resultDisplay.innerHTML = '<div class="error-message">獲取裝備資訊時發生錯誤，請稍後再試</div>';
    }
}

// 顯示裝備詳細資訊
function displayItemDetails(iconUrl, itemInfo) {
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
    const map = { 'Eqp': '裝備', 'Use': '消耗', 'Setup': '裝飾', 'Etc': '其他', 'Cash': '現金' };
    return map[type] || type;
}

// 翻譯子類型
function translateSubType(subType) {
    const map = {
        'Cap': '帽子', 'Coat': '上衣', 'Pants': '褲裙', 'Shoes': '鞋子', 'Glove': '手套',
        'Cape': '披風', 'Shield': '盾牌', 'Weapon': '武器', 'Ring': '戒指', 'Pendant': '項鍊',
        'Belt': '腰帶', 'Medal': '勳章', 'Shoulder': '肩膀', 'Pocket': '口袋道具',
        'Badge': '徽章', 'Emblem': '紋章', 'Android': '機器人', 'Mechanic': '機甲',
        'Bits': '零件', 'Face': '臉飾', 'Eye': '眼飾', 'Earring': '耳環', 'Projectile': '投擲物'
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
