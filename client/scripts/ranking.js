document.addEventListener("DOMContentLoaded", async () => {
    const top3RankingSection = document.getElementById("top-3-ranking");
    const otherRankingSection = document.getElementById("other-ranking");
    const searchInput = document.getElementById("ranking-search");
    const countEl = document.getElementById("ranking-count");
    const { createSortableTable, esc } = StatsTable;

    const avatar = (uuid, size, cls = '') => `<img class="${cls}" src="https://mc-heads.net/avatar/${uuid}/${size}" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://crafatar.com/avatars/${uuid}?size=${size}&overlay'">`;

    async function fetchLeaderboardData() {
        try {
            const [response, badgeResponse] = await Promise.all([
                fetch('/data/leaderboard.json'),
                fetch('/data/badges.json'),
            ]);
            if (!response.ok) {
                throw new Error('랭킹 데이터를 가져오는 데 실패했습니다.');
            }
            const leaderboardData = await response.json();
            const badges = badgeResponse.ok ? await badgeResponse.json() : {};
            return { leaderboardData, badgeDataMap: new Map(Object.entries(badges)) };
        } catch (error) {
            console.error("랭킹 데이터 fetch 오류:", error);
            return null;
        }
    }

    function badgeHtml(badgeDataMap, uuid, cls) {
        const badgeData = badgeDataMap.get(uuid);
        if (!badgeData || !badgeData.current) return '';
        return `<img src="/Resource/badge/${badgeData.current}.png" alt="${esc(badgeData.current)}" class="${cls}">`;
    }

    // 랭킹 카드 생성 헬퍼 함수 (1~3위)
    function createRankCard(player, rank, badgeDataMap) {
        const card = document.createElement('a');
        card.href = `/user/${encodeURIComponent(player.nickname)}`;
        card.classList.add('top-player-card', `rank-${rank}`);
        card.innerHTML = `
            <h3>#${rank}</h3>
            <div class="player-info-row">
                ${avatar(player.uuid, 100, 'player-head-lg')}
                ${badgeHtml(badgeDataMap, player.uuid, 'badge-img-ranking')}
            </div>
            <p><strong>${esc(player.nickname)}</strong></p>
            <p><strong>총 게임 수:</strong> ${player.totalGames}</p>
            <p><strong>승률:</strong> ${player.winRate}%</p>
        `;
        return card;
    }

    function renderTop3(players, badgeDataMap) {
        top3RankingSection.innerHTML = '';
        const [player1, player2, player3] = players;
        // 2등, 1등, 3등 순서로 배치
        if (player2) top3RankingSection.appendChild(createRankCard(player2, 2, badgeDataMap));
        if (player1) top3RankingSection.appendChild(createRankCard(player1, 1, badgeDataMap));
        if (player3) top3RankingSection.appendChild(createRankCard(player3, 3, badgeDataMap));
    }

    const result = await fetchLeaderboardData();
    if (!result || !result.leaderboardData || result.leaderboardData.length === 0) {
        top3RankingSection.textContent = "랭킹 데이터를 찾을 수 없습니다.";
        otherRankingSection.innerHTML = "";
        return;
    }
    const { leaderboardData, badgeDataMap } = result;

    // 원래 순위(점수순) 보존
    const ranked = leaderboardData.map((p, i) => ({ ...p, rank: i + 1, _score: (Number(p.winRate) / 100) * (Number(p.avarageRankLeast50) / 100) }));

    renderTop3(ranked.slice(0, 3), badgeDataMap);

    const table = createSortableTable(otherRankingSection, [
        { key: 'rank', label: '순위', numeric: true, defaultDir: 'asc', value: r => r.rank, render: r => `<span class="rank-cell top${r.rank}">${r.rank}</span>` },
        {
            key: 'nickname', label: '유저', defaultDir: 'asc',
            render: r => `<a class="entity-cell" href="/user/${encodeURIComponent(r.nickname)}">${avatar(r.uuid, 32)}<span class="entity-name">${esc(r.nickname)}</span>${badgeHtml(badgeDataMap, r.uuid, 'badge-img-other-ranking')}</a>`,
        },
        { key: 'totalGames', label: '게임', numeric: true, value: r => Number(r.totalGames), render: r => r.totalGames },
        { key: 'winRate', label: '승률', numeric: true, value: r => Number(r.winRate), render: r => `${r.winRate}%${StatsTable.bar(Number(r.winRate) * 3)}` },
        { key: 'avarageRankLeast50', label: '순방률', numeric: true, value: r => Number(r.avarageRankLeast50), render: r => `${r.avarageRankLeast50}%${StatsTable.bar(Number(r.avarageRankLeast50), 'green')}` },
        { key: 'averageKillRate', label: '평균 킬', numeric: true, value: r => Number(r.averageKillRate), render: r => r.averageKillRate },
        { key: 'averageDamageDealt', label: '평균 피해', numeric: true, value: r => Number(r.averageDamageDealt), render: r => Number(r.averageDamageDealt).toLocaleString() },
    ], { defaultSort: 'rank', defaultDir: 'asc', rank: false, tableClass: 'ranking-table', emptyText: '검색 결과가 없습니다.' });

    function applyFilter() {
        const q = searchInput.value.trim().toLowerCase();
        const rows = q ? ranked.filter(r => r.nickname.toLowerCase().includes(q)) : ranked;
        table.setRows(rows);
        countEl.textContent = q ? `검색 결과 ${rows.length}명` : `전체 랭킹 (${ranked.length}명)`;
    }

    searchInput.addEventListener('input', applyFilter);
    applyFilter();
});
