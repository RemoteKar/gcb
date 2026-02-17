document.addEventListener("DOMContentLoaded", async () => {
    const augmentGrid = document.getElementById("augment-grid");

    async function fetchAugmentList() {
        try {
            const response = await fetch('/api/augment-list');
            if (!response.ok) {
                throw new Error('증강 목록을 가져오는 데 실패했습니다.');
            }
            const data = await response.json();
            return data.augments;
        } catch (error) {
            console.error("fetchAugmentList error:", error);
            return [];
        }
    }

    async function renderAugmentGrid() {
        augmentGrid.textContent = "로딩 중...";

        const augments = await fetchAugmentList();

        if (!augments || augments.length === 0) {
            augmentGrid.textContent = "증강 정보를 찾을 수 없습니다.";
            return;
        }

        augmentGrid.innerHTML = '';

        augments.forEach(aug => {
            const item = document.createElement('div');
            item.classList.add('character-grid-item');
            item.innerHTML = `
                <img src="/Resource/augment/icon/${aug.id}.png" alt="${aug.name}" class="character-grid-img" onerror="this.src='/Resource/augment/icon/0.png'">
            `;
            item.addEventListener('click', () => {
                showAugmentPopup(aug.id);
            });
            augmentGrid.appendChild(item);
        });
    }

    renderAugmentGrid();
});
