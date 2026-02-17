// 증강 팝업 공용 모듈
// 다른 페이지에서 <script src="/scripts/augment_popup.js"></script> 로 로드 후
// showAugmentPopup(augmentId) 호출

(function () {
    let augmentDataCache = null;
    let popupEl = null;

    // 마인크래프트 색코드 매핑
    const mcColors = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };

    function parseMcColor(text) {
        if (!text) return '';
        let html = '';
        let currentColor = '#FFFFFF';
        const parts = text.split(/(&[0-9a-fA-F])/);
        for (const part of parts) {
            if (/^&[0-9a-fA-F]$/.test(part)) {
                currentColor = mcColors[part[1].toLowerCase()] || '#FFFFFF';
            } else {
                const lines = part.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    if (i > 0) html += '<br>';
                    html += `<span style="color:${currentColor}">${lines[i]}</span>`;
                }
            }
        }
        return html;
    }

    function createPopup() {
        if (popupEl) return;
        popupEl = document.createElement('div');
        popupEl.className = 'augment-popup-overlay';
        popupEl.style.display = 'none';
        popupEl.innerHTML = `
            <div class="augment-popup-card">
                <button class="augment-popup-close">&times;</button>
                <img class="augment-popup-icon" src="" alt="">
                <h2 class="augment-popup-name"></h2>
                <div class="augment-popup-desc"></div>
            </div>
        `;
        document.body.appendChild(popupEl);

        popupEl.querySelector('.augment-popup-close').addEventListener('click', () => {
            popupEl.style.display = 'none';
        });
        popupEl.addEventListener('click', (e) => {
            if (e.target === popupEl) popupEl.style.display = 'none';
        });
    }

    async function fetchAugmentData() {
        if (augmentDataCache) return augmentDataCache;
        try {
            const res = await fetch('/api/augment-list');
            if (!res.ok) throw new Error('증강 데이터 로드 실패');
            const data = await res.json();
            augmentDataCache = {};
            (data.augments || []).forEach(aug => {
                augmentDataCache[aug.id] = aug;
            });
            return augmentDataCache;
        } catch (e) {
            console.error('augment_popup fetchAugmentData error:', e);
            return {};
        }
    }

    window.showAugmentPopup = async function (augmentId) {
        createPopup();
        const augments = await fetchAugmentData();
        const aug = augments[augmentId];
        if (!aug) {
            console.warn('증강 데이터를 찾을 수 없습니다:', augmentId);
            return;
        }

        popupEl.querySelector('.augment-popup-icon').src = `/Resource/augment/icon/${augmentId}.png`;
        popupEl.querySelector('.augment-popup-name').textContent = aug.name;
        popupEl.querySelector('.augment-popup-desc').innerHTML = parseMcColor(aug.description);
        popupEl.style.display = 'flex';
    };
})();
