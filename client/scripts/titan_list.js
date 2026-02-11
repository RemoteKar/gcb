document.addEventListener("DOMContentLoaded", async () => {
    const titanGrid = document.getElementById("titan-grid");
    const loadingDiv = document.getElementById("loading");
    const pageTitle = document.getElementById("titan-page-title");

    // URL에서 스킬 ID 추출 (/titan/잭4)
    const pathParts = window.location.pathname.split('/');
    const skillId = decodeURIComponent(pathParts[2] || '');

    // 쿼리 파라미터에서 스킬 이름 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const skillName = urlParams.get('name');
    if (skillName) {
        pageTitle.textContent = skillName;
    }

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

    try {
        const response = await fetch('/api/titan-list');
        if (!response.ok) throw new Error('타이탄 목록을 가져오는 데 실패했습니다.');

        const data = await response.json();
        loadingDiv.style.display = 'none';

        if (!data.titans || data.titans.length === 0) {
            loadingDiv.style.display = '';
            loadingDiv.textContent = "타이탄 정보를 찾을 수 없습니다.";
            return;
        }

        data.titans.forEach(titan => {
            const card = document.createElement('div');
            card.classList.add('titan-grid-item');

            card.innerHTML = `
                <img class="titan-grid-img" src="/Resource/titan/${titan.folderName}.png"
                     onerror="this.style.display='none'" alt="${titan.name}">
                <div class="titan-grid-info">
                    <div class="titan-grid-name">${escapeHtml(titan.name)}</div>
                    <div class="titan-grid-desc">${parseMinecraftColors(titan.description)}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                const basePath = `/titan/${encodeURIComponent(skillId)}/${titan.folderName}`;
                const name = encodeURIComponent(titan.name);
                window.location.href = `${basePath}?name=${name}`;
            });

            titanGrid.appendChild(card);
        });

    } catch (error) {
        console.error("타이탄 목록 로딩 오류:", error);
        loadingDiv.textContent = "타이탄 정보를 불러올 수 없습니다.";
    }
});
