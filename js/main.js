//----------------------------------------
// scripts/main.js
//----------------------------------------

const GITHUB_TOKEN = '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'; // (실제 토큰 사용 시 주의)

document.addEventListener('DOMContentLoaded', () => {
  const menuLinks = document.querySelectorAll('.menu-link'); // 메뉴 링크들
  const sections = document.querySelectorAll('.section'); // 모든 섹션
  const searchButton = document.getElementById('search-button'); // 검색 버튼
  const nicknameInput = document.getElementById('nickname'); // 닉네임 입력창
  const resultDisplay = document.getElementById('result'); // 결과 출력 영역
  const playerHead = document.getElementById('player-head'); // 플레이어 머리 영역
  const badgeDisplay = document.getElementById('badge-display'); // 배지 출력 영역
  const statsDisplay = document.getElementById('stats-display'); // 통계 출력 영역

  //----------------------------------------
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

  // Netlify Function을 호출하는 API 함수
  async function fetchMinecraftData(nickname) {
    resultDisplay.textContent = '검색 중...2';
    const url = `.netlify/functions/fetch-minecraft?nickname=${encodeURIComponent(nickname)}`;
    console.log(`Fetching data for: ${nickname}`); // 닉네임 로그
    try {
      const response = await fetch(url);
      console.log('API Response:', response); // 응답 로그
  
      if (!response.ok) {
        throw new Error(`유저를 찾을 수 없습니다. (HTTP ${response.status})`);
      }
  
      const data = await response.json();
      console.log('Fetched Data:', data); // 가져온 데이터 로그
      return data;
    } catch (error) {
      console.error('API 오류:', error);
      return null;
    }
  }

  //----------------------------------------
  // 플레이어 머리 스킨 URL 생성 함수 (Crafatar 사용)
  function getSkinUrl(uuid) {
    return `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
  }

  //----------------------------------------
  // GitHub에서 배지 이미지 가져오기 (단, Netlify Function에서는 YAML 데이터를 읽어 배지 정보를 제공)
  async function createBadgeIcon(badgeName) {
    const img = document.createElement('img');
    // GitHub에서 직접 이미지를 불러올 수도 있고, 필요하다면 Netlify Function을 통해 처리할 수도 있습니다.
    // 여기서는 raw URL 형식으로 불러옵니다.
    const imageUrl = `https://raw.githubusercontent.com/RemoteKar/gcb/contents/Resource/badge/${badgeName}.png`;
    img.src = imageUrl;
    img.alt = badgeName;
    img.classList.add('badge-icon');
    img.onerror = () => {
      img.src = 'path/to/default-image.png'; // 기본 이미지
      console.error(`Failed to load badge image: ${badgeName}`);
    };
    return img;
  }

  //----------------------------------------
  // 검색 버튼 클릭 이벤트 핸들러
  searchButton.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      resultDisplay.textContent = '닉네임을 입력하세요!';
      return;
    }
    resultDisplay.textContent = '검색 중...1';
    playerHead.innerHTML = '';
    badgeDisplay.innerHTML = '';
    statsDisplay.innerHTML = '';

    const data = await fetchMinecraftData(nickname);
    
    if (!data) {
      resultDisplay.textContent = '검색 실패: 서버 응답 없음.';
      return;
    }

    const { id: uuid, badges, statistics } = data;
    // UUID에 하이픈 추가 (예: 8-4-4-4-12)
    const formattedUUID = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
    resultDisplay.textContent = `닉네임: ${nickname} | UUID: ${formattedUUID}`;

    //----------------------------------------
    // 플레이어 머리 이미지 표시
    const img = document.createElement('img');
    img.src = getSkinUrl(uuid);
    img.alt = `${nickname}'s Head`;
    playerHead.appendChild(img);

    //----------------------------------------
    // 배지 데이터 표시
    if (badges) {
      const badgeList = badges.List || [];
      const currentBadge = badges.current || '없음';

      const currentBadgeContainer = document.createElement('div');
      currentBadgeContainer.innerHTML = `<strong>현재 배지:</strong>`;
      currentBadgeContainer.appendChild(await createBadgeIcon(currentBadge));
      badgeDisplay.appendChild(currentBadgeContainer);

      const ownedBadgesContainer = document.createElement('div');
      ownedBadgesContainer.innerHTML = `<strong>보유 배지:</strong>`;
      for (const badgeName of badgeList) {
        ownedBadgesContainer.appendChild(await createBadgeIcon(badgeName));
      }
      badgeDisplay.appendChild(ownedBadgesContainer);
    } else {
      badgeDisplay.textContent = '배지 데이터가 없습니다.';
    }

    //----------------------------------------
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

  });
});
