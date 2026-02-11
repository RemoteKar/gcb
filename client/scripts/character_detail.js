document.addEventListener("DOMContentLoaded", async () => {
    const characterPortrait = document.getElementById("character-portrait");
    const characterName = document.getElementById("character-name");
    const statsContainer = document.getElementById("stats-container");
    const skillsContainer = document.getElementById("skills-container");
    const loadingDiv = document.getElementById("loading");

    // URL에서 캐릭터 ID 추출
    const pathParts = window.location.pathname.split('/');
    const characterId = pathParts[pathParts.length - 1];

    if (!characterId || isNaN(parseInt(characterId))) {
        loadingDiv.textContent = "잘못된 캐릭터 ID입니다.";
        return;
    }

    // 마인크래프트 색코드 매핑
    const mcColors = {
        '0': '#000000', // 검정
        '1': '#0000AA', // 어두운 파랑
        '2': '#00AA00', // 어두운 초록
        '3': '#00AAAA', // 어두운 청록
        '4': '#AA0000', // 어두운 빨강
        '5': '#AA00AA', // 어두운 보라
        '6': '#FFAA00', // 금색
        '7': '#AAAAAA', // 회색
        '8': '#555555', // 어두운 회색
        '9': '#5555FF', // 파랑
        'a': '#55FF55', // 연두
        'b': '#55FFFF', // 청록
        'c': '#FF5555', // 빨강
        'd': '#FF55FF', // 분홍
        'e': '#FFFF55', // 노랑
        'f': '#FFFFFF'  // 흰색
    };

    // 색코드 변환 함수
    function parseMinecraftColors(text) {
        if (!text) return '';

        let result = '';
        let currentColor = '#FFFFFF'; // 기본 흰색
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

            // 줄바꿈 처리 (\n)
            if (text[i] === '\\' && i + 1 < text.length && text[i + 1] === 'n') {
                result += '<br>';
                i += 2;
                continue;
            }

            // 실제 줄바꿈 문자 처리
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

    // HTML 이스케이프 함수
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 캐릭터 정보 가져오기
    async function fetchCharacterInfo() {
        try {
            const response = await fetch(`/api/character-info?id=${characterId}`);
            if (!response.ok) {
                throw new Error('캐릭터 정보를 가져오는 데 실패했습니다.');
            }
            return await response.json();
        } catch (error) {
            console.error("fetchCharacterInfo error:", error);
            return null;
        }
    }

    // 스킬 타입 이름
    const skillTypeNames = {
        '0': '패시브',
        '1': '스킬 1',
        '2': '스킬 2',
        '3': '스킬 3',
        '4': '궁극기',
        'baseattack': '기본 공격'
    };

    // 스탯 이름 및 아이콘 매핑
    const statConfig = {
        '체력': { icon: '❤️', color: '#ff6b6b' },
        '공격력': { icon: '⚔️', color: '#ffa502' },
        '공격속도': { icon: '⚡', color: '#ffdd59' },
        '사거리': { icon: '🎯', color: '#70a1ff' },
        '이동속도': { icon: '👟', color: '#7bed9f' },
        '체력재생': { icon: '💚', color: '#2ed573' }
    };

    // 캐릭터 정보 렌더링
    async function renderCharacterInfo() {
        const charInfo = await fetchCharacterInfo();

        if (!charInfo || !charInfo.skills) {
            loadingDiv.textContent = "캐릭터 정보를 찾을 수 없습니다.";
            return;
        }

        loadingDiv.style.display = 'none';

        // 초상화 설정
        characterPortrait.src = `/Resource/character/${characterId}.png`;
        characterPortrait.onerror = () => { characterPortrait.src = '/Resource/character/0.png'; };

        // 스탯 데이터에서 캐릭터 이름 가져오기
        const statData = charInfo.skills['stat'];
        if (statData && statData.name) {
            characterName.textContent = statData.name;
        } else {
            characterName.textContent = `캐릭터 #${characterId}`;
        }

        // 스탯 정보 렌더링
        statsContainer.innerHTML = '';
        if (statData) {
            const statsGrid = document.createElement('div');
            statsGrid.classList.add('stats-grid');

            const statOrder = ['체력', '공격력', '공격속도', '사거리', '이동속도', '체력재생'];
            statOrder.forEach(statName => {
                if (statData[statName] !== undefined) {
                    const config = statConfig[statName] || { icon: '📊', color: '#ffffff' };
                    const statItem = document.createElement('div');
                    statItem.classList.add('stat-item');
                    statItem.innerHTML = `
                        <span class="stat-icon">${config.icon}</span>
                        <span class="stat-label">${statName}</span>
                        <span class="stat-value" style="color: ${config.color}">${statData[statName]}</span>
                    `;
                    statsGrid.appendChild(statItem);
                }
            });

            statsContainer.appendChild(statsGrid);
        }

        skillsContainer.innerHTML = '';

        // 스킬 순서: 0(패시브), baseattack(있으면), 1, 2, 3, 4 (stat 제외)
        const skillOrder = ['0', 'baseattack', '1', '2', '3', '4'];

        skillOrder.forEach(skillKey => {
            const skill = charInfo.skills[skillKey];
            if (!skill || skillKey === 'stat') return;

            const skillCard = document.createElement('div');
            skillCard.classList.add('skill-card');

            const skillTypeName = skillTypeNames[skillKey] || `스킬 ${skillKey}`;

            skillCard.innerHTML = `
                <div class="skill-header">
                    <span class="skill-type">${skillTypeName}</span>
                    <span class="skill-name">${escapeHtml(skill.name || '이름 없음')}</span>
                    ${skill.id ? '<span class="skill-link-icon">▶</span>' : ''}
                </div>
                <div class="skill-description">
                    ${parseMinecraftColors(skill.description || '')}
                </div>
            `;

            if (skill.id) {
                skillCard.classList.add('skill-card-clickable');
                skillCard.addEventListener('click', () => {
                    window.location.href = `/weapon/${skill.id}`;
                });
            }

            skillsContainer.appendChild(skillCard);
        });
    }

    renderCharacterInfo();
});
