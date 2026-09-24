document.addEventListener("DOMContentLoaded", async () => {
    const coreGrid = document.getElementById("core-grid");

    async function fetchCoreList() {
        try {
            const response = await fetch('/data/cores.json');
            if (!response.ok) {
                throw new Error('코어 목록을 가져오는 데 실패했습니다.');
            }
            return await response.json();
        } catch (error) {
            console.error("fetchCoreList error:", error);
            return [];
        }
    }

    coreGrid.innerHTML = Array.from({ length: 24 }, () => '<div class="skeleton skeleton-tile"></div>').join('');

    const cores = await fetchCoreList();

    if (!cores || cores.length === 0) {
        coreGrid.innerHTML = '<div class="empty-state">코어 정보를 찾을 수 없습니다.</div>';
        return;
    }

    coreGrid.innerHTML = cores.map(core => {
        const name = String(core.name || `코어 ${core.id}`).replace(/"/g, '&quot;');
        return `<button type="button" class="character-grid-item" data-core-key="${core.id}" data-tip="${name}" aria-label="${name}">
            <img src="/Resource/core/${core.id}.png" alt="" class="character-grid-img" loading="lazy" onerror="this.onerror=null;this.src='/Resource/core/0.png'">
        </button>`;
    }).join('');

    coreGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.character-grid-item');
        if (item) showCorePopup(item.dataset.coreKey);
    });
});
