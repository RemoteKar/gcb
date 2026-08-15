document.addEventListener("DOMContentLoaded", async () => {
    const listEl = document.getElementById('pn-list');
    const searchEl = document.getElementById('pn-search');
    const moreBtn = document.getElementById('pn-more');
    const PAGE = 15;
    const PREVIEW_LINES = 12;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // "A -> B" 수치 변경 강조, "이름:" 헤더 강조
    function formatBody(body) {
        return body.split('\n').map(line => {
            const t = esc(line);
            if (/^\S.*:\s*$/.test(line) && !/->|→/.test(line)) return `<span class="pn-h">${t}</span>`;
            return t.replace(/(.*?)(\s*(?:->|→)\s*)(.*)/, (all, a, arrow, b) =>
                `<span class="pn-old">${a}</span><span class="pn-arrow">${arrow}</span><span class="pn-new">${b}</span>`);
        }).join('\n');
    }

    let notes = [];
    let filtered = [];
    let shown = 0;

    function noteHtml(n, idx) {
        const lines = n.body.split('\n');
        const long = lines.length > PREVIEW_LINES;
        const preview = long ? lines.slice(0, PREVIEW_LINES).join('\n') : n.body;
        return `
            <article class="patchnote-card" data-idx="${idx}">
                <header class="patchnote-head">
                    <span class="pn-date">${esc(n.date)}</span>
                    <h2 class="pn-title">${esc(n.title)}</h2>
                    ${n.source ? `<a class="pn-source" href="${esc(n.source)}" target="_blank" rel="noopener">원문 ↗</a>` : ''}
                </header>
                <pre class="patchnote-body${long ? ' collapsed' : ''}" data-full="${esc(n.body)}">${formatBody(preview)}</pre>
                ${long ? `<button type="button" class="pn-expand">전체 보기 (${lines.length}줄)</button>` : ''}
            </article>`;
    }

    function renderMore() {
        const slice = filtered.slice(shown, shown + PAGE);
        listEl.insertAdjacentHTML('beforeend', slice.map((n, i) => noteHtml(n, shown + i)).join(''));
        shown += slice.length;
        moreBtn.style.display = shown < filtered.length ? '' : 'none';
        moreBtn.textContent = `더보기 (${filtered.length - shown}개 남음)`;
    }

    listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.pn-expand');
        if (!btn) return;
        const card = btn.closest('.patchnote-card');
        const pre = card.querySelector('.patchnote-body');
        const expanded = pre.classList.toggle('collapsed') === false;
        const n = filtered[Number(card.dataset.idx)];
        pre.innerHTML = formatBody(expanded ? n.body : n.body.split('\n').slice(0, PREVIEW_LINES).join('\n'));
        btn.textContent = expanded ? '접기' : `전체 보기 (${n.body.split('\n').length}줄)`;
    });

    function applyFilter() {
        const q = searchEl.value.trim().toLowerCase();
        filtered = q ? notes.filter(n => (n.title + '\n' + n.body).toLowerCase().includes(q)) : notes;
        shown = 0;
        listEl.innerHTML = filtered.length ? '' : '<div class="empty-state">검색 결과가 없습니다.</div>';
        if (filtered.length) renderMore();
        else moreBtn.style.display = 'none';
    }

    try {
        const res = await fetch('/data/patchnotes.json');
        if (!res.ok) throw new Error('load failed');
        notes = (await res.json()).notes || [];
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state">패치노트를 불러오지 못했습니다.</div>';
        return;
    }

    if (notes.length === 0) {
        listEl.innerHTML = '<div class="empty-state">등록된 패치노트가 없습니다.</div>';
        return;
    }

    searchEl.addEventListener('input', applyFilter);
    moreBtn.addEventListener('click', renderMore);
    applyFilter();
});
