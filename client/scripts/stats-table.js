// 공용 정렬 테이블 (캐릭터·증강·코어 통계, 랭킹)
// columns: [{ key, label, tip, numeric, sortable(기본 true), defaultDir, value(row) -> 정렬값, render(row, i) -> HTML }]
// options: { defaultSort, defaultDir, rank(순번 열, 기본 true), rowClass(row) -> class, emptyText, tableClass }
(function (global) {
    const { esc } = global.GCB;

    function createSortableTable(container, columns, options = {}) {
        let rows = [];
        let sortKey = options.defaultSort || columns.find(c => c.sortable !== false)?.key;
        let sortDir = options.defaultDir || 'desc';
        const showRank = options.rank !== false;
        const rowClass = options.rowClass || (() => '');

        function sortedRows() {
            const col = columns.find(c => c.key === sortKey);
            if (!col) return rows.slice();
            const val = col.value || (r => r[col.key]);
            return rows.slice().sort((a, b) => {
                const va = val(a);
                const vb = val(b);
                const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ko');
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        function render() {
            if (!rows.length) {
                container.innerHTML = `<div class="empty">${esc(options.emptyText || '데이터가 없습니다.')}</div>`;
                return;
            }
            const head = columns.map(c => {
                const sortable = c.sortable !== false;
                const cls = [c.numeric ? 'num' : '', sortable ? 'sortable' : '', c.key === sortKey ? `sorted ${sortDir}` : ''].filter(Boolean).join(' ');
                const tip = c.tip ? ` data-tip="${esc(c.tip)}"` : '';
                return `<th class="${cls}" data-key="${esc(c.key)}"${sortable ? ' tabindex="0" aria-sort="none"' : ''}><span${tip}>${esc(c.label)}</span></th>`;
            }).join('');
            const body = sortedRows().map((row, i) => {
                const rankCell = showRank ? `<td class="rank-cell">${i + 1}</td>` : '';
                const cells = columns.map(c => `<td class="${c.numeric ? 'num' : ''}">${c.render ? c.render(row, i) : esc(row[c.key])}</td>`).join('');
                return `<tr class="${esc(rowClass(row, i))}">${rankCell}${cells}</tr>`;
            }).join('');
            container.innerHTML = `<table class="data-table ${options.tableClass || ''}"><thead><tr>${showRank ? '<th class="rank-cell">#</th>' : ''}${head}</tr></thead><tbody>${body}</tbody></table>`;
        }

        function activate(th) {
            const key = th.dataset.key;
            if (key === sortKey) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
            else { sortKey = key; sortDir = columns.find(c => c.key === key)?.defaultDir || 'desc'; }
            render();
        }
        container.addEventListener('click', e => { const th = e.target.closest('th.sortable'); if (th) activate(th); });
        container.addEventListener('keydown', e => {
            const th = e.target.closest('th.sortable');
            if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(th); }
        });

        return { setRows(next) { rows = next || []; render(); } };
    }

    // 미니 막대 (0~100%)
    const bar = (pct, cls = '') => `<span class="mini-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></i></span>`;

    global.StatsTable = { createSortableTable, bar };
})(window);
