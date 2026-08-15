// 공용 정렬 테이블 (캐릭터 통계 / 증강 통계 / 랭킹)
// columns: [{ key, label, numeric, sortable(기본 true), value(row) -> 정렬값, render(row, index) -> HTML }]
(function (global) {
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function createSortableTable(container, columns, options = {}) {
        let rows = [];
        let sortKey = options.defaultSort || columns.find(c => c.sortable !== false)?.key;
        let sortDir = options.defaultDir || 'desc';
        const showRank = options.rank !== false;
        const rowClass = options.rowClass || (() => '');
        const emptyText = options.emptyText || '데이터가 없습니다.';

        function sortedRows() {
            const col = columns.find(c => c.key === sortKey);
            if (!col) return rows.slice();
            const val = col.value || (r => r[col.key]);
            return rows.slice().sort((a, b) => {
                const va = val(a), vb = val(b);
                let cmp;
                if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
                else cmp = String(va).localeCompare(String(vb), 'ko');
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }

        function render() {
            if (!rows.length) {
                container.innerHTML = `<div class="empty-state">${esc(emptyText)}</div>`;
                return;
            }
            const head = columns.map(c => {
                const sortable = c.sortable !== false;
                const cls = [c.numeric ? 'num' : '', sortable ? 'sortable' : '', c.key === sortKey ? `sorted ${sortDir}` : ''].filter(Boolean).join(' ');
                return `<th class="${cls}" data-key="${esc(c.key)}"${sortable ? ' tabindex="0" role="button"' : ''}>${esc(c.label)}</th>`;
            }).join('');
            const body = sortedRows().map((row, i) => {
                const rankCell = showRank ? `<td class="rank-cell top${i + 1}">${i + 1}</td>` : '';
                const cells = columns.map(c => `<td class="${c.numeric ? 'num' : ''}">${c.render ? c.render(row, i) : esc(row[c.key])}</td>`).join('');
                return `<tr class="${esc(rowClass(row, i))}">${rankCell}${cells}</tr>`;
            }).join('');
            container.innerHTML = `<table class="data-table ${options.tableClass || ''}"><thead><tr>${showRank ? '<th class="rank-cell">#</th>' : ''}${head}</tr></thead><tbody>${body}</tbody></table>`;

            container.querySelectorAll('th.sortable').forEach(th => {
                const activate = () => {
                    const key = th.dataset.key;
                    if (key === sortKey) sortDir = sortDir === 'desc' ? 'asc' : 'desc';
                    else { sortKey = key; sortDir = columns.find(c => c.key === key)?.defaultDir || 'desc'; }
                    render();
                };
                th.addEventListener('click', activate);
                th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
            });
        }

        return {
            setRows(next) { rows = next || []; render(); },
            render,
        };
    }

    // .sub-tabs 안의 button[data-period] 탭 → 클릭 시 cb(period)
    function bindTabs(tabsEl, cb) {
        tabsEl.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                tabsEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                cb(btn.dataset.period);
            });
        });
        return tabsEl.querySelector('button.active')?.dataset.period;
    }

    const bar = (pct, cls = '') => `<span class="mini-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></i></span>`;

    global.StatsTable = { createSortableTable, bindTabs, bar, esc };
})(window);
