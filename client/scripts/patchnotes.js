// 패치노트: 커뮤니티 게시판식 글 목록 → 행 클릭 시 아래로 펼쳐서 내용 표시
document.addEventListener("DOMContentLoaded", async () => {
    const listEl = document.getElementById('pn-list');
    const searchEl = document.getElementById('pn-search');
    const moreBtn = document.getElementById('pn-more');
    const PAGE = 30;

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // 캐릭터 이름 -> id (헤더 옆 초상화용). 로드 실패해도 패치노트는 정상 표시
    let charIdByName = {};
    fetch('/data/names.json').then(r => r.json()).then(d => {
        for (const [id, name] of Object.entries(d.characters || {})) charIdByName[name] = id;
    }).catch(() => {});

    // "A -> B" 수치 변경 강조, "이름:" 헤더 강조 (캐릭터명이면 초상화 표시)
    function formatBody(body) {
        return body.split('\n').map(line => {
            const t = esc(line);
            if (/^\S.*:\s*$/.test(line) && !/->|→/.test(line)) {
                const id = charIdByName[line.replace(/:\s*$/, '').trim()];
                const img = id ? `<img class="pn-portrait" src="/Resource/character/${id}.png" alt="" loading="lazy" onerror="this.remove()">` : '';
                return `<span class="pn-h">${img}${t}</span>`;
            }
            return t.replace(/(.*?)(\s*(?:->|→)\s*)(.*)/, (all, a, arrow, b) =>
                `<span class="pn-old">${a}</span><span class="pn-arrow">${arrow}</span><span class="pn-new">${b}</span>`);
        }).join('\n');
    }

    let notes = [];
    let filtered = [];
    let shown = 0;

    function rowHtml(n, idx) {
        const no = notes.length - notes.indexOf(n); // 오래된 글이 1번
        return `
            <div class="board-row" data-idx="${idx}" data-id="${esc(n.file || n.date)}" role="button" tabindex="0" aria-expanded="false">
                <span class="board-no">${no}</span>
                <span class="board-title">${esc(n.title)}</span>
                <span class="board-date">${esc(n.date)}</span>
            </div>`;
    }

    function renderMore() {
        const slice = filtered.slice(shown, shown + PAGE);
        listEl.insertAdjacentHTML('beforeend', slice.map((n, i) => rowHtml(n, shown + i)).join(''));
        shown += slice.length;
        moreBtn.style.display = shown < filtered.length ? '' : 'none';
        moreBtn.textContent = `더보기 (${filtered.length - shown}개 남음)`;
    }

    function toggleRow(row) {
        const open = row.getAttribute('aria-expanded') === 'true';
        const next = row.nextElementSibling;
        if (open) {
            row.setAttribute('aria-expanded', 'false');
            row.classList.remove('open');
            if (next && next.classList.contains('board-body')) next.remove();
            return;
        }
        const n = filtered[Number(row.dataset.idx)];
        row.setAttribute('aria-expanded', 'true');
        row.classList.add('open');
        row.insertAdjacentHTML('afterend', `
            <div class="board-body">
                <pre class="patchnote-body">${formatBody(n.body) || '<span class="pn-empty">내용 없음</span>'}</pre>
                ${n.source ? `<a class="board-source" href="${esc(n.source)}" target="_blank" rel="noopener">원문 보기 ↗</a>` : ''}
            </div>`);
        history.replaceState(null, '', `#${encodeURIComponent(row.dataset.id)}`);
    }

    listEl.addEventListener('click', (e) => {
        const row = e.target.closest('.board-row');
        if (row) toggleRow(row);
    });
    listEl.addEventListener('keydown', (e) => {
        const row = e.target.closest('.board-row');
        if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleRow(row); }
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

    // #파일명 으로 진입 시 해당 글 펼치기
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
        const idx = filtered.findIndex(n => (n.file || n.date) === hash);
        if (idx >= 0) {
            while (shown <= idx) renderMore();
            const row = listEl.querySelector(`.board-row[data-idx="${idx}"]`);
            if (row) { toggleRow(row); row.scrollIntoView({ block: 'center' }); }
        }
    }
});
