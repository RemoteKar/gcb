document.addEventListener("DOMContentLoaded", async () => {
    const augmentListDiv = document.getElementById("augment-list");

    async function fetchAugmentStats() {
        try {
            const response = await fetch('/data/augment-stats.json');
            if (!response.ok) {
                throw new Error('증강 통계를 가져오는 데 실패했습니다.');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("fetchAugmentStats error:", error);
            augmentListDiv.textContent = "증강 통계를 불러오는 데 실패했습니다.";
            return null;
        }
    }

    async function renderAugmentStats() {
        augmentListDiv.textContent = "데이터 로딩 중...";
        const augmentStats = await fetchAugmentStats();

        if (!augmentStats || augmentStats.length === 0) {
            augmentListDiv.textContent = "데이터가 없습니다.";
            return;
        }

        augmentListDiv.innerHTML = '';

        augmentStats.forEach((stat, index) => {
            const augmentDiv = document.createElement('div');
            augmentDiv.classList.add('character-stat-item'); // 캐릭터 통계와 동일한 스타일 재활용

            augmentDiv.innerHTML = `
                <span class="rank-number">#${index + 1}</span>
                <img src="/Resource/augment/icon/${stat.augmentId ?? 'default'}.png" alt="Augment ${stat.augmentId}" class="character-stat-img" style="cursor:pointer;">
                <p><strong>${stat.picks}회</strong></p>
            `;
            const augImg = augmentDiv.querySelector('.character-stat-img');
            if (stat.augmentId != null) {
                augImg.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showAugmentPopup(stat.augmentId);
                });
            }
            augmentListDiv.appendChild(augmentDiv);
        });
    }

    renderAugmentStats(); // 초기 렌더링
});
