// 中英翻譯選單切換功能 - Translation Menu Toggle Function
function toggleTranslateMenu() {
    const translateMenu = document.getElementById('translate-menu');
    if (translateMenu) {
        translateMenu.style.display = (translateMenu.style.display === 'none' || translateMenu.style.display === '')
            ? 'block'
            : 'none';
    }
}