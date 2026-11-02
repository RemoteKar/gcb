// 랭킹: TOP 3 단상 + 전체 정렬 표 (닉네임 검색)
const { esc, json, portrait, charName, avatar, num } = GCB;
const { createSortableTable, bar } = StatsTable;
const $ = id => document.getElementById(id);

const [leaderboard, badges, names] = await Promise.all([json('/data/leaderboard.json'), json('/data/badges.json'), json('/data/names.json')]);

const badge = (uuid, cls) => {
    const b = badges?.[uuid]?.current;
    return b ? `<img class="${cls}" src="/Resource/badge/${esc(b)}.png" alt="" onerror="this.remove()">` : '';
};
const href = p => `/user/${encodeURIComponent(p.nickname)}`;
const MMR_TIP = '판마다 이긴 사람 비율로 매긴 점수. 평균 1000, 판수가 적을수록 1000 쪽으로 보정';

if (!leaderboard?.length) {
    $('podium').innerHTML = '';
    $('ranking-table').innerHTML = '<div class="empty">랭킹 데이터를 찾을 수 없습니다.</div>';
} else {
    const ranked = leaderboard.map((p, i) => ({ ...p, rank: i + 1 }));

    // 2등 · 1등 · 3등 순서로 배치
    $('podium').innerHTML = [ranked[1], ranked[0], ranked[2]].filter(Boolean).map(p => `
        <a class="podium-card r${p.rank}" href="${href(p)}">
            <span class="podium-rank">${p.rank}</span>
            ${avatar(p.uuid, 72)}
            <b class="podium-name">${esc(p.nickname)}${badge(p.uuid, 'badge-img')}</b>
            <span class="podium-mmr" data-tip="${MMR_TIP}">${num(p.mmr)} <small>MMR</small></span>
            <span class="podium-meta">${p.games}판 · 승률 ${p.winRate}% · 순방 ${p.top50Rate}%</span>
            <img class="podium-main" src="${portrait(p.mostCharacter)}" alt="" data-tip="모스트 ${esc(charName(p.mostCharacter, names))}">
        </a>`).join('');

    const table = createSortableTable($('ranking-table'), [
        { key: 'rank', label: '순위', numeric: true, defaultDir: 'asc', render: r => `<span class="rank-num r${r.rank}">${r.rank}</span>` },
        {
            key: 'nickname', label: '유저', defaultDir: 'asc',
            render: r => `<a class="entity" href="${href(r)}">${avatar(r.uuid, 28)}<span>${esc(r.nickname)}</span>${badge(r.uuid, 'badge-sm')}</a>`,
        },
        { key: 'mostCharacter', label: '모스트', sortable: false, render: r => `<img class="portrait" src="${portrait(r.mostCharacter)}" alt="" loading="lazy" data-tip="${esc(charName(r.mostCharacter, names))}">` },
        { key: 'games', label: '게임', numeric: true, render: r => r.games },
        { key: 'mmr', label: 'MMR', tip: MMR_TIP, numeric: true, render: r => `<b>${num(r.mmr)}</b>` },
        { key: 'winRate', label: '승률', numeric: true, render: r => `${r.winRate}%${bar(r.winRate * 3)}` },
        { key: 'top50Rate', label: '순방률', tip: '상위 50% 이내로 끝낸 비율', numeric: true, render: r => `${r.top50Rate}%${bar(r.top50Rate, 'green')}` },
        { key: 'avgRank', label: '평균 순위', numeric: true, defaultDir: 'asc', render: r => r.avgRank },
        { key: 'avgKills', label: '처치', numeric: true, render: r => r.avgKills },
        { key: 'avgDeaths', label: '사망', numeric: true, defaultDir: 'asc', render: r => r.avgDeaths },
        { key: 'avgDamage', label: '가한 피해', numeric: true, render: r => num(r.avgDamage) },
    ], { defaultSort: 'rank', defaultDir: 'asc', rank: false, tableClass: 'ranking-table', emptyText: '검색 결과가 없습니다.' });

    const search = $('ranking-search');
    const apply = () => {
        const q = search.value.trim().toLowerCase();
        const rows = q ? ranked.filter(r => r.nickname.toLowerCase().includes(q)) : ranked;
        table.setRows(rows);
        $('ranking-count').textContent = q ? `검색 결과 ${rows.length}명` : `전체 랭킹 ${ranked.length}명`;
    };
    search.addEventListener('input', apply);
    apply();
}
