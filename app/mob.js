// ===== 怪物查詢功能 =====
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
            // 檢查頁面類型並呼叫對應的搜尋功能
            if (window.location.pathname.includes('mob.html')) {
                if (typeof searchMob === 'function') {
                    searchMob(searchTerm);
                }
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

// 更新怪物字典並顯示建議
function updateMobDictionaryAndShowSuggestions(mobs) {
    if (!suggestionsDiv) return;
    console.log(mobs)
    suggestionsDiv.innerHTML = '';

    if (!mobs || mobs.length === 0) {
        // 在怪物相關頁面顯示"找不到相關怪物"
        if (window.location.pathname.includes('mob.html')) {
            showMobNoResults();
        }
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

// 顯示怪物無結果
function showMobNoResults() {
    suggestionsDiv.innerHTML = '<div class="no-results">找不到相關怪物</div>';
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
function getMobDictionary() {
    return mobDictionary;
}
function getMobNameById(id) {
    return mobDictionary[id] || null;
}
function getMobIdByName(name) {
    for (const [id, mobName] of Object.entries(mobDictionary)) {
        if (mobName === name) {
            return id;
        }
    }
    return null;
}

// ===== 怪物詳細資訊搜尋功能 =====
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
            const apiUrl = `https://chronostory.onrender.com/api/unified-search`;

            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(apiUrl);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: searchTerm
                })
            });

            if (!response.ok) {
                throw new Error(`請求失敗: ${response.status}`);
            }

            const data = await response.json();

            if (!response || !response.ok || (response.status >= 400 && response.status < 500)) {
                throw new Error(`請求失敗: ${response ? response.status : '無回應'}`);
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
            alert('請先選擇一個怪物');
            return;
        }
        // 檢查是否在怪物搜尋頁面
        if (window.location.pathname.includes('mob.html')) {
            await fetchMobDetails(selectedItemId);
        }
    });
}

// 獲取怪物詳細資訊
async function fetchMobDetails(mobId) {
    if (!resultDisplay) return;

    resultDisplay.classList.remove('empty');
    resultDisplay.innerHTML = '<div class="loading-message">載入中...</div>';

    try {
        // 獲取怪物資訊
        const infoUrl = `https://chronostory.onrender.com/api/mob-info?mobId=${mobId}`;
        const infoProxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(infoUrl);
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

// 獲取怪物掉落資訊（用於怪物）
async function fetchMobDropData(mobId, iconUrl, mobInfo) {
    try {
        const dropSearchUrl = `https://chronostory.onrender.com/api/mob-drops?mobId=${mobId}`;
        const dropProxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(dropSearchUrl);
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
