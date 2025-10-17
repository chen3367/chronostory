// ===== 怪物翻譯功能 =====
// 儲存怪物翻譯字典 {id: name}
const mobDictionary = {};
// 儲存當前選擇的怪物ID（解決多個相同名稱的問題）
let selectedTranslateItemId = null;
// 儲存怪物翻譯建議相關元素
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
                searchTranslateMobs(searchTerm);
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
                performMobTranslation(inputText, currentTranslateMode);
            } else {
                alert('請輸入要翻譯的文字');
            }
        });
    }
});

// 搜尋翻譯怪物（支援中翻英和英翻中模式）
async function searchTranslateMobs(searchTerm) {
    showTranslateLoading();

    try {
        let apiUrl;

        if (currentTranslateMode === 'chToEn') {
            // 中翻英模式：使用TWMS API
            apiUrl = `https://maplestory.io/api/TWMS/256/mob?&searchFor=${encodeURIComponent(searchTerm)}`;
        } else if (currentTranslateMode === 'enToCh') {
            // 英翻中模式：使用GMS/83 API
            apiUrl = `https://maplestory.io/api/GMS/83/mob?&searchFor=${encodeURIComponent(searchTerm)}`;
        } else {
            return; // 不支援的模式
        }

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

// 更新翻譯怪物字典並顯示建議
function updateTranslateMobDictionaryAndShowSuggestions(mobs) {
    if (!translateSuggestions) return;

    translateSuggestions.innerHTML = '';

    if (!mobs || mobs.length === 0) {
        showTranslateNoResults();
        return;
    }

    mobs.forEach(mob => {
        if (mob.id && mob.name) {
            mobDictionary[mob.id] = mob.name;

            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'suggestion-item';
            suggestionItem.textContent = `${mob.name} (${mob.id})`;
            suggestionItem.dataset.id = mob.id;

            suggestionItem.addEventListener('click', function() {
                translateInput.value = mob.name;
                selectedTranslateItemId = mob.id; // 儲存選擇的怪物ID
                hideTranslateSuggestions();
                console.log(`選擇的翻譯怪物 - ID: ${mob.id}, Name: ${mob.name}`);
            });

            translateSuggestions.appendChild(suggestionItem);
        }
    });

    showTranslateSuggestions();
    console.log('當前翻譯怪物字典:', mobDictionary);
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
        translateSuggestions.innerHTML = '<div class="no-results">找不到相關怪物</div>';
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

// 執行怪物翻譯功能
async function performMobTranslation(text, mode) {
    if (!translateResultDisplay) return;

    translateResultDisplay.classList.remove('empty');

    // 使用選中的怪物ID，如果沒有選中的則嘗試從名稱查找
    let mobId = selectedTranslateItemId;

    // 如果沒有選中的ID，嘗試從名稱查找（備用邏輯）
    if (!mobId) {
        mobId = getTranslateMobIdByName(text);
    }

    if (mobId) {
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
                apiUrl = `https://maplestory.io/api/GMS/62/mob/${mobId}`;
                console.log('獲取怪物英文名稱:', apiUrl);
            } else if (mode === 'enToCh') {
                // 英翻中模式：使用TWMS API獲取中文名稱
                apiUrl = `https://maplestory.io/api/TWMS/256/mob/${mobId}`;
                console.log('獲取怪物中文名稱:', apiUrl);
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
                        <div class="translate-translated">翻譯結果: ${data.name}</div>
                    </div>
                `;
                console.log('翻譯成功:', data.name);
            } else {
                translateResultDisplay.innerHTML = `
                    <div class="translate-result">
                        <div class="translate-original">原文: ${text}</div>
                        <div class="translate-translated">翻譯結果: ID: ${mobId} 不存在</div>
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
                <div class="translate-translated">翻譯結果: 找不到對應的怪物ID</div>
            </div>
        `;
    }

    // 清空選中的ID，準備下次選擇
    selectedTranslateItemId = null;
}

// 根據名稱獲取翻譯怪物ID
function getTranslateMobIdByName(name) {
    for (const [id, mobName] of Object.entries(mobDictionary)) {
        if (mobName === name) {
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
    // 清空選中的怪物ID
    selectedTranslateItemId = null;
    hideTranslateSuggestions();
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
