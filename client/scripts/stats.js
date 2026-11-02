// 캐릭터 · 증강 · 코어 통계 표 (<body data-stats="character|augment|core">) + 기간 탭
const { esc, json, portrait, charName, num, bindTabs } = GCB;
const { createSortableTable, bar } = StatsTable;
const kind = document.body.dataset.stats;
const tableEl = document.getElementById('stats-table');
const noteEl = document.getElementById('period-note');
const PERIOD = { recent60: ['최근 60게임', 60], recent200: ['최근 200게임', 200], all: ['전체', Infinity] };
const LOW_SAMPLE = 5;

const [data, names] = await Promise.all([json(`/data/${kind}-stats.json`), json('/data/names.json')]);

const KINDS = {
    character: {
        label: '캐릭터',
        rows: p => Object.entries(data.characters).map(([id, s]) => s[p] && { ...s[p], id: Number(id) }).filter(Boolean),
        name: r => charName(r.id, names),
        cell: r => `<a class="entity" href="/character/${r.id}"><img class="portrait" src="${portrait(r.id)}" alt="" loading="lazy"><span>${esc(charName(r.id, names))}</span></a>`,
        games: p => Math.min(data.games, PERIOD[p][1]),
    },
    augment: {
        label: '증강',
        rows: p => data[p] || [],
        name: r => names?.augments?.[r.id] || `증강 ${r.id}`,
        cell: r => `<button type="button" class="entity" data-augment-id="${r.id}"><img class="aug-icon" src="/Resource/augment/icon/${r.id}.png" alt="" loading="lazy" onerror="this.src='/Resource/augment/icon/0.png'"><span>${esc(names?.augments?.[r.id] || `증강 ${r.id}`)}</span></button>`,
    },
    core: {
        label: '코어',
        rows: p => data[p] || [],
        name: r => names?.cores?.[r.id] || r.id,
        cell: r => `<button type="button" class="entity" data-core-key="${esc(r.id)}"><img class="core-icon" src="/Resource/core/${esc(r.id)}.png" alt="" loading="lazy" onerror="this.onerror=null;this.src='/Resource/core/0.png'"><span>${esc(names?.cores?.[r.id] || r.id)}</span></button>`,
    },
};
const k = KINDS[kind];

const table = createSortableTable(tableEl, [
    { key: 'name', label: k.label, defaultDir: 'asc', value: k.name, render: k.cell },
    { key: 'games', label: '픽 수', numeric: true, render: r => r.games },
    { key: 'pickRate', label: '픽률', tip: '픽 수 / 기간 전체 참가자 수', numeric: true, render: r => `${r.pickRate}%` },
    { key: 'winRate', label: '승률', numeric: true, render: r => `<span class="${r.games >= LOW_SAMPLE && r.winRate >= 10 ? 'good' : ''}">${r.winRate}%</span>${bar(r.winRate * 3)}` },
    { key: 'top50Rate', label: '순방률', tip: '상위 50% 이내로 끝낸 비율', numeric: true, render: r => `${r.top50Rate}%${bar(r.top50Rate, 'green')}` },
    { key: 'avgRank', label: '평균 순위', numeric: true, defaultDir: 'asc', render: r => r.avgRank },
    { key: 'avgKills', label: '처치', numeric: true, render: r => r.avgKills },
    { key: 'avgDeaths', label: '사망', numeric: true, defaultDir: 'asc', render: r => r.avgDeaths },
    { key: 'avgDamage', label: '가한 피해', numeric: true, render: r => num(r.avgDamage) },
], { defaultSort: 'games', rowClass: r => (r.games < LOW_SAMPLE ? 'low-sample' : '') });

function show(period) {
    table.setRows(k.rows(period));
    const games = k.games ? ` · ${k.games(period)}판` : '';
    noteEl.textContent = `${PERIOD[period][0]}${games} 기준 · 흐린 줄 = ${LOW_SAMPLE}픽 미만`;
}

if (!data) tableEl.innerHTML = '<div class="empty">통계를 불러오지 못했습니다.</div>';
else show(bindTabs(document.getElementById('period-tabs'), show) || 'recent60');
