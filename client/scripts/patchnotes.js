document.addEventListener("DOMContentLoaded", async () => {
    const listEl = document.getElementById('pn-list');
    const searchEl = document.getElementById('pn-search');
    const moreBtn = document.getElementById('pn-more');
    const sourceEl = document.getElementById('pn-source');
    const PAGE = 30;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    let posts = [];
    let filtered = [];
    let shown = 0;

    function renderMore() {
        const slice = filtered.slice(shown, shown + PAGE);
        shown += slice.length;
        listEl.insertAdjacentHTML('beforeend', slice.map(p => `
            <a class="patchnote-item" href="${esc(p.url)}" target="_blank" rel="noopener">
                <span class="pn-date">${esc(p.date)}</span>
                <span class="pn-title">${esc(p.title)}</span>
                ${p.comments ? `<span class="pn-comments">💬 ${p.comments}</span>` : ''}
                <span class="pn-ext">↗</span>
            </a>
        `).join(''));
        moreBtn.style.display = shown < filtered.length ? '' : 'none';
        moreBtn.textContent = `더보기 (${filtered.length - shown}개 남음)`;
    }

    function applyFilter() {
        const q = searchEl.value.trim().toLowerCase();
        filtered = q ? posts.filter(p => p.title.toLowerCase().includes(q)) : posts;
        shown = 0;
        listEl.innerHTML = filtered.length ? '' : '<div class="empty-state">검색 결과가 없습니다.</div>';
        if (filtered.length) renderMore();
        else moreBtn.style.display = 'none';
    }

    try {
        const res = await fetch('/data/patchnotes.json');
        if (!res.ok) throw new Error('load failed');
        const data = await res.json();
        posts = data.posts || [];
        if (data.source) sourceEl.href = data.source;
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state">패치노트 목록을 불러오지 못했습니다. 상단의 갤로그 링크를 이용해주세요.</div>';
        return;
    }

    if (posts.length === 0) {
        listEl.innerHTML = '<div class="empty-state">아직 수집된 글이 없습니다. 상단의 갤로그 링크를 이용해주세요.</div>';
        return;
    }

    searchEl.addEventListener('input', applyFilter);
    moreBtn.addEventListener('click', renderMore);
    applyFilter();
});
