document.addEventListener("DOMContentLoaded", async () => {
    const tableEl = document.getElementById("augment-table");
    const { createSortableTable, bindTabs, bar, esc } = StatsTable;

    let stats = null;
    let names = null;
    const nameOf = id => names?.augments?.[id] || `증강 ${id}`;

    const table = createSortableTable(tableEl, [
        {
            key: 'name', label: '증강', defaultDir: 'asc',
            value: r => nameOf(r.augmentId),
            render: r => `<button type="button" class="entity-cell aug-entity" data-augment-id="${r.augmentId}" style="background:none;border:none;padding:0;cursor:pointer;font:inherit;"><img src="/Resource/augment/icon/${r.augmentId}.png" alt="" loading="lazy" onerror="this.src='/Resource/augment/icon/0.png'"><span class="entity-name">${esc(nameOf(r.augmentId))}</span></button>`,
        },
        { key: 'picks', label: '픽 수', numeric: true, render: r => `${r.picks}${bar(r.picks / (r._maxPicks || 1) * 100, 'blue')}` },
        { key: 'winRate', label: '승률', numeric: true, render: r => `<span class="${r.winRate >= 10 ? 'rate-good' : ''}">${r.winRate}%</span>${bar(r.winRate * 3)}` },
        { key: 'top50Rate', label: '순방률', numeric: true, render: r => `${r.top50Rate}%${bar(r.top50Rate, 'green')}` },
    ], { defaultSort: 'picks' });

    tableEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.aug-entity');
        if (btn) showAugmentPopup(Number(btn.dataset.augmentId));
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
        const [statsRes, namesRes] = await Promise.all([fetch('/data/augment-stats.json'), fetch('/data/names.json')]);
        if (!statsRes.ok) throw new Error('증강 통계 로드 실패');
        stats = await statsRes.json();
        names = namesRes.ok ? await namesRes.json() : null;
        show(initial || 'recent60');
    } catch (error) {
        console.error(error);
        tableEl.innerHTML = '<div class="empty-state">증강 통계를 불러오는 데 실패했습니다.</div>';
    }
});
