// 메인: 검색 · 최근 게임 · 랭킹 TOP5 · 최근 60게임 승리 캐릭터 · 인기 증강
const { esc, json, portrait, charName, avatar, nicknames, nameOf, userHref, num, gameTime, duration } = GCB;
const $ = id => document.getElementById(id);

const list = (el, items, render, empty) => {
    el.innerHTML = items?.length ? items.map(render).join('') : `<div class="empty">${empty}</div>`;
};

const [home, leaderboard, names, augmentStats] = await Promise.all([
    json('/data/home.json'), json('/data/leaderboard.json'), json('/data/names.json'), json('/data/augment-stats.json'),
]);

if (home) {
    const last = home.recentGames[0];
    $('hero-stats').innerHTML = [
        ['기록된 게임', `${num(home.totalGames)}판`],
        ['랭킹 유저', `${(leaderboard || []).length}명`],
        last && ['마지막 게임', gameTime(last.id).ago],
    ].filter(Boolean).map(([label, value]) => `<span class="hero-stat"><small>${label}</small><b>${esc(value)}</b></span>`).join('');
}

list($('home-top-players'), (leaderboard || []).slice(0, 5), (p, i) => `
    <a class="list-row" href="/user/${encodeURIComponent(p.nickname)}">
        <span class="rank-num r${i + 1}">${i + 1}</span>${avatar(p.uuid, 32)}
        <span class="list-main"><b>${esc(p.nickname)}</b><small>${p.games}판 · 승률 ${p.winRate}%</small></span>
        <span class="list-side"><b>${num(p.mmr)}</b><small>MMR</small></span>
    </a>`, '랭킹 데이터 없음');

list($('home-top-characters'), home?.topCharacters, (c, i) => `
    <a class="list-row" href="/character/${c.id}">
        <span class="rank-num r${i + 1}">${i + 1}</span><img class="portrait" src="${portrait(c.id)}" alt="">
        <span class="list-main"><b>${esc(charName(c.id, names))}</b><small>${c.games}픽 · 승률 ${c.winRate}%</small></span>
        <span class="list-side"><b>${c.wins}</b><small>승</small></span>
    </a>`, '데이터 없음');

list($('home-top-augments'), (augmentStats?.recent60 || []).slice(0, 5), (a, i) => `
    <button type="button" class="list-row" data-augment-id="${a.id}">
        <span class="rank-num r${i + 1}">${i + 1}</span><img class="aug-icon" src="/Resource/augment/icon/${a.id}.png" alt="">
        <span class="list-main"><b>${esc(names?.augments?.[a.id] || `증강 ${a.id}`)}</b><small>픽률 ${a.pickRate}% · 승률 ${a.winRate}%</small></span>
        <span class="list-side"><b>${a.games}</b><small>픽</small></span>
    </button>`, '데이터 없음');

const recent = home?.recentGames || [];
const nick = await nicknames(recent.map(g => g.winner?.uuid).filter(Boolean));
list($('home-recent-games'), recent, g => {
    const w = g.winner;
    const t = gameTime(g.id);
    return `
    <a class="list-row" href="${w ? userHref(nick, w.uuid) : '#'}">
        <span class="duo"><img class="portrait" src="${portrait(w?.character)}" alt="">${w ? avatar(w.uuid, 22, 'duo-badge') : ''}</span>
        <span class="list-main"><b><i class="crown" aria-label="우승"></i>${w ? esc(nameOf(nick, w.uuid)) : '-'}</b><small>${esc(charName(w?.character, names))} · ${w?.kills ?? 0}킬 ${w?.deaths ?? 0}데스</small></span>
        <span class="list-side"><b data-tip="${esc(t.short)}">${esc(t.ago)}</b><small>${g.players}명 · ${duration(g.duration)}</small></span>
    </a>`;
}, '게임 기록 없음');

// 테스트 서버가 열려 있을 때만 배너 (testserver.html 과 같은 주소)
try {
    const d = await (await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent('gcbpbe.duckdns.org:25565')}`, { cache: 'no-store' })).json();
    if (d?.online === true) {
        const pl = d.players || {};
        $('ts-banner-players').textContent = `${pl.online ?? 0}/${pl.max ?? 0}`;
        $('ts-banner-heads').innerHTML = (pl.list || []).slice(0, 8).map(p => `<img src="https://mc-heads.net/avatar/${encodeURIComponent(p.uuid || p.name)}/32" alt="" title="${esc(p.name)}" width="20" height="20" onerror="this.style.display='none'">`).join('');
        $('ts-banner').hidden = false;
    }
} catch (e) { /* 배너 없이 */ }
