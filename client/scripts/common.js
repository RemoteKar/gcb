// 모든 페이지 공용: 상단 메뉴 + window.GCB 함수 모음
// <body> 맨 앞에서 (character-config.js 다음) 동기 로드 → 헤더가 늦게 그려져 깜빡이지 않게
(function () {
    const here = location.pathname;
    const NAV = [
        ['/ranking.html', '랭킹', /^\/ranking/],
        ['/character.html', '캐릭터', /^\/(character|weapon|titan)/],
        ['/augment.html', '증강', /^\/augment/],
        ['/core.html', '코어', /^\/core/],
        ['/patchnotes.html', '패치노트', /^\/patchnotes/],
        ['/feedback.html', '건의/버그', /^\/feedback/, 'nav-feedback'],
    ];
    document.currentScript.insertAdjacentHTML('afterend', `
<header class="site-header"><div class="site-header-inner">
  <a href="/" class="logo">GCB<span>.GG</span></a>
  <nav class="nav">${NAV.map(([href, label, re, cls]) => `<a href="${href}" class="${[cls, re.test(here) ? 'active' : ''].filter(Boolean).join(' ')}">${label}</a>`).join('')}</nav>
  ${/^\/(index\.html)?$/.test(here) ? '' : '<form class="header-search" data-user-search role="search"><input type="search" name="q" placeholder="닉네임 검색" autocomplete="off" aria-label="닉네임 검색"></form>'}
</div></header>`);

    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // 같은 주소는 한 번만 받는다 (페이지 안에서 여러 모듈이 names.json 등을 같이 씀)
    const requests = new Map();
    const json = url => {
        if (!requests.has(url)) requests.set(url, fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null));
        return requests.get(url);
    };

    // 마인크래프트 색코드(&0~f, §x§r§r§g§g§b§b, &r) + 줄바꿈 → HTML (나머지 서식 코드는 버림)
    const MC = { 0: '#000000', 1: '#0000AA', 2: '#00AA00', 3: '#00AAAA', 4: '#AA0000', 5: '#AA00AA', 6: '#FFAA00', 7: '#AAAAAA', 8: '#555555', 9: '#5555FF', a: '#55FF55', b: '#55FFFF', c: '#FF5555', d: '#FF55FF', e: '#FFFF55', f: '#FFFFFF' };
    function mc(text) {
        let color = null;
        let html = '';
        for (const part of String(text ?? '').replace(/\\n/g, '\n').split(/([§&]x(?:[§&][0-9a-f]){6}|[§&][0-9a-fk-or])/i)) {
            if (!part) continue;
            if (/^[§&]x[§&]/i.test(part)) color = '#' + part.slice(2).replace(/[§&]/g, '');
            else if (/^[§&][0-9a-f]$/i.test(part)) color = MC[part[1].toLowerCase()];
            else if (/^[§&][k-or]$/i.test(part)) { if (/r/i.test(part[1])) color = null; }
            else html += `<span${color ? ` style="color:${color}"` : ''}>${esc(part).replace(/\n/g, '<br>')}</span>`;
        }
        return html;
    }

    const config = () => window.CharacterConfig;
    const isCreative = id => !!config()?.isCreativeCharacter(id);
    // 캐릭터 정보 페이지가 있는 정식 캐릭터 (창작 100~899·관리자 900+ 제외)
    const isOfficial = id => Number(id) > 0 && Number(id) < 900 && !isCreative(id);
    const portrait = id => (Number(id) > 0 && !isCreative(id) ? `/Resource/character/${id}.png` : '/Resource/character/0.png');
    const charName = (id, names) => {
        if (id == null || Number(id) === 0) return '알 수 없음';
        if (isCreative(id)) return config().getCreativeCharacterName(id);
        return names?.characters?.[id] || `캐릭터 ${id}`;
    };

    const strip = uuid => String(uuid).replace(/-/g, '').toLowerCase();
    const hyphen = uuid => strip(uuid).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    const avatar = (uuid, size, cls = '') => {
        const u = strip(uuid);
        return `<img class="avatar ${cls}" src="https://mc-heads.net/avatar/${u}/${size}" width="${size}" height="${size}" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://crafatar.com/avatars/${u}?size=${size}&overlay'">`;
    };

    // uuid → 닉네임. 빌드 때 만든 nicknames.json 을 쓰고, 거기 없는 것만 /api/profiles 로 묻는다
    let nicknameMap = null;
    async function nicknames(uuids = []) {
        nicknameMap = nicknameMap || json('/data/nicknames.json').then(d => ({ ...(d || {}) }));
        const map = await nicknameMap;
        const missing = [...new Set(uuids.map(hyphen))].filter(u => !map[u]).slice(0, 50);
        if (missing.length) {
            const found = await fetch(`/api/profiles?uuids=${missing.map(strip).join(',')}`).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
            for (const [u, name] of Object.entries(found)) map[hyphen(u)] = name;
        }
        return map;
    }
    const nameOf = (map, uuid) => map[hyphen(uuid)] || strip(uuid).slice(0, 8);
    const userHref = (map, uuid) => `/user/${encodeURIComponent(map[hyphen(uuid)] || strip(uuid))}`;

    const num = n => Number(n || 0).toLocaleString('ko-KR');
    // 게임 id = KST "yyyy.MM.dd-HH.mm.ss"
    function gameTime(id) {
        const m = /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})/.exec(id || '');
        if (!m) return { short: id || '-', ago: '' };
        const minutes = (Date.now() - Date.UTC(m[1], m[2] - 1, m[3], m[4] - 9, m[5])) / 60000;
        const ago = minutes < 60 ? `${Math.max(1, Math.round(minutes))}분 전`
            : minutes < 1440 ? `${Math.round(minutes / 60)}시간 전`
            : minutes < 43200 ? `${Math.round(minutes / 1440)}일 전` : `${m[1]}.${m[2]}.${m[3]}`;
        return { short: `${m[2]}.${m[3]} ${m[4]}:${m[5]}`, ago };
    }
    const duration = s => (s > 0 ? `${Math.floor(s / 60)}분 ${s % 60}초` : '');
    // 결과 색: 1등 / 상위 25% / 하위 25% / 그 사이
    const tone = (rank, players) => (rank === 1 ? 'win' : rank == null ? 'mid' : rank / players < 0.25 ? 'top' : rank / players >= 0.75 ? 'low' : 'mid');

    const augmentIcons = augments => (augments || []).map(id => (id != null
        ? `<img class="aug-icon" src="/Resource/augment/icon/${id}.png" alt="" data-augment-id="${id}" loading="lazy" onerror="this.onerror=null;this.src='/Resource/augment/icon/0.png'">`
        : '<img class="aug-icon empty" src="/Resource/augment/icon/level.png" alt="">')).join('');
    const coreIcon = core => {
        if (!core) return '';
        const key = String(core).replace(/[^\w-]/g, '');
        return `<img class="core-icon" src="/Resource/core/${key}.png" alt="" data-core-key="${key}" loading="lazy" onerror="this.onerror=null;this.src='/Resource/core/0.png'">`;
    };

    // 기간 탭 (button[data-period]) → cb(period), 처음 활성 탭을 돌려줌
    function bindTabs(el, cb) {
        el.addEventListener('click', e => {
            const btn = e.target.closest('button[data-period]');
            if (!btn || btn.classList.contains('active')) return;
            el.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
            cb(btn.dataset.period);
        });
        return el.querySelector('button.active')?.dataset.period;
    }

    // 페이지 번호 (현재 ±2, ‹ ›) → onPage(번호)
    function pager(el, page, totalPages, onPage) {
        if (!(totalPages > 1)) { el.innerHTML = ''; return; }
        const btn = (label, p, cls = '') => `<button type="button" data-page="${p}"${cls ? ` class="${cls}"` : ''}${p < 1 || p > totalPages ? ' disabled' : ''}>${label}</button>`;
        let nums = '';
        for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) nums += btn(p, p, p === page ? 'active' : '');
        el.innerHTML = btn('‹', page - 1) + nums + btn('›', page + 1);
        el.onclick = e => {
            const b = e.target.closest('button[data-page]');
            if (b && !b.disabled && !b.classList.contains('active')) onPage(Number(b.dataset.page));
        };
    }

    const cardHead = (title, tip = '') => `<div class="card-head"><h2${tip ? ` data-tip="${esc(tip)}"` : ''}>${title}${tip ? ' <i class="info-dot"></i>' : ''}</h2></div>`;
    const tile = (label, value, sub = '', tip = '') => `<div class="tile"${tip ? ` data-tip="${esc(tip)}"` : ''}><small>${label}</small><b>${value}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;

    // 플레이 성향 6축 (빌드 STYLE_AXES 와 같은 키): [키, 이름, 설명, 값 표시(요약 통계), 성향 이름]
    const STYLE_AXES = [
        ['dealt', '화력', '판당 가한 피해', s => num(s.avgDamage), '화력형'],
        ['kills', '처치', '판당 처치', s => `${s.avgKills}킬`, '킬러형'],
        ['place', '순위', '판마다 이긴 사람 비율', s => `${s.avgPlace}%`, '운영형'],
        ['survive', '생존', '판당 사망 (적을수록 높음)', s => `${s.avgDeaths}회`, '생존형'],
        ['heal', '회복', '판당 받은 회복', s => num(s.avgHeal), '유지력형'],
        ['taken', '맷집', '판당 받은 피해', s => num(s.avgTaken), '탱커형'],
    ];

    // 성향 = 대표 유형 + 육각 그래프 + 강한 축 칩. style = { of, pct: {축: 0~100} }, s = 요약 통계(값 표시용)
    function styleView(style, s) {
        const W = 240, H = 220, CX = 120, CY = 112, R = 78;
        const point = (i, r) => {
            const a = (-90 + i * 60) * Math.PI / 180;
            return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
        };
        const xy = ([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`;
        const poly = r => STYLE_AXES.map((_, i) => xy(point(i, r))).join(' ');
        const top = k => Math.max(1, 100 - style.pct[k]);
        const values = STYLE_AXES.map(([k], i) => point(i, R * Math.max(0.05, style.pct[k] / 100)));
        const labels = STYLE_AXES.map(([k, label, desc, value], i) => {
            const [x, y] = point(i, R + 24);
            return `<span class="radar-label" style="left:${(x / W * 100).toFixed(1)}%;top:${(y / H * 100).toFixed(1)}%" data-tip="${esc(`${label} · ${desc}: ${value(s)} (상위 ${top(k)}%)`)}">${label}<b>${style.pct[k]}</b></span>`;
        }).join('');
        const strong = STYLE_AXES.filter(([k]) => style.pct[k] >= 60).sort((a, b) => style.pct[b[0]] - style.pct[a[0]]).slice(0, 2);
        return `<div class="style-type">${strong.length ? strong[0][4] : '밸런스형'}</div>
            <div class="radar">
                <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="성향 육각 그래프">
                    ${[0.25, 0.75, 1].map(f => `<polygon class="radar-grid" points="${poly(R * f)}"/>`).join('')}
                    <polygon class="radar-mid" points="${poly(R * 0.5)}"/>
                    ${STYLE_AXES.map((_, i) => { const [x, y] = point(i, R); return `<line class="radar-grid" x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('')}
                    <polygon class="radar-area" points="${values.map(xy).join(' ')}"/>
                    ${values.map(([x, y]) => `<circle class="radar-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`).join('')}
                </svg>${labels}
            </div>
            ${strong.length ? `<div class="chips">${strong.map(([k, label]) => `<span class="chip chip-brand">${label} 상위 ${top(k)}%</span>`).join('')}</div>` : ''}`;
    }

    // data-tip 툴팁: 떠 있는 요소 하나를 옮겨 쓴다 (img 처럼 ::after 가 안 되는 요소에도 뜨게)
    const tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
    let tipFor = null;
    function showTip(e) {
        const el = e.target.closest?.('[data-tip]');
        if (el === tipFor) return;
        tipFor = el;
        tipEl.hidden = !el?.dataset.tip;
        if (tipEl.hidden) return;
        tipEl.textContent = el.dataset.tip;
        const r = el.getBoundingClientRect();
        const x = Math.min(Math.max(8, r.left + r.width / 2 - tipEl.offsetWidth / 2), innerWidth - tipEl.offsetWidth - 8);
        const above = r.top - tipEl.offsetHeight - 8;
        tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(above < 8 ? r.bottom + 8 : above)}px)`;
    }
    const hideTip = () => { tipEl.hidden = true; tipFor = null; };
    document.addEventListener('mouseover', showTip);
    document.addEventListener('focusin', showTip);
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) hideTip(); });
    addEventListener('scroll', hideTip, { passive: true });

    document.addEventListener('submit', e => {
        const form = e.target.closest('form[data-user-search]');
        if (!form) return;
        e.preventDefault();
        const q = form.q.value.trim();
        if (q) location.href = `/user/${encodeURIComponent(q)}`;
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => { m.style.display = 'none'; });
    });
    document.addEventListener('click', e => {
        const overlay = e.target.closest('.modal-overlay');
        if (overlay && (e.target === overlay || e.target.closest('.modal-close'))) overlay.style.display = 'none';
    });

    window.GCB = { esc, json, mc, isCreative, isOfficial, portrait, charName, strip, hyphen, avatar, nicknames, nameOf, userHref, num, gameTime, duration, tone, augmentIcons, coreIcon, bindTabs, pager, cardHead, tile, styleView };
})();
