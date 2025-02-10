const GITHUB_TOKEN = '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';

document.addEventListener('DOMContentLoaded', () => {
  const menuLinks = document.querySelectorAll('.menu-link'); // 메뉴 링크
  const sections = document.querySelectorAll('.section'); // 모든 섹션
  const searchButton = document.getElementById('search-button'); // 검색 버튼
  const nicknameInput = document.getElementById('nickname'); // 닉네임 입력창
  const resultDisplay = document.getElementById('result'); // 결과 출력 영역
  const playerHead = document.getElementById('player-head'); // 플레이어 머리 영역
  const badgeDisplay = document.getElementById('badge-display'); // 배지 출력 영역
  const statsDisplay = document.getElementById('stats-display'); // 통계 출력 영역 (add this to HTML)

  // 메뉴 클릭 이벤트
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

  // API 호출: 닉네임으로 UUID 및 배지 데이터 검색
  async function fetchUUID(nickname) {
    const url = `.netlify/functions/fetch-minecraft?nickname=${nickname}`; // Netlify Function 경로
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('유저를 찾을 수 없습니다.');
      }
      const data = await response.json();
      return data; // UUID 및 배지 데이터 반환
    } catch (error) {
      console.error('API 오류:', error); // 오류 로그 확인
      return null;
    }
  }

  // API 호출: UUID로 머리 스킨 이미지 URL 생성
  function getSkinUrl(uuid) {
    return `https://crafatar.com/avatars/${uuid}?size=100&overlay`; // 플레이어 머리 이미지 URL
  }

  // GitHub에서 배지 이미지 가져오기
  async function fetchBadgeImage(badgeName) {
    const githubUrl = `https://raw.githubusercontent.com/RemoteKar/gcb/main/Resource/badge/${badgeName}.png`;
    try {
      const response = await fetch(githubUrl, {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`, // Use GitHub token for private repos
        },
      });
      if (!response.ok) {
        throw new Error('배지 이미지를 찾을 수 없습니다.');
      }
      return githubUrl; // 이미지 URL 반환
    } catch (error) {
      console.error('배지 이미지 오류:', error); // 오류 로그 확인
      return null;
    }
  }

  // 배지 아이콘 생성
  async function createBadgeIcon(badgeName) {
    const img = document.createElement('img');
    const imageUrl = await fetchBadgeImage(badgeName); // GitHub에서 이미지 URL 가져오기
    img.src = imageUrl || 'path/to/default-image.png'; // 기본 이미지 사용 (옵션)
    img.alt = badgeName; // 배지 이름 (alt 텍스트)
    img.classList.add('badge-icon'); // CSS 클래스 추가
    return img;
  }

  // 검색 버튼 클릭 이벤트
  searchButton.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      resultDisplay.textContent = '닉네임을 입력하세요!';
      return;
    }

    resultDisplay.textContent = '검색 중...';
    playerHead.innerHTML = ''; // 이전 머리 이미지 초기화
    badgeDisplay.innerHTML = ''; // 이전 배지 데이터 초기화
    statsDisplay.innerHTML = ''; // 이전 통계 데이터 초기화

    const data = await fetchUUID(nickname);
    if (data) {
      const { id: uuid, badges, statistics } = data;

      // Format UUID with hyphens
      const formattedUUID = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;

      resultDisplay.textContent = `닉네임: ${nickname} | UUID: ${formattedUUID}`;

      // 플레이어 머리 이미지 표시
      const img = document.createElement('img');
      img.src = getSkinUrl(uuid);
      img.alt = `${nickname}'s Head`;
      playerHead.appendChild(img);

      // 배지 데이터 표시
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

      // 통계 데이터 표시
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