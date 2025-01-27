document.addEventListener('DOMContentLoaded', () => {
  const menuLinks = document.querySelectorAll('.menu-link'); // 메뉴 링크
  const sections = document.querySelectorAll('.section'); // 모든 섹션
  const searchButton = document.getElementById('search-button'); // 검색 버튼
  const nicknameInput = document.getElementById('nickname'); // 닉네임 입력창
  const resultDisplay = document.getElementById('result'); // 결과 출력 영역
  const playerHead = document.getElementById('player-head'); // 플레이어 머리 영역
  const badgeDisplay = document.getElementById('badge-display'); // 배지 출력 영역 (add this to HTML)

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

    const data = await fetchUUID(nickname);
    if (data) {
      const { id: uuid, badges } = data;
      resultDisplay.textContent = `닉네임: ${nickname} | UUID: ${uuid}`;

      // 플레이어 머리 이미지 표시
      const img = document.createElement('img');
      img.src = getSkinUrl(uuid);
      img.alt = `${nickname}'s Head`;
      playerHead.appendChild(img);

      // 배지 데이터 표시
      if (badges) {
        const badgeList = badges.List || [];
        const currentBadge = badges.current || '없음';
        badgeDisplay.innerHTML = `
          <p><strong>현재 배지:</strong> ${currentBadge}</p>
          <p><strong>보유 배지:</strong> ${badgeList.join(', ')}</p>
        `;
      } else {
        badgeDisplay.textContent = '배지 데이터가 없습니다.';
      }
    } else {
      resultDisplay.textContent = 'UUID를 찾을 수 없습니다.';
    }
  });
});