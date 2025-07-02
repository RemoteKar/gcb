document.addEventListener("DOMContentLoaded", async () => {
    const top3RankingSection = document.getElementById("top-3-ranking");
    const otherRankingSection = document.getElementById("other-ranking");

    async function fetchLeaderboardData() {
        try {
            const response = await fetch('/api/leaderboard');
            if (!response.ok) {
                throw new Error('랭킹 데이터를 가져오는 데 실패했습니다.');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error("랭킹 데이터 fetch 오류:", error);
            return null;
        }
    }

    async function renderTop3(players) {
        top3RankingSection.innerHTML = ''; // Clear previous content
        // 1등, 2등, 3등 플레이어 추출
        const player1 = players[0];
        const player2 = players[1];
        const player3 = players[2];

        // 2등, 1등, 3등 순서로 카드 생성 및 추가
        if (player2) top3RankingSection.appendChild(await createRankCard(player2, 2));
        if (player1) top3RankingSection.appendChild(await createRankCard(player1, 1));
        if (player3) top3RankingSection.appendChild(await createRankCard(player3, 3));
    }

    function renderOtherPlayers(players) {
        otherRankingSection.innerHTML = ''; // Clear previous content
        const ul = document.createElement('ul');
        players.slice(0, 7).forEach((player, index) => { // 상위 3명 제외하고 7명 더 표시 (총 10명)
            const li = document.createElement('li');
            li.classList.add('ranking-item');
            li.innerHTML = `
                <span>#${index + 4}</span>
                <img src="https://crafatar.com/avatars/${player.uuid}?size=32&overlay" alt="${player.nickname}'s Head" class="player-head-sm">
                <span>${player.nickname}</span>
                <span>총 게임: ${player.totalGames}</span>
                <span>승률: ${player.winRate}%</span>
            `;
            li.addEventListener('click', () => {
                window.location.href = `/user/${encodeURIComponent(player.nickname)}`;
            });
            ul.appendChild(li);
        });
        otherRankingSection.appendChild(ul);
    }

    // 랭킹 카드 생성 헬퍼 함수
    async function createRankCard(player, rank) {
        const rankDiv = document.createElement('div');
        rankDiv.classList.add('top-player-card', `rank-${rank}`);

        // 배지 데이터 가져오기
        let badgeHtml = '';
        try {
            const badgeData = await fetchBadgeData(player.uuid); // player.uuid 사용
            if (badgeData && badgeData.current) {
                const badgeName = badgeData.current;
                badgeHtml = `<img src="/Resource/badge/${badgeName}.png" alt="${badgeName}" class="badge-img-ranking">`;
            }
        } catch (error) {
            console.error(`배지 데이터 fetch 오류 (UUID: ${player.uuid}):`, error);
        }

        rankDiv.innerHTML = `
            <h3>#${rank}</h3>
            <div class="player-info-row">
                <img src="https://crafatar.com/avatars/${player.uuid}?size=100&overlay" alt="${player.nickname}'s Head" class="player-head-lg">
                ${badgeHtml} // 배지 이미지 추가
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

    const leaderboardData = await fetchLeaderboardData();
    if (leaderboardData && leaderboardData.length > 0) {
        renderTop3(leaderboardData.slice(0, 3));
        renderOtherPlayers(leaderboardData.slice(3));
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