// 캐릭터 상세: 스탯(정식 캐릭터 중 순위) · 실전 통계(기간별 요약·순위 분포·자주 고른 증강/코어) · 성향 · 많이 하는 유저 · 스킬 · 댓글
const { esc, json, mc, portrait, num, avatar, nicknames, nameOf, userHref, bindTabs, cardHead, tile, styleView, pager } = GCB;
const $ = id => document.getElementById(id);
const id = Number(location.pathname.split('/').pop());
const PERIODS = [['recent60', '최근 60게임'], ['recent200', '최근 200게임'], ['all', '전체']];
const TIERS = ['1등', '상위 25%', '상위 50%', '상위 75%', '하위 25%'];

const data = Number.isInteger(id) && id > 0 ? await json(`/data/characters/${id}.json`) : null;

function renderHero(c) {
    document.title = `${c.name} - GCB.gg`;
    const bars = Object.entries(c.stat).map(([k, v]) => {
        const r = c.statRanks[k];
        const pct = r ? (r.of - r.rank + 1) / r.of * 100 : 0;
        return `<div class="stat-bar"${r ? ` data-tip="${esc(`정식 캐릭터 ${r.of}명 중 ${r.rank}위`)}"` : ''}>
            <small>${esc(k)}</small><span class="meter"><i style="width:${pct.toFixed(0)}%"></i></span><b>${esc(v)}</b></div>`;
    }).join('');
    $('char-hero').innerHTML = `<img class="char-portrait" src="${portrait(c.id)}" alt="">
        <div class="char-title"><h1>${esc(c.name)}</h1>${bars ? `<div class="stat-bars">${bars}</div>` : ''}</div>`;
}

const tierBar = s => `<h3 class="sub-head">순위 분포</h3>
    <div class="tier-bar">${s.tiers.map((n, i) => (n ? `<i class="t${i}" style="width:${(n / s.games * 100).toFixed(1)}%" data-tip="${TIERS[i]} ${n}판 (${Math.round(n / s.games * 100)}%)"></i>` : '')).join('')}</div>
    <div class="tier-legend">${TIERS.map((label, i) => `<span class="t${i}">${label}</span>`).join('')}</div>`;

const picks = (title, items, attr, icon) => (items.length ? `<h3 class="sub-head">${title}</h3><div class="pick-grid">${items.map(x =>
    `<button type="button" class="pick" ${attr(x)} data-tip="${esc(`${x.name || x.id} · ${x.games}픽 · 승률 ${x.winRate}%`)}">${icon(x)}<small>${x.games}픽</small></button>`).join('')}</div>` : '');

function renderLive(c) {
    const card = $('live-card');
    if (!Object.values(c.live).some(Boolean)) {
        card.innerHTML = cardHead('실전 통계') + '<div class="empty">아직 플레이 기록이 없습니다.</div>';
        return;
    }
    card.innerHTML = `<div class="card-head"><h2>실전 통계</h2><div class="tabs tabs-sm" id="live-tabs">${PERIODS.map(([p, label], i) =>
        `<button data-period="${p}"${i ? '' : ' class="active"'}>${label}</button>`).join('')}</div></div><div id="live-body"></div>`;
    const show = p => {
        const s = c.live[p];
        $('live-body').innerHTML = !s ? `<div class="empty">${PERIODS.find(x => x[0] === p)[1]} 동안 기록이 없습니다.</div>` : `
            <div class="tiles">
                ${tile('픽', s.games, `픽률 ${s.pickRate}%`, '픽률 = 픽 수 / 기간 전체 참가자 수')}
                ${tile('승률', `${s.winRate}%`, `${s.wins}승`)}
                ${tile('순방률', `${s.top50Rate}%`, '', '상위 50% 이내로 끝낸 비율')}
                ${tile('평균 순위', `${s.avgRank}등`)}
                ${tile('처치 / 사망', `${s.avgKills} / ${s.avgDeaths}`)}
                ${tile('가한 피해', num(s.avgDamage), `받은 ${num(s.avgTaken)}`)}
            </div>
            ${tierBar(s)}
            ${picks('자주 고른 증강', s.augments, x => `data-augment-id="${x.id}"`, x => `<img src="/Resource/augment/icon/${x.id}.png" alt="" loading="lazy" onerror="this.onerror=null;this.src='/Resource/augment/icon/0.png'">`)}
            ${picks('자주 쓴 코어', s.cores, x => `data-core-key="${esc(x.id)}"`, x => `<img src="/Resource/core/${esc(x.id)}.png" alt="" loading="lazy" onerror="this.onerror=null;this.src='/Resource/core/0.png'">`)}`;
    };
    show(bindTabs($('live-tabs'), show));
}

function renderStyle(c) {
    if (!c.style) { $('style-card').hidden = true; return; }
    $('style-card').innerHTML = cardHead('캐릭터 성향', `전체 기록 5판 이상인 캐릭터 ${c.style.of}개 사이 백분위 (50 = 중간)`) + styleView(c.style, c.live.all);
}

async function renderMains(mains) {
    if (!mains.length) { $('mains-card').hidden = true; return; }
    const nick = await nicknames(mains.map(m => m.uuid));
    $('mains-card').innerHTML = cardHead('많이 하는 유저', '전체 기록에서 2판 이상') + `<div class="list">${mains.map((m, i) => `
        <a class="list-row" href="${userHref(nick, m.uuid)}"><span class="rank-num r${i + 1}">${i + 1}</span>${avatar(m.uuid, 28)}
            <span class="list-main"><b>${esc(nameOf(nick, m.uuid))}</b><small>${m.wins}승</small></span>
            <span class="list-side"><b>${m.games}판</b><small>승률 ${m.winRate}%</small></span></a>`).join('')}</div>`;
}

function renderSkills(skills) {
    $('skills-card').innerHTML = cardHead('스킬') + skills.map(s => `<article class="skill">
        <div class="skill-head"><span class="skill-type${s.type === '궁극기' ? ' ult' : ''}">${esc(s.type)}</span><h3 class="skill-name">${esc(s.name || '이름 없음')}</h3>${s.link ? `<a class="skill-link" href="${esc(s.link)}">자세히 →</a>` : ''}</div>
        <div class="mc-text">${mc(s.description)}</div>
    </article>`).join('');
}

// ---- 댓글 (비로그인: 닉네임/비밀번호 매번 입력) ----
const two = n => String(n).padStart(2, '0');
const when = iso => { const d = new Date(iso); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`; };
const send = (url, method, body) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
    .catch(() => ({ ok: false, data: {} }));
let commentPage = 1;

async function loadComments(page = commentPage) {
    commentPage = page;
    const res = await fetch(`/api/character-comments?id=${id}&page=${page}`).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const list = $('comments-list');
    if (!res) {
        list.innerHTML = '<div class="empty">댓글을 불러올 수 없습니다.</div>';
        return;
    }
    $('comment-total').textContent = res.totalCount || '';
    list.innerHTML = res.comments.length ? res.comments.map(c => `<div class="comment">
        <div class="comment-head"><b>${esc(c.nickname)}</b><span class="ip">(${esc(c.ipPrefix)})</span><time>${when(c.createdAt)}</time><button type="button" class="btn btn-xs btn-ghost" data-delete="${c.id}">삭제</button></div>
        <div class="comment-body">${esc(c.content)}</div>
    </div>`).join('') : '<div class="empty">아직 댓글이 없습니다.</div>';
    pager($('comments-pager'), page, res.totalPages, loadComments);
}

function bindComments() {
    const form = $('comment-form');
    const content = $('comment-content');
    const error = $('comment-error');
    content.addEventListener('input', () => { $('comment-count').textContent = `${content.value.length} / 300`; });
    form.addEventListener('submit', async e => {
        e.preventDefault();
        error.textContent = '';
        $('comment-submit').disabled = true;
        const { ok, data: d } = await send('/api/character-comments', 'POST', {
            characterId: id, nickname: $('comment-nickname').value.trim(), password: $('comment-password').value, content: content.value.trim(),
        });
        $('comment-submit').disabled = false;
        if (!ok) { error.textContent = d.error || '작성에 실패했습니다.'; return; }
        content.value = '';
        $('comment-count').textContent = '0 / 300';
        loadComments(1);
    });
    $('comments-list').addEventListener('click', async e => {
        const btn = e.target.closest('[data-delete]');
        if (!btn) return;
        const password = prompt('비밀번호를 입력하세요.');
        if (!password) return;
        const { ok, data: d } = await send(`/api/character-comments/${btn.dataset.delete}`, 'DELETE', { password });
        if (!ok) { alert(d.error || '삭제에 실패했습니다.'); return; }
        loadComments();
    });
}

if (!data) {
    $('char-hero').innerHTML = '<div class="empty">캐릭터 정보를 찾을 수 없습니다.</div>';
} else {
    renderHero(data);
    $('char-layout').hidden = false;
    renderSkills(data.skills);
    renderLive(data);
    renderStyle(data);
    renderMains(data.mains);
    bindComments();
    loadComments(1);
}
