// 스킬에서 이어지는 페이지 (<body data-page>): weapon = /weapon/{id} 무기 목록 · titans = /titan/{스킬} 타이탄 목록 · titan = /titan/{스킬}/{타이탄}
const { esc, json, mc } = GCB;
const [, , first, second] = location.pathname.split('/').map(decodeURIComponent);
const title = new URLSearchParams(location.search).get('name');
const img = (src, cls) => (src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : '');
const skill = (type, s, extra = '') => `<article class="skill"><div class="skill-head"><span class="skill-type">${type}</span><h3 class="skill-name">${esc(s.name || '이름 없음')}</h3></div><div class="mc-text">${mc(s.description)}</div>${extra}</article>`;

const PAGES = {
    async weapon() {
        const list = await json(`/data/weapons/${encodeURIComponent(first)}.json`);
        document.getElementById('page-title').textContent = title || first;
        return list?.length && list.map(w => `<article class="card entry">${img(w.img, 'entry-img')}
            <div><h2>${esc(w.name || w.id)}</h2><div class="mc-text">${mc(w.description)}</div></div></article>`).join('');
    },
    async titans() {
        const data = await json('/data/titans.json');
        if (title) document.getElementById('page-title').textContent = title;
        const pistol = data?.smartPistol;
        return data?.titans?.length && data.titans.map(t => `<a class="card titan-card" href="/titan/${encodeURIComponent(first)}/${encodeURIComponent(t.id)}?name=${encodeURIComponent(t.name)}">
            ${img(t.img, 'titan-img')}<h2>${esc(t.name)}</h2><div class="mc-text">${mc(t.description)}</div></a>`).join('')
            + (pistol ? `<article class="card titan-card"><h2>${esc(pistol.name || '스마트 피스톨')}</h2><div class="mc-text">${mc(pistol.description)}</div></article>` : '');
    },
    async titan() {
        const t = await json(`/data/titans/${encodeURIComponent(second)}.json`);
        if (!t) { document.getElementById('titan-hero').hidden = true; return null; }
        const name = title || t.name || second;
        document.title = `${name} - GCB.gg`;
        document.getElementById('titan-hero').innerHTML = `${img(t.img, 'char-portrait')}<div class="char-title"><h1>${esc(name)}</h1><div class="mc-text">${mc(t.description)}</div></div>`;
        return [
            t.passive && skill('패시브', t.passive),
            ...t.skills.map((s, i) => skill(`스킬 ${i + 1}`, s)),
            t.weapon && skill('기본 공격', t.weapon, img(t.weapon.img, 'entry-img')),
        ].filter(Boolean).join('');
    },
};

const html = await PAGES[document.body.dataset.page]();
document.getElementById('entries').innerHTML = html || '<div class="empty">정보를 찾을 수 없습니다.</div>';
