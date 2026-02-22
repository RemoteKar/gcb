document.addEventListener("DOMContentLoaded", () => {
    let currentUser = null; // { name, token, provider: 'google' | 'github' }
    let config = null;

    // --- 설정 로드 ---
    async function loadConfig() {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            // 설정 로드 실패 시 무시
        }
        return { googleClientId: '', githubClientId: '' };
    }

    // =============================================
    // Google 인증
    // =============================================
    async function initGoogleAuth() {
        if (!config.googleClientId) {
            document.getElementById('google-signin-btn').style.display = 'none';
            return;
        }

        google.accounts.id.initialize({
            client_id: config.googleClientId,
            callback: handleGoogleResponse,
        });

        google.accounts.id.renderButton(
            document.getElementById('google-signin-btn'),
            { theme: 'filled_black', size: 'large', text: 'signin_with', locale: 'ko' }
        );
    }

    function handleGoogleResponse(response) {
        const payload = parseJwt(response.credential);
        if (payload) {
            const session = {
                token: response.credential,
                name: payload.name || payload.email,
                provider: 'google',
                exp: payload.exp * 1000,
            };
            localStorage.setItem('gcb_session', JSON.stringify(session));
            setLoggedIn(session);
            // 로그인 팝업 닫고 작성 팝업 열기
            closePopup('login-popup');
            openPopup('write-popup');
        }
    }

    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(base64));
        } catch (e) {
            return null;
        }
    }

    // =============================================
    // GitHub 인증
    // =============================================
    function initGithubAuth() {
        if (!config.githubClientId) {
            document.getElementById('github-signin-btn').style.display = 'none';
            return;
        }

        document.getElementById('github-signin-btn').addEventListener('click', () => {
            const redirectUri = window.location.origin + '/feedback.html';
            const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${config.githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;
            window.location.href = githubAuthUrl;
        });

        // GitHub OAuth 콜백 처리 (URL에 code 파라미터가 있을 때)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            handleGithubCallback(code);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async function handleGithubCallback(code) {
        try {
            const res = await fetch('/api/auth/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            if (!res.ok) {
                const err = await res.json();
                console.error('GitHub 로그인 실패:', err.error);
                return;
            }

            const data = await res.json();
            const session = {
                token: data.accessToken,
                name: data.name,
                login: data.login,
                provider: 'github',
                exp: null,
            };
            localStorage.setItem('gcb_session', JSON.stringify(session));
            setLoggedIn(session);
            // GitHub 콜백 후 바로 작성 팝업 열기
            openPopup('write-popup');
        } catch (e) {
            console.error('GitHub 인증 처리 오류:', e);
        }
    }

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
    document.getElementById('write-btn').addEventListener('click', () => {
        if (currentUser) {
            openPopup('write-popup');
        } else {
            openPopup('login-popup');
        }
    });

    // 팝업 닫기 버튼
    document.getElementById('login-popup-close').addEventListener('click', () => closePopup('login-popup'));
    document.getElementById('write-popup-close').addEventListener('click', () => closePopup('write-popup'));
    document.getElementById('detail-popup-close').addEventListener('click', () => closePopup('detail-popup'));

    // 오버레이 클릭으로 닫기
    ['login-popup', 'write-popup', 'detail-popup'].forEach(id => {
        document.getElementById(id).addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closePopup(id);
        });
    });

    // =============================================
    // 공통 로그인/로그아웃
    // =============================================
    function setLoggedIn(session) {
        currentUser = session;
        document.getElementById('user-name').textContent = session.name;
        // 작성하기 버튼 텍스트 변경
        document.getElementById('write-btn').textContent = '작성하기';
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem('gcb_session');
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        closePopup('write-popup');
    }

    function restoreSession() {
        const saved = localStorage.getItem('gcb_session');
        if (!saved) return;

        try {
            const session = JSON.parse(saved);
            if (session.exp && session.exp < Date.now()) {
                localStorage.removeItem('gcb_session');
                return;
            }
            setLoggedIn(session);
        } catch (e) {
            localStorage.removeItem('gcb_session');
        }
    }

    function getAuthHeader() {
        if (!currentUser) return {};
        if (currentUser.provider === 'github') {
            return { 'Authorization': `GitHub ${currentUser.token}` };
        }
        return { 'Authorization': `Bearer ${currentUser.token}` };
    }

    // =============================================
    // 폼 제출
    // =============================================
    document.getElementById('feedback-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

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
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeader(),
                },
                body: JSON.stringify({ category, title, content })
            });

            if (!res.ok) {
                const err = await res.json();
                if (res.status === 401) {
                    logout();
                    closePopup('write-popup');
                    openPopup('login-popup');
                    return;
                }
                throw new Error(err.error || '제출에 실패했습니다.');
            }

            statusEl.textContent = '제출되었습니다!';
            statusEl.style.color = '#55FF55';
            document.getElementById('feedback-form').reset();
            loadFeedbackList(true);

            // 1.5초 후 팝업 닫기
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
    // 목록 로드 + 필터 + 페이지네이션
    // =============================================
    let allIssues = [];
    let currentFilter = 'all';
    let currentPage = 1;
    const PAGE_SIZE = 15;

    async function loadFeedbackList(skipCache) {
        const listEl = document.getElementById('feedback-list');
        try {
            const url = skipCache ? `/api/feedback-list?t=${Date.now()}` : '/api/feedback-list';
            const res = await fetch(url);
            if (!res.ok) throw new Error('목록 로드 실패');
            const data = await res.json();
            allIssues = data.issues || [];
            renderFeedbackList();
        } catch (err) {
            listEl.innerHTML = '<p class="loading-text">목록을 불러올 수 없습니다.</p>';
        }
    }

    function renderFeedbackList() {
        const listEl = document.getElementById('feedback-list');
        const filtered = currentFilter === 'all'
            ? allIssues
            : allIssues.filter(issue => issue.category === currentFilter);

        if (filtered.length === 0) {
            const filterName = { all: '', bug: '버그', enhancement: '건의', other: '기타' }[currentFilter] || '';
            listEl.innerHTML = `<p class="loading-text">등록된 ${filterName} 건의/버그가 없습니다.</p>`;
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = filtered.slice(start, start + PAGE_SIZE);

        listEl.innerHTML = pageItems.map((issue, idx) => `
            <div class="feedback-item" data-idx="${start + idx}">
                <span class="feedback-label feedback-label-${issue.category}">${categoryName(issue.category)}</span>
                <span class="feedback-item-title">${escapeHtml(issue.title)}</span>
                <span class="feedback-item-author">${escapeHtml(issue.author)}</span>
                <span class="feedback-item-date">${formatDate(issue.created_at)}</span>
            </div>
        `).join('');

        // 클릭 이벤트
        listEl.querySelectorAll('.feedback-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                const issue = filtered[idx];
                showDetailPopup(issue);
            });
        });

        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        const pagEl = document.getElementById('pagination');
        if (totalPages <= 1) { pagEl.innerHTML = ''; return; }

        let html = '';
        if (currentPage > 1) html += `<button class="page-btn" data-page="${currentPage - 1}">&lt;</button>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (currentPage < totalPages) html += `<button class="page-btn" data-page="${currentPage + 1}">&gt;</button>`;
        pagEl.innerHTML = html;

        pagEl.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderFeedbackList();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }

    function showDetailPopup(issue) {
        document.getElementById('detail-label').className = `feedback-label feedback-label-${issue.category}`;
        document.getElementById('detail-label').textContent = categoryName(issue.category);
        document.getElementById('detail-date').textContent = formatDate(issue.created_at);
        document.getElementById('detail-title').textContent = issue.title;
        document.getElementById('detail-body').textContent = issue.body;
        document.getElementById('detail-author').textContent = issue.author;
        openPopup('detail-popup');
    }

    // 필터 버튼 이벤트
    document.querySelectorAll('.filter-buttons .stat-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-buttons .stat-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            currentPage = 1;
            renderFeedbackList();
        });
    });

    function categoryName(cat) {
        return { bug: '버그', enhancement: '건의', other: '기타' }[cat] || cat;
    }

    function formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('ko-KR');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // =============================================
    // 초기화
    // =============================================
    document.getElementById('logout-btn').addEventListener('click', logout);

    async function init() {
        config = await loadConfig();
        restoreSession();

        function waitForGIS() {
            if (typeof google !== 'undefined' && google.accounts) {
                initGoogleAuth();
            } else {
                setTimeout(waitForGIS, 100);
            }
        }
        waitForGIS();

        initGithubAuth();
        loadFeedbackList();
    }

    init();
});
