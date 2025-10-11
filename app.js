// 儲存 {id: name} 的字典
const equipmentDictionary = {};

// 獲取 DOM 元素
const searchInput = document.getElementById('searchInput');
const suggestionsDiv = document.getElementById('suggestions');

// 防抖函數，避免頻繁發送請求
let debounceTimer;
const debounceDelay = 300; // 300ms

// 監聽輸入事件
searchInput.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim();
    
    // 清除之前的計時器
    clearTimeout(debounceTimer);
    
    // 如果輸入為空，隱藏建議框
    if (searchTerm === '') {
        hideSuggestions();
        return;
    }
    
    // 設置新的計時器
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

// 搜尋裝備函數
async function searchEquipment(searchTerm) {
    // 顯示載入中狀態
    showLoading();
    
    try {
        const url = `https://maplestory.io/api/GMS/62/item?searchFor=${encodeURIComponent(searchTerm)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('網路請求失敗');
        }
        
        const data = await response.json();
        
        // 更新字典並顯示建議
        updateDictionaryAndShowSuggestions(data);
        
    } catch (error) {
        console.error('搜尋錯誤:', error);
        showError('搜尋時發生錯誤，請稍後再試');
    }
}

// 更新字典並顯示建議
function updateDictionaryAndShowSuggestions(items) {
    // 清空建議框
    suggestionsDiv.innerHTML = '';
    
    // 如果沒有結果
    if (!items || items.length === 0) {
        showNoResults();
        return;
    }
    
    // 遍歷結果並更新字典
    items.forEach(item => {
        if (item.id && item.name) {
            // 更新字典
            equipmentDictionary[item.id] = item.name;
            
            // 創建建議項目
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = item.name;
            suggestionItem.dataset.id = item.id;
            
            // 點擊建議項目時的處理
            suggestionItem.addEventListener('click', function() {
                searchInput.value = item.name;
                hideSuggestions();
                console.log(`選擇的裝備 - ID: ${item.id}, Name: ${item.name}`);
            });
            
            suggestionsDiv.appendChild(suggestionItem);
        }
    });
    
    // 顯示建議框
    showSuggestions();
    
    // 輸出當前字典狀態（用於調試）
    console.log('當前裝備字典:', equipmentDictionary);
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

// 獲取字典的函數（供外部使用）
function getEquipmentDictionary() {
    return equipmentDictionary;
}

// 根據 ID 獲取名稱
function getEquipmentNameById(id) {
    return equipmentDictionary[id] || null;
}

// 根據名稱獲取 ID
function getEquipmentIdByName(name) {
    for (const [id, itemName] of Object.entries(equipmentDictionary)) {
        if (itemName === name) {
            return id;
        }
    }
    return null;
}

// ===== 裝備詳細資訊搜尋功能 =====

// 獲取按鈕和結果顯示區
const searchButton = document.getElementById('searchButton');
const resultDisplay = document.getElementById('resultDisplay');

// 當前選中的裝備ID
let selectedItemId = null;

// 監聽選擇建議項目
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('suggestion-item')) {
        selectedItemId = e.target.dataset.id;
        searchButton.disabled = false;
    }
});

// 監聽搜尋按鈕點擊
searchButton.addEventListener('click', async function() {
    if (!selectedItemId) {
        alert('請先選擇一個裝備');
        return;
    }
    
    await fetchItemDetails(selectedItemId);
});

// 獲取裝備詳細資訊
async function fetchItemDetails(itemId) {
    // 顯示載入中
    resultDisplay.classList.remove('empty');
    resultDisplay.innerHTML = '<div class="loading-message">載入中...</div>';
    
    try {
        // 同時發送兩個請求
        const [iconResponse, infoResponse] = await Promise.all([
            fetch(`https://maplestory.io/api/GMS/62/item/${itemId}/icon`),
            fetch(`https://chronostory.onrender.com/api/item-info?itemId=${itemId}`)
        ]);
        
        if (!iconResponse.ok || !infoResponse.ok) {
            throw new Error('無法獲取裝備資訊');
        }
        
        // 獲取圖片和資料
        const iconBlob = await iconResponse.blob();
        const iconUrl = URL.createObjectURL(iconBlob);
        const itemInfo = await infoResponse.json();
        
        // 顯示結果
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
        <div class="item-info">
    `;
    
    // 基本資訊
    html += `
        <div class="info-section">
            <h3>基本資訊</h3>
            <div class="info-row">
                <span class="info-label">物品ID:</span>
                <span class="info-value">${itemInfo.item_id}</span>
            </div>
            <div class="info-row">
                <span class="info-label">類別:</span>
                <span class="info-value">${translateCategory(equipment.category)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">販賣價格:</span>
                <span class="info-value">${itemInfo.sale_price.toLocaleString()} 楓幣</span>
            </div>
            ${itemInfo.untradeable ? '<div class="info-row"><span class="info-label">不可交易</span></div>' : ''}
        </div>
    `;
    
    // 需求條件
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
    
    // 職業限制
    if (equipment.classes) {
        const allowedClasses = [];
        if (equipment.classes.warrior) allowedClasses.push('戰士');
        if (equipment.classes.magician) allowedClasses.push('法師');
        if (equipment.classes.bowman) allowedClasses.push('弓箭手');
        if (equipment.classes.thief) allowedClasses.push('盜賊');
        if (equipment.classes.pirate) allowedClasses.push('海盜');
        if (equipment.classes.beginner) allowedClasses.push('初心者');
        
        if (allowedClasses.length > 0) {
            html += `
                <div class="info-section">
                    <h3>職業限制</h3>
                    <div class="info-row">
                        <span class="info-value">${allowedClasses.join(', ')}</span>
                    </div>
                </div>
            `;
        }
    }
    
    // 基礎屬性
    if (equipment.stats) {
        html += `
            <div class="info-section">
                <h3>基礎屬性</h3>
        `;
        
        const stats = equipment.stats;
        if (stats.str) html += `<div class="info-row"><span class="info-label">力量:</span><span class="info-value positive">+${stats.str}</span></div>`;
        if (stats.dex) html += `<div class="info-row"><span class="info-label">敏捷:</span><span class="info-value positive">+${stats.dex}</span></div>`;
        if (stats.int) html += `<div class="info-row"><span class="info-label">智力:</span><span class="info-value positive">+${stats.int}</span></div>`;
        if (stats.luk) html += `<div class="info-row"><span class="info-label">幸運:</span><span class="info-value positive">+${stats.luk}</span></div>`;
        if (stats.hp) html += `<div class="info-row"><span class="info-label">HP:</span><span class="info-value positive">+${stats.hp}</span></div>`;
        if (stats.mp) html += `<div class="info-row"><span class="info-label">MP:</span><span class="info-value positive">+${stats.mp}</span></div>`;
        if (stats.watk) html += `<div class="info-row"><span class="info-label">物理攻擊力:</span><span class="info-value positive">+${stats.watk}</span></div>`;
        if (stats.matk) html += `<div class="info-row"><span class="info-label">魔法攻擊力:</span><span class="info-value positive">+${stats.matk}</span></div>`;
        if (stats.wdef) html += `<div class="info-row"><span class="info-label">物理防禦力:</span><span class="info-value positive">+${stats.wdef}</span></div>`;
        if (stats.mdef) html += `<div class="info-row"><span class="info-label">魔法防禦力:</span><span class="info-value positive">+${stats.mdef}</span></div>`;
        if (stats.accuracy) html += `<div class="info-row"><span class="info-label">命中率:</span><span class="info-value positive">+${stats.accuracy}</span></div>`;
        if (stats.avoidability) html += `<div class="info-row"><span class="info-label">迴避率:</span><span class="info-value positive">+${stats.avoidability}</span></div>`;
        if (stats.speed) html += `<div class="info-row"><span class="info-label">移動速度:</span><span class="info-value positive">+${stats.speed}</span></div>`;
        if (stats.jump) html += `<div class="info-row"><span class="info-label">跳躍力:</span><span class="info-value positive">+${stats.jump}</span></div>`;
        if (stats.upgrades) html += `<div class="info-row"><span class="info-label">可升級次數:</span><span class="info-value">${stats.upgrades}</span></div>`;
        
        html += `</div>`;
    }
    
    // 屬性變化範圍
    if (equipment.stat_variation) {
        html += `
            <div class="info-section">
                <h3>潛在屬性範圍</h3>
        `;
        
        const variation = equipment.stat_variation;
        if (variation.str) html += `<div class="info-row"><span class="info-label">力量:</span><span class="info-value">${variation.str.min} ~ ${variation.str.max}</span></div>`;
        if (variation.dex) html += `<div class="info-row"><span class="info-label">敏捷:</span><span class="info-value">${variation.dex.min} ~ ${variation.dex.max}</span></div>`;
        if (variation.int) html += `<div class="info-row"><span class="info-label">智力:</span><span class="info-value">${variation.int.min} ~ ${variation.int.max}</span></div>`;
        if (variation.luk) html += `<div class="info-row"><span class="info-label">幸運:</span><span class="info-value">${variation.luk.min} ~ ${variation.luk.max}</span></div>`;
        if (variation.hp) html += `<div class="info-row"><span class="info-label">HP:</span><span class="info-value">${variation.hp.min} ~ ${variation.hp.max}</span></div>`;
        if (variation.mp) html += `<div class="info-row"><span class="info-label">MP:</span><span class="info-value">${variation.mp.min} ~ ${variation.mp.max}</span></div>`;
        if (variation.watk) html += `<div class="info-row"><span class="info-label">物理攻擊力:</span><span class="info-value">${variation.watk.min} ~ ${variation.watk.max}</span></div>`;
        if (variation.matk) html += `<div class="info-row"><span class="info-label">魔法攻擊力:</span><span class="info-value">${variation.matk.min} ~ ${variation.matk.max}</span></div>`;
        if (variation.wdef) html += `<div class="info-row"><span class="info-label">物理防禦力:</span><span class="info-value">${variation.wdef.min} ~ ${variation.wdef.max}</span></div>`;
        if (variation.mdef) html += `<div class="info-row"><span class="info-label">魔法防禦力:</span><span class="info-value">${variation.mdef.min} ~ ${variation.mdef.max}</span></div>`;
        if (variation.accuracy) html += `<div class="info-row"><span class="info-label">命中率:</span><span class="info-value">${variation.accuracy.min} ~ ${variation.accuracy.max}</span></div>`;
        if (variation.avoidability) html += `<div class="info-row"><span class="info-label">迴避率:</span><span class="info-value">${variation.avoidability.min} ~ ${variation.avoidability.max}</span></div>`;
        if (variation.speed) html += `<div class="info-row"><span class="info-label">移動速度:</span><span class="info-value">${variation.speed.min} ~ ${variation.speed.max}</span></div>`;
        if (variation.jump) html += `<div class="info-row"><span class="info-label">跳躍力:</span><span class="info-value">${variation.jump.min} ~ ${variation.jump.max}</span></div>`;
        
        html += `</div>`;
    }
    
    html += `</div>`; // 結束 item-info
    
    resultDisplay.innerHTML = html;
}

// 翻譯類型
function translateType(type) {
    const typeMap = {
        'Eqp': '裝備',
        'Use': '消耗',
        'Setup': '設置',
        'Etc': '其他',
        'Cash': '商城'
    };
    return typeMap[type] || type;
}

// 翻譯子類型
function translateSubType(subType) {
    const subTypeMap = {
        'Cap': '帽子',
        'Coat': '上衣',
        'Pants': '褲子',
        'Shoes': '鞋子',
        'Glove': '手套',
        'Cape': '披風',
        'Shield': '盾牌',
        'Weapon': '武器',
        'Ring': '戒指',
        'Pendant': '項鍊',
        'Belt': '腰帶',
        'Medal': '勳章',
        'Shoulder': '肩膀裝備',
        'Pocket': '口袋道具',
        'Badge': '徽章',
        'Emblem': '紋章',
        'Android': '機器人',
        'Mechanic': '機甲',
        'Bits': '零件',
        'Face': '臉部裝飾',
        'Eye': '眼睛裝飾',
        'Earring': '耳環'
    };
    return subTypeMap[subType] || subType;
}

// 翻譯類別
function translateCategory(category) {
    const categoryMap = {
        'Hat': '帽子',
        'Top': '上衣',
        'Bottom': '褲子',
        'Overall': '套服',
        'Shoes': '鞋子',
        'Gloves': '手套',
        'Cape': '披風',
        'Shield': '盾牌',
        'Weapon': '武器',
        'Ring': '戒指',
        'Pendant': '項鍊',
        'Belt': '腰帶',
        'Medal': '勳章',
        'Shoulder': '肩膀裝備',
        'Pocket': '口袋道具',
        'Badge': '徽章',
        'Emblem': '紋章'
    };
    return categoryMap[category] || category;
}
