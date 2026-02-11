document.addEventListener("DOMContentLoaded", async () => {
    const titanPortrait = document.getElementById("titan-portrait");
    const titanNameEl = document.getElementById("titan-name");
    const skillsContainer = document.getElementById("skills-container");
    const loadingDiv = document.getElementById("loading");

    // URL에서 타이탄 이름 추출 (/titan/잭4/ion)
    const pathParts = window.location.pathname.split('/');
    const titanName = pathParts[pathParts.length - 1];

    if (!titanName) {
        loadingDiv.textContent = "잘못된 타이탄 ID입니다.";
        return;
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

    function loadImageWithFallback(img, basePath, id) {
        const extensions = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
        let extIndex = 0;
        function tryNext() {
            if (extIndex >= extensions.length) {
                img.style.display = 'none';
                return;
            }
            img.src = `${basePath}/${id}.${extensions[extIndex]}`;
            extIndex++;
        }
        img.onerror = tryNext;
        tryNext();
    }

    function createSkillCard(label, skill, weaponImgId) {
        const card = document.createElement('div');
        card.classList.add('skill-card');

        let weaponImgHtml = '';
        if (weaponImgId) {
            weaponImgHtml = `
                <div class="weapon-img-container" style="margin-top: 10px;">
                    <img class="weapon-img titan-weapon-img" alt="${skill.name}" data-weapon-id="${weaponImgId}">
                </div>
            `;
        }

        card.innerHTML = `
            <div class="skill-header">
                <span class="skill-type">${label}</span>
                <span class="skill-name">${escapeHtml(skill.name || '이름 없음')}</span>
            </div>
            <div class="skill-description">
                ${parseMinecraftColors(skill.description || '')}
            </div>
            ${weaponImgHtml}
        `;

        // 무기 이미지 로드
        if (weaponImgId) {
            const img = card.querySelector('.titan-weapon-img');
            if (img) {
                loadImageWithFallback(img, '/Resource/titan/weapon', weaponImgId);
            }
        }

        return card;
    }

    try {
        const response = await fetch(`/api/titan-info?id=${encodeURIComponent(titanName)}`);
        if (!response.ok) throw new Error('타이탄 정보를 가져오는 데 실패했습니다.');

        const data = await response.json();
        loadingDiv.style.display = 'none';

        // 아이콘
        titanPortrait.src = `/Resource/titan/${titanName}.png`;
        titanPortrait.onerror = () => { titanPortrait.style.display = 'none'; };

        // 이름 (쿼리 파라미터 또는 데이터에서)
        const urlParams = new URLSearchParams(window.location.search);
        const displayName = urlParams.get('name') || (data.description && data.description.name) || titanName;
        titanNameEl.textContent = displayName;

        // 패시브 (공용)
        if (data.passive) {
            skillsContainer.appendChild(createSkillCard('패시브', data.passive));
        }

        // 스킬 1~4
        if (data.skills) {
            data.skills.forEach((skill, i) => {
                if (skill) {
                    skillsContainer.appendChild(createSkillCard(`스킬 ${i + 1}`, skill));
                }
            });
        }

        // 기본공격 (무기)
        if (data.weapon) {
            skillsContainer.appendChild(createSkillCard('기본공격', data.weapon, data.weapon.id));
        }

    } catch (error) {
        console.error("타이탄 정보 로딩 오류:", error);
        loadingDiv.textContent = "타이탄 정보를 불러올 수 없습니다.";
    }
});
