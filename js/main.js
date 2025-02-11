// main.js
import { fetchUserData, getSkinUrl } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('search-button');
    const nicknameInput = document.getElementById('nickname');
    const resultDisplay = document.getElementById('result');
    const playerHeadContainer = document.getElementById('player-head');
    // 게임 기록을 표시할 영역 (HTML에서 id="game-history"인 요소를 추가하세요)
    const gameHistoryContainer = document.getElementById('game-history');

    searchButton.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        if (!nickname) {
            resultDisplay.textContent = '닉네임을 입력하세요!';
            return;
        }

        resultDisplay.textContent = '검색 중...';
        playerHeadContainer.innerHTML = '';
        gameHistoryContainer.innerHTML = '';

        // API 호출하여 유저 데이터 가져오기
        const data = await fetchUserData(nickname);
        if (!data) {
            resultDisplay.textContent = 'UUID를 찾을 수 없습니다.';
            return;
        }
        const { id: uuid, gameHistory } = data;
        resultDisplay.textContent = `닉네임: ${nickname} | UUID: ${uuid}`;

        // 플레이어 머리 이미지 업데이트
        const img = document.createElement('img');
        img.src = getSkinUrl(uuid);
        img.alt = `${nickname}'s Head`;
        playerHeadContainer.appendChild(img);

        // 게임 기록 데이터 표시
        if (!gameHistory || gameHistory.length === 0) {
            gameHistoryContainer.textContent = '참여한 게임 기록이 없습니다.';
        } else {
            gameHistory.forEach((record, index) => {
                const recordDiv = document.createElement('div');
                recordDiv.classList.add('game-record');
                // 여기서는 단순히 JSON 문자열로 기록을 출력합니다.
                // 필요에 따라 HTML 구조를 개선할 수 있습니다.
                recordDiv.innerHTML = `<strong>Game ${index + 1}:</strong> ${JSON.stringify(record)}`;
                gameHistoryContainer.appendChild(recordDiv);
            });
        }
    });
});
