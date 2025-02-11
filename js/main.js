// js/main.js
import { fetchUserData, getSkinUrl } from './api.js';
import { updatePlayerHead, updateBadgeDisplay, updateStatisticsDisplay } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const searchButton = document.getElementById('search-button');
  const nicknameInput = document.getElementById('nickname');
  const resultDisplay = document.getElementById('result');
  const playerHeadContainer = document.getElementById('player-head');
  // HTML 내에 배지와 통계 정보를 표시할 요소 (예: id="badge-display", id="stats-display")
  const badgeContainer = document.getElementById('badge-display');
  const statsContainer = document.getElementById('stats-display');

  searchButton.addEventListener('click', async () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      resultDisplay.textContent = '닉네임을 입력하세요!';
      return;
    }

    resultDisplay.textContent = '검색 중...';
    playerHeadContainer.innerHTML = '';
    badgeContainer.innerHTML = '';
    statsContainer.innerHTML = '';

    // Netlify Function을 호출하여 유저 데이터를 가져옵니다.
    const data = await fetchUserData(nickname);
    if (!data) {
      resultDisplay.textContent = 'UUID를 찾을 수 없습니다.';
      return;
    }
    const { id: uuid, badges, statistics } = data;
    resultDisplay.textContent = `닉네임: ${nickname} | UUID: ${uuid}`;

    // 플레이어 머리 이미지 업데이트
    updatePlayerHead(playerHeadContainer, uuid, nickname);

    // 배지 데이터 업데이트
    updateBadgeDisplay(badgeContainer, badges);

    // 통계 데이터 업데이트
    updateStatisticsDisplay(statsContainer, statistics);
  });
});
