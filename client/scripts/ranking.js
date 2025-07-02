document.addEventListener("DOMContentLoaded", async () => {
    const top3RankingSection = document.getElementById("top-3-ranking");
    const otherRankingSection = document.getElementById("other-ranking");

    async function fetchLeaderboardData() {
        try {
            const response = await fetch('/api/leaderboard');
            if (!response.ok) {
                throw new Error('랭킹 데이터를 가져오는 데 실패했습니다.');
            }
            const leaderboardData = await response.json();

            // Extract all unique UUIDs from the leaderboard data
            const uuids = [...new Set(leaderboardData.map(player => player.uuid))];

            // Fetch all badge data in parallel
            const badgePromises = uuids.map(async uuid => {
                try {
                    const badge = await fetchBadgeData(uuid);
                    return { uuid, badge };
                } catch (error) {
                    console.error(`배지 데이터 fetch 오류 (UUID: ${uuid}):`, error);
                    return { uuid, badge: null }; // Return null for failed fetches
                }
            });

            const badgeResults = await Promise.all(badgePromises);

            // Create a map for easy lookup
            const badgeDataMap = new Map();
            badgeResults.forEach(({ uuid, badge }) => {
                badgeDataMap.set(uuid, badge);
            });

            return { leaderboardData, badgeDataMap };

        } catch (error) {
            console.error("랭킹 데이터 fetch 오류:", error);
            return null;
        }
    }

    async function renderTop3(players, badgeDataMap) { // Add badgeDataMap parameter
        top3RankingSection.innerHTML = ''; // Clear previous content
        // 1등, 2등, 3등 플레이어 추출
        const player1 = players[0];
        const player2 = players[1];
        const player3 = players[2];

        // 2등, 1등, 3등 순서로 카드 생성 및 추가
        if (player2) top3RankingSection.appendChild(await createRankCard(player2, 2, badgeDataMap)); // Pass badgeDataMap
        if (player1) top3RankingSection.appendChild(await createRankCard(player1, 1, badgeDataMap)); // Pass badgeDataMap
        if (player3) top3RankingSection.appendChild(await createRankCard(player3, 3, badgeDataMap)); // Pass badgeDataMap
    }

    async function renderOtherPlayers(players, badgeDataMap) { // Add badgeDataMap parameter
        otherRankingSection.innerHTML = ''; // Clear previous content
        const ul = document.createElement('ul');
        // No need for async/await inside the loop if badge data is pre-fetched
        for (const [index, player] of players.slice(0, 7).entries()) {
            const li = document.createElement('li');
            li.classList.add('ranking-item');

            // 배지 데이터 가져오기 (이제 캐시된 맵에서 가져옴)
            let badgeHtml = '';
            const badgeData = badgeDataMap.get(player.uuid); // Get from map
            if (badgeData && badgeData.current) {
                const badgeName = badgeData.current;
                badgeHtml = `<img src="/Resource/badge/${badgeName}.png" alt="${badgeName}" class="badge-img-other-ranking">`; // 새로운 클래스 사용
            }

            li.innerHTML = `
                <span>#${index + 4}</span>
                <img src="https://crafatar.com/avatars/${player.uuid}?size=32&overlay" alt="${player.nickname}'s Head" class="player-head-sm">
                <span>${player.nickname}</span>
                <span>총 게임: ${player.totalGames}</span>
                <span>승률: ${player.winRate}%</span>
                ${badgeHtml}
            `;
            li.addEventListener('click', () => {
                window.location.href = `/user/${encodeURIComponent(player.nickname)}`;
            });
            ul.appendChild(li);
        }
        otherRankingSection.appendChild(ul);
    }

    // 랭킹 카드 생성 헬퍼 함수
    async function createRankCard(player, rank, badgeDataMap) { // Add badgeDataMap parameter
        const rankDiv = document.createElement('div');
        rankDiv.classList.add('top-player-card', `rank-${rank}`);

        // 배지 데이터 가져오기 (이제 캐시된 맵에서 가져옴)
        let badgeHtml = '';
        const badgeData = badgeDataMap.get(player.uuid); // Get from map
        if (badgeData && badgeData.current) {
            const badgeName = badgeData.current;
            badgeHtml = `<img src="/Resource/badge/${badgeName}.png" alt="${badgeName}" class="badge-img-ranking">`;
        }

        rankDiv.innerHTML = `
            <h3>#${rank}</h3>
            <div class="player-info-row">
                <img src="https://crafatar.com/avatars/${player.uuid}?size=100&overlay" alt="${player.nickname}'s Head" class="player-head-lg">
                ${badgeHtml}
            </div>
            <p><strong>${player.nickname}</strong></p>
            <p><strong>총 게임 수:</strong> ${player.totalGames}</p>
            <p><strong>승률:</strong> ${player.winRate}%</p>
        `;
        rankDiv.addEventListener('click', () => {
            window.location.href = `/user/${encodeURIComponent(player.nickname)}`;
        });
        return rankDiv;
    }

    const { leaderboardData, badgeDataMap } = await fetchLeaderboardData(); // Destructure the returned object
    if (leaderboardData && leaderboardData.length > 0) {
        renderTop3(leaderboardData.slice(0, 3), badgeDataMap); // Pass badgeDataMap
        renderOtherPlayers(leaderboardData.slice(3), badgeDataMap); // Pass badgeDataMap
    } else {
        top3RankingSection.textContent = "랭킹 데이터를 찾을 수 없습니다.";
        otherRankingSection.textContent = "";
    }
});

// 배지 데이터 가져오는 함수 (user.js에서 복사)
async function fetchBadgeData(uuid) {
    const url = `/api/badge?uuid=${uuid}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("배지 데이터를 찾을 수 없습니다.");
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("fetchBadgeData error:", error);
        return null;
    }
}