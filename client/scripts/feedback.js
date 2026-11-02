document.addEventListener("DOMContentLoaded", () => {
    // =============================================
    // 팝업 관리
    // =============================================
    function openPopup(id) {
        document.getElementById(id).style.display = 'flex';
    }

    function closePopup(id) {
        document.getElementById(id).style.display = 'none';
    }

    // 작성하기 버튼 클릭
    document.getElementById('write-btn').addEventListener('click', () => openPopup('write-popup'));

    // 팝업 닫기 버튼
    document.getElementById('write-popup-close').addEventListener('click', () => closePopup('write-popup'));
    document.getElementById('detail-popup-close').addEventListener('click', () => closePopup('detail-popup'));

    // 오버레이 클릭으로 닫기
    ['write-popup', 'detail-popup'].forEach(id => {
        document.getElementById(id).addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closePopup(id);
        });
    });

    // =============================================
    // 폼 제출
    // =============================================
    document.getElementById('feedback-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const nickname = document.getElementById('feedback-nickname').value.trim();
        const password = document.getElementById('feedback-password').value;
        const category = document.getElementById('feedback-category').value;
        const title = document.getElementById('feedback-title').value.trim();
        const content = document.getElementById('feedback-content').value.trim();

        if (!title || !content) return;

        const statusEl = document.getElementById('feedback-status');
        const submitBtn = document.querySelector('.feedback-submit-btn');
        statusEl.textContent = '제출 중...';
        statusEl.style.color = '#dcdcdc';
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname, password, category, title, content })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || '제출에 실패했습니다.');
            }

            statusEl.textContent = '제출되었습니다!';
            statusEl.style.color = '#55FF55';
            document.getElementById('feedback-form').reset();
            loadFeedbackList();

            setTimeout(() => {
                closePopup('write-popup');
                statusEl.textContent = '';
            }, 1500);
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.style.color = '#FF5555';
        }

        submitBtn.disabled = false;
    });

    // =============================================
    // 목록 로드 + 상태·카테고리 필터 + 페이지네이션
    // =============================================
    let allFeedbacks = [];
    let currentStatus = 'open';
    let currentFilter = 'all';
    let currentPage = 1;
    const PAGE_SIZE = 15;

    async function loadFeedbackList() {
        const listEl = document.getElementById('feedback-list');
        try {
            const res = await fetch('/api/feedback-list');
            if (!res.ok) throw new Error('목록 로드 실패');
            const data = await res.json();
            allFeedbacks = data.feedbacks || [];
            renderFeedbackList();
        } catch (err) {
            listEl.innerHTML = '<p class="loading-text">목록을 불러올 수 없습니다.</p>';
        }
    }

    function renderFeedbackList() {
        const listEl = document.getElementById('feedback-list');
        const inCategory = currentFilter === 'all'
            ? allFeedbacks
            : allFeedbacks.filter(feedback => feedback.category === currentFilter);
        renderStatusCounts(inCategory);
        const filtered = inCategory.filter(feedback => feedback.status === currentStatus);

        if (filtered.length === 0) {
            const filterName = { all: '', bug: '버그 ', enhancement: '건의 ', other: '기타 ', gcbc: 'GCBC ' }[currentFilter] || '';
            listEl.innerHTML = `<p class="loading-text">${statusName(currentStatus)} 상태인 ${filterName}글이 없습니다.</p>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filtered.slice(start, start + PAGE_SIZE);

        listEl.innerHTML = pageItems.map((feedback, idx) => `
            <div class="feedback-item" data-idx="${start + idx}">
                <span class="feedback-label feedback-label-${feedback.category}">${categoryName(feedback.category)}</span>
                <span class="feedback-item-title">${escapeHtml(feedback.title)}</span>
                <span class="feedback-item-author">${escapeHtml(authorText(feedback))}</span>
                <span class="feedback-item-date">${formatDate(feedback.createdAt)}</span>
            </div>
        `).join('');

        listEl.querySelectorAll('.feedback-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                showDetailPopup(filtered[idx]);
            });
        });

        renderPagination(totalPages);
    }

    // 상태 탭 숫자 = 지금 카테고리 안에서 상태별 글 수
    function renderStatusCounts(list) {
        document.querySelectorAll('.status-tabs button').forEach(btn => {
            btn.querySelector('.tab-count').textContent = list.filter(feedback => feedback.status === btn.dataset.status).length;
        });
    }

    function renderPagination(totalPages) {
        GCB.pager(document.getElementById('pagination'), currentPage, totalPages, page => {
            currentPage = page;
            renderFeedbackList();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function showDetailPopup(feedback) {
        document.getElementById('detail-label').className = `feedback-label feedback-label-${feedback.category}`;
        document.getElementById('detail-label').textContent = categoryName(feedback.category);
        document.getElementById('detail-status').className = `feedback-label feedback-status-${feedback.status}`;
        document.getElementById('detail-status').textContent = statusName(feedback.status);
        document.getElementById('detail-date').textContent = formatDate(feedback.createdAt);
        document.getElementById('detail-title').textContent = feedback.title;
        document.getElementById('detail-body').textContent = feedback.content;
        document.getElementById('detail-author').textContent = authorText(feedback);
        document.getElementById('detail-delete').dataset.id = feedback.id;
        const admin = document.getElementById('detail-admin');
        admin.dataset.id = feedback.id;
        admin.querySelectorAll('button').forEach(btn => { btn.hidden = btn.dataset.status === feedback.status; });
        openPopup('detail-popup');
    }

    // 삭제 (작성자 비밀번호, 관리자는 마스터 비밀번호)
    document.getElementById('detail-delete').addEventListener('click', async () => {
        const password = prompt('비밀번호를 입력하세요.');
        if (!password) return;

        try {
            const res = await fetch(`/api/feedback/${document.getElementById('detail-delete').dataset.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || '삭제에 실패했습니다.');
                return;
            }
            closePopup('detail-popup');
            loadFeedbackList();
        } catch (error) {
            alert('삭제 처리 중 오류가 발생했습니다.');
        }
    });

    // =============================================
    // 관리자: 상태 전환 (마스터 비밀번호를 이 탭이 열려 있는 동안 기억)
    // =============================================
    const ADMIN_KEY = 'gcb_feedback_admin';
    let adminPassword = '';
    try { adminPassword = sessionStorage.getItem(ADMIN_KEY) || ''; } catch (e) { }

    function setAdmin(password) {
        adminPassword = password;
        try {
            if (password) sessionStorage.setItem(ADMIN_KEY, password);
            else sessionStorage.removeItem(ADMIN_KEY);
        } catch (e) { }
        document.getElementById('admin-btn').textContent = password ? '관리자 끝내기' : '관리자';
        document.getElementById('detail-admin').hidden = !password;
    }

    document.getElementById('admin-btn').addEventListener('click', () => {
        if (adminPassword) {
            setAdmin('');
            return;
        }
        const password = prompt('관리자 비밀번호를 입력하세요.');
        if (password) setAdmin(password);
    });

    document.querySelectorAll('#detail-admin button').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = Number(document.getElementById('detail-admin').dataset.id);
            try {
                const res = await fetch(`/api/feedback/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: btn.dataset.status, password: adminPassword }),
                });
                const data = await res.json();
                if (!res.ok) {
                    if (res.status === 403) setAdmin('');
                    alert(data.error || '상태를 바꾸지 못했습니다.');
                    return;
                }
                const feedback = allFeedbacks.find(f => f.id === id);
                feedback.status = btn.dataset.status;
                renderFeedbackList();
                showDetailPopup(feedback);
            } catch (error) {
                alert('상태 변경 중 오류가 발생했습니다.');
            }
        });
    });

    // 탭 이벤트 (상태·카테고리)
    function bindTabs(selector, pick) {
        document.querySelectorAll(`${selector} button`).forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll(`${selector} button`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                pick(btn.dataset);
                currentPage = 1;
                renderFeedbackList();
            });
        });
    }
    bindTabs('.status-tabs', data => { currentStatus = data.status; });
    bindTabs('.filter-buttons', data => { currentFilter = data.filter; });

    function categoryName(cat) {
        return { bug: '버그', enhancement: '건의', other: '기타', gcbc: 'GCBC' }[cat] || cat;
    }

    function statusName(status) {
        return { open: '열림', resolved: '해결', closed: '닫힘' }[status] || status;
    }

    // 옛 GitHub 에서 옮긴 글은 IP 앞자리가 없어 닉네임만
    function authorText(feedback) {
        return feedback.ipPrefix ? `${feedback.nickname} (${feedback.ipPrefix})` : feedback.nickname;
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('ko-KR');
    }

    const escapeHtml = GCB.esc;

    // =============================================
    // 초기화
    // =============================================
    setAdmin(adminPassword);
    loadFeedbackList();
});
