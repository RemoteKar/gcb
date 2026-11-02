// 캐릭터 · 증강 · 코어 목록 (<body data-catalog="character|augment|core">): 아이콘 + 이름 격자, 이름 검색
const { esc, json, portrait, isOfficial } = GCB;
const grid = document.getElementById('catalog-grid');
const search = document.getElementById('catalog-search');

const SOURCES = {
    character: async () => Object.entries((await json('/data/names.json'))?.characters || {})
        .filter(([id]) => isOfficial(id)).sort((a, b) => a[0] - b[0])
        .map(([id, name]) => ({ name, tag: `a href="/character/${id}"`, img: portrait(id), fallback: '/Resource/character/0.png' })),
    augment: async () => ((await json('/data/augments.json')) || [])
        .map(a => ({ name: a.name, tag: `button type="button" data-augment-id="${a.id}"`, img: `/Resource/augment/icon/${a.id}.png`, fallback: '/Resource/augment/icon/0.png' })),
    core: async () => ((await json('/data/cores.json')) || [])
        .map(c => ({ name: c.name, tag: `button type="button" data-core-key="${esc(c.id)}"`, img: `/Resource/core/${esc(c.id)}.png`, fallback: '/Resource/core/0.png' })),
};

const items = await SOURCES[document.body.dataset.catalog]();
grid.innerHTML = items.length
    ? items.map(it => `<${it.tag} class="icon-tile" data-name="${esc(it.name.toLowerCase())}">
        <img src="${it.img}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${it.fallback}'"><span>${esc(it.name)}</span></${it.tag.split(' ')[0]}>`).join('')
    : '<div class="empty">목록을 불러오지 못했습니다.</div>';

search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let visible = 0;
    grid.querySelectorAll('.icon-tile').forEach(el => {
        el.hidden = !!q && !el.dataset.name.includes(q);
        if (!el.hidden) visible++;
    });
    grid.classList.toggle('no-result', visible === 0);
});
