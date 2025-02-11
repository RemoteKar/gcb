//---------------------------------------------------------
// 🔹 전역 변수 설정 (쉽게 수정 가능)
//---------------------------------------------------------
const GITHUB_TOKEN = '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'; // GitHub API 토큰
const CACHE_DURATION = 60000; // 캐싱 유지 시간 (1분 = 1000ms)
const cache = {}; // 닉네임별 데이터 캐싱 저장소

//---------------------------------------------------------
// 🔹 DOM 요소 가져오기
//---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const menuLinks = document.querySelectorAll('.menu-link');
    const sections = document.querySelectorAll('.section');
    const searchButton = document.getElementById('search-button');
    const nicknameInput = document.getElementById('nickname');
    const resultDisplay = document.getElementById('result');
    const playerHead = document.getElementById('player-head');
    const badgeDisplay = document.getElementById('badge-display');
    const statsDisplay = document.getElementById('stats-display');

    //---------------------------------------------------------
    // 🔹 메뉴 클릭 이벤트 (탭 변경)
    //---------------------------------------------------------
    menuLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            menuLinks.forEach(link => link.classList.remove('active'));
            link.classList.add('active');
            sections.forEach(section => section.classList.remove('active'));
            const targetSection = document.getElementById(link.dataset.section);
            targetSection.classList.add('active');
        });
    });

    //---------------------------------------------------------
    // 🔹 API 호출: 닉네임으로 UUID 및 배지 데이터 검색 (1분 캐싱 적용)
    //---------------------------------------------------------
    async function fetchUUID(nickname) {
        // 캐싱된 데이터가 존재하고, 유지시간 내이면 반환
        if (cache[nickname] && (Date.now() - cache[nickname].timestamp < CACHE_DURATION)) {
            console.log(`⚡ 캐싱된 데이터 반환: ${nickname}`);
            return cache[nickname].data;
        }

        const url = `.netlify/functions/fetch-minecraft?nickname=${nickname}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('유저를 찾을 수 없습니다.');
            }
            const data = await response.json();

            // 캐싱 저장
            cache[nickname] = { data, timestamp: Date.now() };
            return data;
        } catch (error) {
            console.error('API 오류:', error);
            return null;
        }
    }

    //---------------------------------------------------------
    // 🔹 API 호출: UUID로 머리 스킨 이미지 URL 생성
    //---------------------------------------------------------
    function getSkinUrl(uuid) {
        return `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
    }

    //---------------------------------------------------------
    // 🔹 배지 아이콘 생성
    //---------------------------------------------------------
    async function createBadgeIcon(badgeName) {
        const img = document.createElement('img');
        const imageUrl = await fetchBadgeImage(badgeName);
        img.src = imageUrl;
        img.alt = badgeName;
        img.classList.add('badge-icon');

        // 이미지 로드 실패 시 기본 이미지로 대체
        img.onerror = () => {
            img.src = 'path/to/default-image.png';
            console.error(`Failed to load badge image: ${badgeName}`);
        };

        return img;
    }

    //---------------------------------------------------------
    // 🔹 GitHub에서 배지 이미지 가져오기
    //---------------------------------------------------------
    async function fetchBadgeImage(badgeName) {
        const githubUrl = `https://raw.githubusercontent.com/RemoteKar/gcb/main/Resource/badge/${badgeName}.png`;
        try {
            const response = await fetch(githubUrl, {
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                },
            });
            if (!response.ok) {
                throw new Error('배지 이미지를 찾을 수 없습니다.');
            }
            return githubUrl;
        } catch (error) {
            console.error('배지 이미지 오류:', error);
            return 'path/to/default-image.png';
        }
    }

    //---------------------------------------------------------
    // 🔹 검색 버튼 클릭 이벤트
    //---------------------------------------------------------
    searchButton.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
            resultDisplay.textContent = '닉네임을 입력하세요!';
            return;
        }

        resultDisplay.textContent = '검색 중...';
        playerHead.innerHTML = '';
        badgeDisplay.innerHTML = '';
        statsDisplay.innerHTML = '';

        const data = await fetchUUID(nickname);
        if (data) {
            const { id: uuid, badges, statistics } = data;

            // Format UUID with hyphens
            const formattedUUID = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;

            resultDisplay.textContent = `닉네임: ${nickname} | UUID: ${formattedUUID}`;

            //---------------------------------------------------------
            // 🔹 플레이어 머리 이미지 표시
            //---------------------------------------------------------
            const img = document.createElement('img');
            img.src = getSkinUrl(uuid);
            img.alt = `${nickname}'s Head`;
            playerHead.appendChild(img);

            //---------------------------------------------------------
            // 🔹 배지 데이터 표시
            //---------------------------------------------------------
            if (badges) {
                const badgeList = badges.List || [];
                const currentBadge = badges.current || '없음';

                // 현재 배지 표시
                const currentBadgeContainer = document.createElement('div');
                currentBadgeContainer.innerHTML = `<strong>현재 배지:</strong>`;
                currentBadgeContainer.appendChild(await createBadgeIcon(currentBadge));
                badgeDisplay.appendChild(currentBadgeContainer);

                // 보유 배지 표시
                const ownedBadgesContainer = document.createElement('div');
                ownedBadgesContainer.innerHTML = `<strong>보유 배지:</strong>`;
                for (const badgeName of badgeList) {
                    ownedBadgesContainer.appendChild(await createBadgeIcon(badgeName));
                }
                badgeDisplay.appendChild(ownedBadgesContainer);
            } else {
                badgeDisplay.textContent = '배지 데이터가 없습니다.';
            }

            //---------------------------------------------------------
            // 🔹 통계 데이터 표시
            //---------------------------------------------------------
            if (statistics) {
                statsDisplay.innerHTML = `
                  <p><strong>승률:</strong> ${statistics.winRate}%</p>
                  <p><strong>가장 많이 사용한 캐릭터:</strong> ${statistics.mostUsedCharacter}</p>
                  <p><strong>가장 많이 사용한 증강:</strong> ${statistics.mostUsedAugments.join(', ')}</p>
                  <p><strong>평균 데미지:</strong> ${statistics.averageDamageDealt}</p>
                  <p><strong>평균 킬 수:</strong> ${statistics.averageKillRate}</p>
                  <p><strong>평균 생존시간:</strong> ${statistics.averageAliveTime}</p>
                `;
            } else {
                statsDisplay.textContent = '통계 데이터가 없습니다.';
            }
        } else {
            resultDisplay.textContent = 'UUID를 찾을 수 없습니다.';
        }
    });
});
