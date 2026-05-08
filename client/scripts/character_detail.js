document.addEventListener("DOMContentLoaded", async () => {
    const characterPortrait = document.getElementById("character-portrait");
    const characterName = document.getElementById("character-name");
    const statsContainer = document.getElementById("stats-container");
    const skillsContainer = document.getElementById("skills-container");
    const loadingDiv = document.getElementById("loading");

    // URL에서 캐릭터 ID 추출
    const pathParts = window.location.pathname.split('/');
    const characterId = pathParts[pathParts.length - 1];

    if (!characterId || isNaN(parseInt(characterId))) {
        loadingDiv.textContent = "잘못된 캐릭터 ID입니다.";
        return;
    }

    // 마인크래프트 색코드 매핑
    const mcColors = {
        '0': '#000000', // 검정
        '1': '#0000AA', // 어두운 파랑
        '2': '#00AA00', // 어두운 초록
        '3': '#00AAAA', // 어두운 청록
        '4': '#AA0000', // 어두운 빨강
        '5': '#AA00AA', // 어두운 보라
        '6': '#FFAA00', // 금색
        '7': '#AAAAAA', // 회색
        '8': '#555555', // 어두운 회색
        '9': '#5555FF', // 파랑
        'a': '#55FF55', // 연두
        'b': '#55FFFF', // 청록
        'c': '#FF5555', // 빨강
        'd': '#FF55FF', // 분홍
        'e': '#FFFF55', // 노랑
        'f': '#FFFFFF'  // 흰색
    };

    // 색코드 변환 함수
    function parseMinecraftColors(text) {
        if (!text) return '';

        let result = '';
        let currentColor = '#FFFFFF'; // 기본 흰색
        let i = 0;

        while (i < text.length) {
            if (text[i] === '&' && i + 1 < text.length) {
                const colorCode = text[i + 1].toLowerCase();
                if (mcColors[colorCode]) {
                    currentColor = mcColors[colorCode];
                    i += 2;
                    continue;
                }
            }

            // 줄바꿈 처리 (\n)
            if (text[i] === '\\' && i + 1 < text.length && text[i + 1] === 'n') {
                result += '<br>';
                i += 2;
                continue;
            }

            // 실제 줄바꿈 문자 처리
            if (text[i] === '\n') {
                result += '<br>';
                i++;
                continue;
            }

            result += `<span style="color: ${currentColor}">${escapeHtml(text[i])}</span>`;
            i++;
        }

        return result;
    }

    // HTML 이스케이프 함수
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 캐릭터 정보 가져오기
    async function fetchCharacterInfo() {
        try {
            const response = await fetch(`/api/character-info?id=${characterId}`);
            if (!response.ok) {
                throw new Error('캐릭터 정보를 가져오는 데 실패했습니다.');
            }
            return await response.json();
        } catch (error) {
            console.error("fetchCharacterInfo error:", error);
            return null;
        }
    }

    // 스킬 타입 이름
    const skillTypeNames = {
        '0': '패시브',
        '1': '스킬 1',
        '2': '스킬 2',
        '3': '스킬 3',
        '4': '궁극기',
        'baseattack': '기본 공격'
    };

    // 스탯 이름 및 아이콘 매핑
    const statConfig = {
        '체력': { icon: '❤️', color: '#ff6b6b' },
        '공격력': { icon: '⚔️', color: '#ffa502' },
        '공격속도': { icon: '⚡', color: '#ffdd59' },
        '사거리': { icon: '🎯', color: '#70a1ff' },
        '이동속도': { icon: '👟', color: '#7bed9f' },
        '체력재생': { icon: '💚', color: '#2ed573' }
    };

    // 스킬 링크 매핑 가져오기 (skillId → 이동 경로)
    async function fetchSkillLinks() {
        try {
            const response = await fetch('/api/skill-links');
            if (!response.ok) return {};
            const data = await response.json();
            return data.skillLinks || {};
        } catch (error) {
            console.error("fetchSkillLinks error:", error);
            return {};
        }
    }

    // 캐릭터 정보 렌더링
    async function renderCharacterInfo() {
        const [charInfo, skillLinks] = await Promise.all([
            fetchCharacterInfo(),
            fetchSkillLinks()
        ]);

        if (!charInfo || !charInfo.skills) {
            loadingDiv.textContent = "캐릭터 정보를 찾을 수 없습니다.";
            return;
        }

        loadingDiv.style.display = 'none';

        // 초상화 설정
        characterPortrait.src = `/Resource/character/${characterId}.png`;
        characterPortrait.onerror = () => { characterPortrait.src = '/Resource/character/0.png'; };

        // 스탯 데이터에서 캐릭터 이름 가져오기
        const statData = charInfo.skills['stat'];
        if (statData && statData.name) {
            characterName.textContent = statData.name;
        } else {
            characterName.textContent = `캐릭터 #${characterId}`;
        }

        // 스탯 정보 렌더링
        statsContainer.innerHTML = '';
        if (statData) {
            const statsGrid = document.createElement('div');
            statsGrid.classList.add('stats-grid');

            const statOrder = ['체력', '공격력', '공격속도', '사거리', '이동속도', '체력재생'];
            statOrder.forEach(statName => {
                if (statData[statName] !== undefined) {
                    const config = statConfig[statName] || { icon: '📊', color: '#ffffff' };
                    const statItem = document.createElement('div');
                    statItem.classList.add('stat-item');
                    statItem.innerHTML = `
                        <span class="stat-icon">${config.icon}</span>
                        <span class="stat-label">${statName}</span>
                        <span class="stat-value" style="color: ${config.color}">${statData[statName]}</span>
                    `;
                    statsGrid.appendChild(statItem);
                }
            });

            statsContainer.appendChild(statsGrid);
        }

        skillsContainer.innerHTML = '';

        // 스킬 순서: 0(패시브), baseattack(있으면), 1, 2, 3, 4 (stat 제외)
        const skillOrder = ['0', 'baseattack', '1', '2', '3', '4'];

        skillOrder.forEach(skillKey => {
            const skill = charInfo.skills[skillKey];
            if (!skill || skillKey === 'stat') return;

            const skillCard = document.createElement('div');
            skillCard.classList.add('skill-card');

            const skillTypeName = skillTypeNames[skillKey] || `스킬 ${skillKey}`;

            const skillLinkPath = skill.id ? skillLinks[skill.id] : null;

            skillCard.innerHTML = `
                <div class="skill-header">
                    <span class="skill-type">${skillTypeName}</span>
                    <span class="skill-name">${escapeHtml(skill.name || '이름 없음')}</span>
                    ${skillLinkPath ? '<span class="skill-link-icon">▶</span>' : ''}
                </div>
                <div class="skill-description">
                    ${parseMinecraftColors(skill.description || '')}
                </div>
            `;

            if (skillLinkPath) {
                skillCard.classList.add('skill-card-clickable');
                skillCard.addEventListener('click', () => {
                    const name = encodeURIComponent(skill.name || '');
                    window.location.href = `${skillLinkPath}?name=${name}`;
                });
            }

            skillsContainer.appendChild(skillCard);
        });
    }

    renderCharacterInfo();

    // ========================================
    // 댓글 시스템 (디시 스타일)
    // ========================================
    const commentForm = document.getElementById('comment-form');
    const nicknameInput = document.getElementById('comment-nickname');
    const passwordInput = document.getElementById('comment-password');
    const contentInput = document.getElementById('comment-content');
    const charCountSpan = document.getElementById('comment-char-count');
    const submitBtn = document.getElementById('comment-submit');
    const errorDiv = document.getElementById('comment-form-error');
    const commentsLoading = document.getElementById('comments-loading');
    const commentsList = document.getElementById('comments-list');
    const commentsPagination = document.getElementById('comments-pagination');

    let currentPage = 1;

    contentInput.addEventListener('input', () => {
        charCountSpan.textContent = `${contentInput.value.length} / 300`;
    });

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    function clearError() {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
    }

    function formatDate(isoString) {
        const d = new Date(isoString);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    }

    async function loadComments(page = 1) {
        currentPage = page;
        commentsLoading.style.display = 'block';
        commentsList.innerHTML = '';
        commentsPagination.innerHTML = '';

        try {
            const response = await fetch(`/api/character-comments?id=${characterId}&page=${page}`);
            const data = await response.json();
            commentsLoading.style.display = 'none';

            if (!response.ok) {
                commentsList.innerHTML = `<div class="comments-empty">${escapeHtml(data.error || '댓글을 불러올 수 없습니다.')}</div>`;
                return;
            }

            renderComments(data.comments);
            renderPagination(data.totalPages, data.page);
        } catch (error) {
            commentsLoading.style.display = 'none';
            commentsList.innerHTML = '<div class="comments-empty">댓글을 불러올 수 없습니다.</div>';
        }
    }

    function renderComments(comments) {
        if (!comments || comments.length === 0) {
            commentsList.innerHTML = '<div class="comments-empty">아직 댓글이 없습니다.</div>';
            return;
        }

        commentsList.innerHTML = '';
        comments.forEach(c => {
            const item = document.createElement('div');
            item.classList.add('comment-item');
            item.innerHTML = `
                <div class="comment-header">
                    <span class="comment-nickname">${escapeHtml(c.nickname)}</span>
                    <span class="comment-ip">(${escapeHtml(c.ipPrefix)})</span>
                    <span class="comment-date">${formatDate(c.createdAt)}</span>
                    <button class="comment-delete-btn" data-id="${c.id}">삭제</button>
                </div>
                <div class="comment-content">${escapeHtml(c.content).replace(/\n/g, '<br>')}</div>
            `;
            commentsList.appendChild(item);
        });

        commentsList.querySelectorAll('.comment-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDelete(parseInt(btn.dataset.id, 10)));
        });
    }

    function renderPagination(totalPages, page) {
        commentsPagination.innerHTML = '';
        if (totalPages <= 1) return;

        const makeBtn = (label, targetPage, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.classList.add('pagination-btn');
            if (active) btn.classList.add('pagination-active');
            if (disabled) btn.disabled = true;
            else btn.addEventListener('click', () => loadComments(targetPage));
            return btn;
        };

        commentsPagination.appendChild(makeBtn('‹', page - 1, page === 1));

        // 페이지 번호: 현재 기준 앞뒤 2개씩
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);
        for (let i = start; i <= end; i++) {
            commentsPagination.appendChild(makeBtn(String(i), i, false, i === page));
        }

        commentsPagination.appendChild(makeBtn('›', page + 1, page === totalPages));
    }

    async function handleDelete(commentId) {
        const password = prompt('비밀번호를 입력하세요.');
        if (!password) return;

        try {
            const response = await fetch(`/api/character-comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await response.json();
            if (!response.ok) {
                alert(data.error || '삭제에 실패했습니다.');
                return;
            }
            loadComments(currentPage);
        } catch (error) {
            alert('삭제 처리 중 오류가 발생했습니다.');
        }
    }

    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        const nickname = nicknameInput.value.trim();
        const password = passwordInput.value;
        const content = contentInput.value.trim();

        if (nickname.length === 0 || nickname.length > 15) {
            showError('닉네임은 1~15자로 입력하세요.');
            return;
        }
        if (/\s/.test(nickname)) {
            showError('닉네임에 공백을 포함할 수 없습니다.');
            return;
        }
        if (!/^[a-zA-Z0-9]{4}$/.test(password)) {
            showError('비밀번호는 영문/숫자 4자입니다.');
            return;
        }
        if (content.length === 0 || content.length > 300) {
            showError('내용은 1~300자로 입력하세요.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '작성 중...';

        try {
            const response = await fetch('/api/character-comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    characterId: parseInt(characterId, 10),
                    nickname,
                    password,
                    content,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                showError(data.error || '작성에 실패했습니다.');
                return;
            }
            // 폼 초기화 (닉네임/비밀번호는 유지)
            contentInput.value = '';
            charCountSpan.textContent = '0 / 300';
            loadComments(1);
        } catch (error) {
            showError('작성 처리 중 오류가 발생했습니다.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '작성';
        }
    });

    loadComments(1);
});
