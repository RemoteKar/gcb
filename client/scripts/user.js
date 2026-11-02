// 유저 전적: 프로필 · 종합 · 플레이 성향(육각) · 선호 · 상대 · 누적 우승 · 최근 폼 · 전적/캐릭터별 · 게임 상세
const { esc, json, portrait, charName, isOfficial, avatar, nicknames, nameOf, userHref, num, gameTime, duration, tone, augmentIcons, coreIcon, bindTabs, hyphen, cardHead, tile, styleView } = GCB;
const $ = id => document.getElementById(id);
const PAGE = 15;
const FORM_GAMES = 20;

const raw = decodeURIComponent(location.pathname.split('/')[2] || '').trim();
const isUuid = /^[0-9a-f]{32}$|^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw);

async function findUuid() {
    if (isUuid) return hyphen(raw);
    const map = await nicknames();
    const lower = raw.toLowerCase();
    const known = Object.keys(map).find(u => map[u].toLowerCase() === lower);
    if (known) return known;
    const res = await json(`/api/uuid?nickname=${encodeURIComponent(raw)}`);
    return res?.uuid ? hyphen(res.uuid) : null;
}

function renderProfile(uuid, name, data) {
    const badge = data?.badge;
    const owned = (badge?.List || []).filter(b => b !== badge.current);
    const last = data?.games?.[0];
    const t = last ? gameTime(last.id) : null;
    $('profile').innerHTML = `
        ${avatar(uuid, 88, 'avatar-xl')}
        <div class="profile-info">
            <h1 class="profile-name">${esc(name)}${badge?.current ? `<img class="badge-img" src="/Resource/badge/${esc(badge.current)}.png" alt="" data-tip="대표 배지" onerror="this.remove()">` : ''}</h1>
            <div class="profile-meta">${t ? `최근 플레이 <b data-tip="${esc(t.short)}">${esc(t.ago)}</b>` : '기록된 게임이 없습니다'}</div>
            ${owned.length ? `<div class="badge-row" data-tip="보유 배지">${owned.map(b => `<img src="/Resource/badge/${esc(b)}.png" alt="" onerror="this.remove()">`).join('')}</div>` : ''}
        </div>`;
}

function renderSummary(s) {
    $('summary-card').innerHTML = cardHead('종합', '관리자 캐릭터 판을 뺀 전체 기록') + `<div class="tiles">
        ${tile('게임', s.games, `${s.wins}승`)}
        ${tile('승률', `${s.winRate}%`)}
        ${tile('순방률', `${s.top50Rate}%`, '', '상위 50% 이내로 끝낸 비율')}
        ${tile('평균 순위', `${s.avgRank}등`)}
        ${tile('평균 처치', s.avgKills, `최대 ${s.maxKills}`)}
        ${tile('평균 사망', s.avgDeaths)}
        ${tile('가한 피해', num(s.avgDamage), `최대 ${num(s.maxDealt)}`)}
        ${tile('받은 피해', num(s.avgTaken), `최대 ${num(s.maxTaken)}`)}
        ${tile('받은 회복', num(s.avgHeal))}
    </div>`;
}

function renderStyle(style, s) {
    $('style-card').innerHTML = style
        ? cardHead('플레이 성향', `5판 이상 플레이한 ${style.of}명 사이 백분위 (50 = 중간)`) + styleView(style, s)
        : cardHead('플레이 성향') + `<div class="empty">5판 이상 플레이하면 표시됩니다 (현재 ${s.games}판)</div>`;
}

function renderPrefs(data, names) {
    const card = $('prefs-card');
    if (!data.augments.length && !data.cores.length) { card.hidden = true; return; }
    const pick = (attrs, img, name, x) => `<button type="button" class="pick" ${attrs} data-tip="${esc(name)} · ${x.games}판 · 승률 ${x.winRate}%">${img}<small>${x.games}판</small></button>`;
    card.innerHTML = cardHead('자주 고른 증강') + `<div class="pick-grid">${data.augments.map(a => pick(`data-augment-id="${a.id}"`,
        `<img src="/Resource/augment/icon/${a.id}.png" alt="" onerror="this.src='/Resource/augment/icon/0.png'">`, names?.augments?.[a.id] || `증강 ${a.id}`, a)).join('')}</div>`
        + (data.cores.length ? cardHead('자주 쓴 코어') + `<div class="pick-grid">${data.cores.map(c => pick(`data-core-key="${esc(c.id)}"`,
            `<img src="/Resource/core/${esc(c.id)}.png" alt="" onerror="this.src='/Resource/core/0.png'">`, names?.cores?.[c.id] || c.id, c)).join('')}</div>` : '');
}

async function renderPeople(people) {
    const card = $('people-card');
    const groups = { nemesis: ['천적', '나를 가장 많이 처치', '회'], prey: ['먹잇감', '내가 가장 많이 처치', '회'], mates: ['자주 만난 유저', '같은 게임 참가', '판'] };
    const keys = Object.keys(groups).filter(k => people[k].length);
    if (!keys.length) { card.hidden = true; return; }
    const nick = await nicknames(keys.flatMap(k => people[k].map(p => p.uuid)));
    card.innerHTML = `<div class="card-head"><div class="tabs tabs-sm" id="people-tabs">${keys.map((k, i) => `<button data-period="${k}" class="${i ? '' : 'active'}" data-tip="${groups[k][1]}">${groups[k][0]}</button>`).join('')}</div></div><div class="list" id="people-list"></div>`;
    const show = key => {
        $('people-list').innerHTML = people[key].map(p => `<a class="list-row" href="${userHref(nick, p.uuid)}">${avatar(p.uuid, 28)}
            <span class="list-main"><b>${esc(nameOf(nick, p.uuid))}</b></span><span class="list-side"><b>${p.count}</b><small>${groups[key][2]}</small></span></a>`).join('');
    };
    show(bindTabs($('people-tabs'), show));
}

function renderLifetimeWins(wins, names) {
    const card = $('wins-card');
    if (!wins.length) { card.hidden = true; return; }
    card.innerHTML = cardHead('캐릭터별 누적 우승', '26.3 이전 기록을 포함한 캐릭터별 우승 수') + `<div class="win-grid">${wins.slice(0, 12).map(w =>
        `<a class="win-tile" ${isOfficial(w.id) ? `href="/character/${w.id}"` : ''} data-tip="${esc(charName(w.id, names))}"><img class="portrait" src="${portrait(w.id)}" alt=""><b>${w.wins}</b></a>`).join('')}</div>`;
}

// 최근 폼: 최근 20게임 순위 띠 + 10게임 이동평균 승률/순방률 (최근 40게임)
function renderForm(games, names) {
    const card = $('form-card');
    const recent = games.slice(0, FORM_GAMES);
    if (!recent.length) { card.hidden = true; return; }
    const wins = recent.filter(g => g.rank === 1).length;
    const top = recent.filter(g => g.rank != null && g.rank / g.players <= 0.5).length;
    const ranked = recent.filter(g => g.rank != null);
    const avgRank = ranked.length ? (ranked.reduce((a, g) => a + g.rank, 0) / ranked.length).toFixed(1) : '-';
    const per = key => (recent.reduce((a, g) => a + g[key], 0) / recent.length).toFixed(1);
    const strip = recent.slice().reverse().map(g => {
        const t = gameTime(g.id);
        return `<span class="form-cell tone-${tone(g.rank, g.players)}" data-tip="${esc(`${t.short} · ${charName(g.character, names)} · ${g.rank ?? '-'}/${g.players}등`)}">${g.rank ?? '-'}</span>`;
    }).join('');

    let trend = '';
    const chrono = games.slice(0, 49).reverse();
    if (chrono.length >= 12) {
        const WIN = 10;
        const points = [];
        for (let i = WIN - 1; i < chrono.length; i++) {
            const w = chrono.slice(i - WIN + 1, i + 1);
            points.push({ win: w.filter(g => g.rank === 1).length * 10, top: w.filter(g => g.rank != null && g.rank / g.players <= 0.5).length * 10 });
        }
        const W = 320, H = 96, P = 6;
        const x = i => P + i / (points.length - 1) * (W - P * 2);
        const y = v => H - P - v / 100 * (H - P * 2);
        const line = key => points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
        const last = points[points.length - 1];
        trend = `<div class="trend">
            <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="승률·순방률 추이">
                <line class="trend-mid" x1="${P}" y1="${y(50)}" x2="${W - P}" y2="${y(50)}"/>
                <polyline class="trend-top" points="${line('top')}"/><polyline class="trend-win" points="${line('win')}"/>
            </svg>
            <div class="legend"><span class="legend-win">승률 ${last.win}%</span><span class="legend-top">순방률 ${last.top}%</span><small>10게임 이동평균 · 최근 ${points.length + WIN - 1}게임</small></div>
        </div>`;
    }

    card.innerHTML = cardHead(`최근 ${recent.length}게임`) + `
        <div class="form-summary">
            <span><b>${wins}</b>승</span><span>순방 <b>${Math.round(top / recent.length * 100)}%</b></span>
            <span>평균 <b>${avgRank}</b>등</span><span><b>${per('kills')}</b>킬 <b>${per('deaths')}</b>데스</span>
        </div>
        <div class="form-strip">${strip}</div>${trend}`;
}

function gameRow(g, names) {
    const t = gameTime(g.id);
    return `<button type="button" class="game-row tone-${tone(g.rank, g.players)}${g.character >= 900 ? ' is-admin' : ''}" data-game="${esc(g.id)}">
        <span class="game-rank"><b>${g.rank != null ? `#${g.rank}` : '-'}</b><small>${g.players}명</small></span>
        <img class="portrait" src="${portrait(g.character)}" alt="">
        <span class="game-main"><b>${esc(charName(g.character, names))}</b><small data-tip="${esc(t.short)}">${esc(t.ago)}${g.duration ? ` · ${duration(g.duration)}` : ''}</small></span>
        <span class="game-kda"><b>${g.kills} / ${g.deaths}</b><small>처치 / 사망</small></span>
        <span class="game-dmg"><span><i>가한</i>${num(g.dealt)}</span><span><i>받은</i>${num(g.taken)}</span><span><i>회복</i>${num(g.heal)}</span></span>
        <span class="game-build">${augmentIcons(g.augments)}${coreIcon(g.core)}</span>
        ${g.quit ? '<span class="tag tag-danger">탈주</span>' : ''}
    </button>`;
}

function renderGames(games, names, uuid) {
    const listEl = $('game-list');
    const more = $('load-more');
    let shown = 0;
    const next = () => {
        listEl.insertAdjacentHTML('beforeend', games.slice(shown, shown + PAGE).map(g => gameRow(g, names)).join(''));
        shown += PAGE;
        more.hidden = shown >= games.length;
        more.textContent = `더보기 (${games.length - shown}판 남음)`;
    };
    if (!games.length) listEl.innerHTML = '<div class="empty">플레이 기록이 없습니다.</div>';
    else next();
    more.addEventListener('click', next);
    listEl.addEventListener('click', e => {
        const row = e.target.closest('.game-row');
        if (row) openGame(row.dataset.game, uuid, names);
    });
}

function renderCharacters(characters, names) {
    const { createSortableTable, bar } = StatsTable;
    createSortableTable($('tab-characters'), [
        {
            key: 'name', label: '캐릭터', defaultDir: 'asc', value: r => charName(r.id, names),
            render: r => {
                const inner = `<img class="portrait" src="${portrait(r.id)}" alt="" loading="lazy"><span>${esc(charName(r.id, names))}</span>`;
                return isOfficial(r.id) ? `<a class="entity" href="/character/${r.id}">${inner}</a>` : `<span class="entity">${inner}</span>`;
            },
        },
        { key: 'games', label: '게임', numeric: true, render: r => r.games },
        { key: 'winRate', label: '승률', numeric: true, render: r => `${r.winRate}%${bar(r.winRate * 3)}` },
        { key: 'top50Rate', label: '순방률', numeric: true, render: r => `${r.top50Rate}%${bar(r.top50Rate, 'green')}` },
        { key: 'avgRank', label: '평균 순위', numeric: true, defaultDir: 'asc', render: r => r.avgRank },
        { key: 'avgKills', label: '처치', numeric: true, render: r => r.avgKills },
        { key: 'avgDeaths', label: '사망', numeric: true, defaultDir: 'asc', render: r => r.avgDeaths },
        { key: 'avgDamage', label: '가한 피해', numeric: true, render: r => num(r.avgDamage) },
    ], { defaultSort: 'games', rank: false, emptyText: '캐릭터 기록이 없습니다.' }).setRows(characters);
}

async function openGame(id, me, names) {
    const modal = $('game-modal');
    const body = $('game-modal-body');
    body.innerHTML = '<div class="skeleton row"></div><div class="skeleton row"></div><div class="skeleton row"></div>';
    modal.style.display = 'flex';
    const game = await json(`/data/games/${id}.json`);
    if (!game) { body.innerHTML = '<div class="empty">게임 정보를 불러오지 못했습니다.</div>'; return; }
    const nick = await nicknames(game.rows.map(r => r.uuid));
    const maxDealt = Math.max(1, ...game.rows.map(r => r.dealt));
    const t = gameTime(id);
    body.innerHTML = `
        <div class="game-modal-head"><h2>${esc(t.short)}</h2><span>${game.players}명${game.duration ? ` · ${duration(game.duration)}` : ''}</span></div>
        <div class="table-wrap"><table class="data-table game-table">
            <thead><tr><th class="num">순위</th><th>플레이어</th><th class="num">처치/사망</th><th>가한 피해</th><th class="num">받은 피해</th><th class="num">회복</th><th>증강 · 코어</th></tr></thead>
            <tbody>${game.rows.map(r => `<tr class="tone-${tone(r.rank, game.players)}${r.uuid === me ? ' is-me' : ''}">
                <td class="num rank-cell">${r.rank ?? '-'}</td>
                <td><span class="entity">${isOfficial(r.character) ? `<a href="/character/${r.character}" data-tip="${esc(charName(r.character, names))}">` : `<span data-tip="${esc(charName(r.character, names))}">`}<img class="portrait" src="${portrait(r.character)}" alt="">${isOfficial(r.character) ? '</a>' : '</span>'}
                    ${avatar(r.uuid, 22)}<a class="player-link" href="${userHref(nick, r.uuid)}">${esc(nameOf(nick, r.uuid))}</a>${r.quit ? '<span class="tag tag-danger">탈주</span>' : ''}</span></td>
                <td class="num">${r.kills} / ${r.deaths}</td>
                <td><span class="dmg"><i style="width:${(r.dealt / maxDealt * 100).toFixed(1)}%"></i><b>${num(r.dealt)}</b></span></td>
                <td class="num">${num(r.taken)}</td>
                <td class="num">${num(r.heal)}</td>
                <td class="build">${augmentIcons(r.augments)}${coreIcon(r.core)}</td>
            </tr>`).join('')}</tbody>
        </table></div>`;
}

async function main() {
    if (!raw) { $('profile').innerHTML = '<div class="empty">닉네임이 없습니다.</div>'; return; }
    const [uuid, names] = await Promise.all([findUuid(), json('/data/names.json')]);
    if (!uuid) { $('profile').innerHTML = `<div class="empty">'${esc(raw)}' 유저를 찾을 수 없습니다.</div>`; return; }

    const [data, nick] = await Promise.all([json(`/data/user-statistics/${uuid}.json`), nicknames([uuid])]);
    const name = isUuid ? (nick[uuid] || raw) : raw;
    if (isUuid && nick[uuid]) history.replaceState(null, '', `/user/${encodeURIComponent(nick[uuid])}`);
    document.title = `${name} - GCB.gg 전적`;
    renderProfile(uuid, name, data);
    if (!data) return;

    $('user-layout').hidden = false;
    renderSummary(data.stats);
    renderStyle(data.style, data.stats);
    renderPrefs(data, names);
    renderLifetimeWins(data.lifetimeWins, names);
    renderForm(data.games, names);
    renderGames(data.games, names, uuid);
    renderCharacters(data.characters, names);
    bindTabs($('user-tabs'), tab => {
        $('tab-games').hidden = tab !== 'games';
        $('tab-characters').hidden = tab !== 'characters';
    });
    renderPeople(data.people);
}

main();
