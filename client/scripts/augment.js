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

    augmentGrid.innerHTML = Array.from({ length: 24 }, () => '<div class="skeleton skeleton-tile"></div>').join('');

    const augments = await fetchAugmentList();

    if (!augments || augments.length === 0) {
        augmentGrid.innerHTML = '<div class="empty-state">증강 정보를 찾을 수 없습니다.</div>';
        return;
    }

    augmentGrid.innerHTML = augments.map(aug => {
        const name = String(aug.name || `증강 ${aug.id}`).replace(/"/g, '&quot;');
        return `<button type="button" class="character-grid-item" data-augment-id="${aug.id}" data-tip="${name}" aria-label="${name}">
            <img src="/Resource/augment/icon/${aug.id}.png" alt="" class="character-grid-img" loading="lazy" onerror="this.src='/Resource/augment/icon/0.png'">
        </button>`;
    }).join('');

    augmentGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.character-grid-item');
        if (item) showAugmentPopup(Number(item.dataset.augmentId));
    });
});
