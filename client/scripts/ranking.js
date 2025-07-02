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

    function renderTop3(players) {
        top3RankingSection.innerHTML = ''; // Clear previous content
        players.forEach((player, index) => {
            const rankDiv = document.createElement('div');
            rankDiv.classList.add('top-player-card');
            rankDiv.innerHTML = `
                <h3>#${index + 1}</h3>
                <img src="https://crafatar.com/avatars/${player.uuid}?size=100&overlay" alt="${player.uuid}'s Head" class="player-head-lg">
                <img src="/Resource/character/${player.mostUsedCharacter}.png" alt="${player.mostUsedCharacter}" class="char-img-lg">
                <p><strong>${player.uuid}</strong></p>
                <p><strong>총 게임 수:</strong> ${player.totalGames}</p>
                <p><strong>승률:</strong> ${player.winRate}%</p>
                <p><strong>평균 처치:</strong> ${player.averageKillRate}</p>
            `;
            top3RankingSection.appendChild(rankDiv);
        });
    }

    function renderOtherPlayers(players) {
        otherRankingSection.innerHTML = ''; // Clear previous content
        const ul = document.createElement('ul');
        players.slice(0, 7).forEach((player, index) => { // 상위 3명 제외하고 7명 더 표시 (총 10명)
            const li = document.createElement('li');
            li.classList.add('ranking-item');
            li.innerHTML = `
                <span>#${index + 4}</span>
                <img src="https://crafatar.com/avatars/${player.uuid}?size=32&overlay" alt="${player.uuid}'s Head" class="player-head-sm">
                <span>${player.uuid}</span>
                <span>총 게임: ${player.totalGames}</span>
                <span>승률: ${player.winRate}%</span>
            `;
            ul.appendChild(li);
        });
        otherRankingSection.appendChild(ul);
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