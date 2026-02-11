document.addEventListener("DOMContentLoaded", async () => {
    const weaponTitle = document.getElementById("weapon-title");
    const weaponsContainer = document.getElementById("weapons-container");
    const loadingDiv = document.getElementById("loading");

    // URL에서 무기 카테고리 ID 추출
    const pathParts = window.location.pathname.split('/');
    const weaponId = pathParts[pathParts.length - 1];

    if (!weaponId) {
        loadingDiv.textContent = "잘못된 무기 ID입니다.";
        return;
    }

    // 마인크래프트 색코드 매핑
    const mcColors = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };

    function parseMinecraftColors(text) {
        if (!text) return '';
        let result = '';
        let currentColor = '#FFFFFF';
        let i = 0;
        while (i < text.length) {
            if (text[i] === '&' && i + 1 < text.length) {
                const colorCode = text[i + 1].toLowerCase();
                if (mcColors[colorCode]) {
                    currentColor = mcColors[colorCode];
                    i += 2;
                    continue;
                }
            }
            if (text[i] === '\\' && i + 1 < text.length && text[i + 1] === 'n') {
                result += '<br>';
                i += 2;
                continue;
            }
            if (text[i] === '\n') {
                result += '<br>';
                i++;
                continue;
            }
            result += `<span style="color: ${currentColor}">${escapeHtml(text[i])}</span>`;
            i++;
        }
        return result;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 이미지 확장자 순차 시도
    function loadWeaponImage(img, weaponId, itemId) {
        const extensions = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
        let extIndex = 0;

        function tryNext() {
            if (extIndex >= extensions.length) {
                img.style.display = 'none';
                return;
            }
            img.src = `/Resource/weapon/${weaponId}/${itemId}.${extensions[extIndex]}`;
            extIndex++;
        }

        img.onerror = tryNext;
        tryNext();
    }

    try {
        const response = await fetch(`/api/weapon-info?id=${encodeURIComponent(weaponId)}`);
        if (!response.ok) {
            throw new Error('무기 정보를 가져오는 데 실패했습니다.');
        }

        const data = await response.json();
        loadingDiv.style.display = 'none';
        const urlParams = new URLSearchParams(window.location.search);
        weaponTitle.textContent = urlParams.get('name') || weaponId;

        if (!data.weapons || data.weapons.length === 0) {
            loadingDiv.style.display = '';
            loadingDiv.textContent = "무기 정보를 찾을 수 없습니다.";
            return;
        }

        data.weapons.forEach(weapon => {
            const card = document.createElement('div');
            card.classList.add('weapon-card');

            const imgContainer = document.createElement('div');
            imgContainer.classList.add('weapon-img-container');
            const img = document.createElement('img');
            img.classList.add('weapon-img');
            img.alt = weapon.name || weapon.id;
            loadWeaponImage(img, weaponId, weapon.id);
            imgContainer.appendChild(img);

            const infoContainer = document.createElement('div');
            infoContainer.classList.add('weapon-info');

            const name = document.createElement('h2');
            name.classList.add('weapon-name');
            name.textContent = weapon.name || weapon.id;

            const desc = document.createElement('div');
            desc.classList.add('weapon-description');
            desc.innerHTML = parseMinecraftColors(weapon.description || '');

            infoContainer.appendChild(name);
            infoContainer.appendChild(desc);

            card.appendChild(imgContainer);
            card.appendChild(infoContainer);
            weaponsContainer.appendChild(card);
        });

    } catch (error) {
        console.error("무기 정보 로딩 오류:", error);
        loadingDiv.textContent = "무기 정보를 불러올 수 없습니다.";
    }
});
