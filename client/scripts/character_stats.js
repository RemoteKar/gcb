document.addEventListener("DOMContentLoaded", async () => {
    const tableEl = document.getElementById("character-table");
    const noteEl = document.getElementById("period-note");
    const { createSortableTable, bindTabs, bar, esc } = StatsTable;

    const PERIOD_LABEL = { recent60: '최근 60게임', recent200: '최근 200게임', all: '전체' };

    let stats = null;
    let names = null;

    const nameOf = id => names?.characters?.[id] || `캐릭터 ${id}`;

    const table = createSortableTable(tableEl, [
        {
            key: 'name', label: '캐릭터', sortable: true, defaultDir: 'asc',
            value: r => nameOf(r.characterId),
            render: r => `<a class="entity-cell" href="/character/${r.characterId}"><img src="/Resource/character/${r.characterId}.png" alt="" loading="lazy" onerror="this.src='/Resource/character/0.png'"><span class="entity-name">${esc(nameOf(r.characterId))}</span></a>`,
        },
        { key: 'picks', label: '픽 수', numeric: true, render: r => `${r.picks}` },
        { key: 'pickRate', label: '픽률', numeric: true, render: r => `${r.pickRate}%${bar(r.pickRate * 8, 'blue')}` },
        { key: 'wins', label: '승리', numeric: true, render: r => `${r.wins}` },
        { key: 'winRate', label: '승률', numeric: true, render: r => `<span class="${r.winRate >= 10 ? 'rate-good' : ''}">${r.winRate}%</span>${bar(r.winRate * 3)}` },
        { key: 'top50Rate', label: '순방률', numeric: true, render: r => `${r.top50Rate}%${bar(r.top50Rate, 'green')}` },
        { key: 'avgKills', label: '평균 킬', numeric: true, render: r => `${r.avgKills}` },
        { key: 'avgDamage', label: '평균 피해', numeric: true, render: r => r.avgDamage.toLocaleString() },
    ], { defaultSort: 'wins', tableClass: 'character-stats-table' });

    function show(period) {
        if (!stats) return;
        const rows = Object.entries(stats.characters)
            .map(([id, periods]) => periods[period] ? { characterId: Number(id), ...periods[period] } : null)
            .filter(Boolean);
        table.setRows(rows);
        const games = period === 'all' ? stats.games : Math.min(stats.games, period === 'recent60' ? 60 : 200);
        noteEl.textContent = `${PERIOD_LABEL[period]} (${games}판) 기준 · 픽률 = 픽 수 / 전체 참가자 수 · 순방률 = 상위 50% 이내 비율`;
    }

    const initial = bindTabs(document.getElementById('period-tabs'), show);

    try {
        const [statsRes, namesRes] = await Promise.all([fetch('/data/character-stats.json'), fetch('/data/names.json')]);
        if (!statsRes.ok) throw new Error('통계 로드 실패');
        stats = await statsRes.json();
        names = namesRes.ok ? await namesRes.json() : null;
        show(initial || 'recent60');
    } catch (error) {
        console.error(error);
        tableEl.innerHTML = '<div class="empty-state">캐릭터 통계를 불러오는 데 실패했습니다.</div>';
    }
});
