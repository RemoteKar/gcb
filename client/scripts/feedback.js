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
            auto_select: true,
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
            // URL에서 code 파라미터 제거
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
                // GitHub 토큰은 만료 없음 (revoke 전까지 유효)
                exp: null,
            };
            localStorage.setItem('gcb_session', JSON.stringify(session));
            setLoggedIn(session);
        } catch (e) {
            console.error('GitHub 인증 처리 오류:', e);
        }
    }

    // =============================================
    // 공통 로그인/로그아웃
    // =============================================
    function setLoggedIn(session) {
        currentUser = session;
        document.getElementById('login-buttons').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').textContent = session.name;
        document.getElementById('feedback-form-section').style.display = 'block';
    }

    function logout() {
        currentUser = null;
        localStorage.removeItem('gcb_session');
        if (typeof google !== 'undefined' && google.accounts) {
            google.accounts.id.disableAutoSelect();
        }
        document.getElementById('login-buttons').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('feedback-form-section').style.display = 'none';
    }

    function restoreSession() {
        const saved = localStorage.getItem('gcb_session');
        if (!saved) return;

        try {
            const session = JSON.parse(saved);
            // 만료 체크 (Google만 해당)
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
                    statusEl.textContent = '로그인이 만료되었습니다. 다시 로그인해주세요.';
                    statusEl.style.color = '#FF5555';
                    submitBtn.disabled = false;
                    return;
                }
                throw new Error(err.error || '제출에 실패했습니다.');
            }

            statusEl.textContent = '제출되었습니다!';
            statusEl.style.color = '#55FF55';
            document.getElementById('feedback-form').reset();
            loadFeedbackList();
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.style.color = '#FF5555';
        }

        submitBtn.disabled = false;
    });

    // =============================================
    // 목록 로드 + 필터
    // =============================================
    let allIssues = [];
    let currentFilter = 'all';

    async function loadFeedbackList() {
        const listEl = document.getElementById('feedback-list');
        try {
            const res = await fetch('/api/feedback-list');
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
            return;
        }

        listEl.innerHTML = filtered.map(issue => `
            <div class="feedback-item">
                <div class="feedback-item-header">
                    <span class="feedback-label feedback-label-${issue.category}">${categoryName(issue.category)}</span>
                    <span class="feedback-item-title">${escapeHtml(issue.title)}</span>
                    <span class="feedback-item-date">${formatDate(issue.created_at)}</span>
                </div>
                <div class="feedback-item-body">${escapeHtml(issue.body)}</div>
                <div class="feedback-item-author">${escapeHtml(issue.author)}</div>
            </div>
        `).join('');
    }

    // 필터 버튼 이벤트
    document.querySelectorAll('.filter-buttons .stat-button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-buttons .stat-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
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

        // 기존 세션 복원 시도
        restoreSession();

        // Google GIS 로드 대기 후 초기화
        function waitForGIS() {
            if (typeof google !== 'undefined' && google.accounts) {
                initGoogleAuth();
            } else {
                setTimeout(waitForGIS, 100);
            }
        }
        waitForGIS();

        // GitHub 버튼 초기화
        initGithubAuth();

        // 목록 로드
        loadFeedbackList();
    }

    init();
});
