document.addEventListener("DOMContentLoaded", async () => {
    const tableEl = document.getElementById("core-table");
    const { createSortableTable, bindTabs, bar, esc } = StatsTable;

    let stats = null;
    let names = null;
    const nameOf = id => names?.cores?.[id] || `코어 ${id}`;

    const table = createSortableTable(tableEl, [
        {
            key: 'name', label: '코어', defaultDir: 'asc',
            value: r => nameOf(r.coreId),
            render: r => `<button type="button" class="entity-cell core-entity" data-core-key="${esc(r.coreId)}" style="background:none;border:none;padding:0;cursor:pointer;font:inherit;"><img src="/Resource/core/${esc(r.coreId)}.png" alt="" loading="lazy" onerror="this.onerror=null;this.src='/Resource/core/0.png'"><span class="entity-name">${esc(nameOf(r.coreId))}</span></button>`,
        },
        { key: 'picks', label: '픽 수', numeric: true, render: r => `${r.picks}${bar(r.picks / (r._maxPicks || 1) * 100, 'blue')}` },
        { key: 'pickRate', label: '픽률', numeric: true, render: r => `${r.pickRate}%` },
        { key: 'wins', label: '승리', numeric: true, render: r => `${r.wins}` },
        { key: 'winRate', label: '승률', numeric: true, render: r => `<span class="${r.winRate >= 10 ? 'rate-good' : ''}">${r.winRate}%</span>${bar(r.winRate * 3)}` },
        { key: 'avgRank', label: '평균 순위', numeric: true, defaultDir: 'asc', render: r => `${r.avgRank}` },
        { key: 'avgKills', label: '평균 킬', numeric: true, render: r => `${r.avgKills}` },
        { key: 'avgDamage', label: '평균 피해', numeric: true, render: r => r.avgDamage.toLocaleString() },
    ], { defaultSort: 'picks' });

    tableEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.core-entity');
        if (btn) showCorePopup(btn.dataset.coreKey);
    });

    function show(period) {
        if (!stats) return;
        const rows = (stats[period] || []).filter(r => r.picks > 0);
        const maxPicks = Math.max(1, ...rows.map(r => r.picks));
        rows.forEach(r => { r._maxPicks = maxPicks; });
        table.setRows(rows);
    }

    const initial = bindTabs(document.getElementById('period-tabs'), show);

    try {
        const [statsRes, namesRes] = await Promise.all([fetch('/data/core-stats.json'), fetch('/data/names.json')]);
        if (!statsRes.ok) throw new Error('코어 통계 로드 실패');
        stats = await statsRes.json();
        names = namesRes.ok ? await namesRes.json() : null;
        show(initial || 'recent60');
    } catch (error) {
        console.error(error);
        tableEl.innerHTML = '<div class="empty-state">코어 통계를 불러오는 데 실패했습니다.</div>';
    }
});
