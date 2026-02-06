document.addEventListener("DOMContentLoaded", async () => {
    const characterGrid = document.getElementById("character-grid");

    // 캐릭터 ID 목록 가져오기 (1~899)
    async function fetchCharacterList() {
        try {
            const response = await fetch('/api/character-list');
            if (!response.ok) {
                throw new Error('캐릭터 목록을 가져오는 데 실패했습니다.');
            }
            const data = await response.json();
            return data.characters;
        } catch (error) {
            console.error("fetchCharacterList error:", error);
            return [];
        }
    }

    // 캐릭터 그리드 렌더링
    async function renderCharacterGrid() {
        characterGrid.textContent = "로딩 중...";

        const characters = await fetchCharacterList();

        if (!characters || characters.length === 0) {
            characterGrid.textContent = "캐릭터를 찾을 수 없습니다.";
            return;
        }

        characterGrid.innerHTML = '';

        characters.forEach(charId => {
            const charItem = document.createElement('div');
            charItem.classList.add('character-grid-item');
            charItem.innerHTML = `
                <img src="/Resource/character/${charId}.png" alt="Character ${charId}" class="character-grid-img" onerror="this.src='/Resource/character/0.png'">
            `;
            charItem.addEventListener('click', () => {
                window.location.href = `/character/${charId}`;
            });
            characterGrid.appendChild(charItem);
        });
    }

    renderCharacterGrid();
});
