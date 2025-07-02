document.addEventListener("DOMContentLoaded", async () => {
    const characterListDiv = document.getElementById("character-list");

    async function fetchAllGameHistory() {
        try {
            // 서버에 모든 게임 기록을 요청하는 새로운 API 엔드포인트가 필요합니다.
            // 현재는 /api/statistic?uuid={uuid} 밖에 없으므로,
            // 서버에 /api/all_game_history 엔드포인트를 추가해야 합니다.
            // 임시로 모든 게임 기록을 가져오는 API가 있다고 가정합니다.
            const response = await fetch('/api/all_game_history'); // 이 엔드포인트는 아직 없습니다。
            if (!response.ok) {
                throw new Error('모든 게임 기록을 가져오는 데 실패했습니다.');
            }
            const data = await response.json();
            return data.gameRecords; // 서버 응답 구조에 따라 조정
        } catch (error) {
            console.error("fetchAllGameHistory error:", error);
            characterListDiv.textContent = "캐릭터 통계를 불러오는 데 실패했습니다.";
            return null;
        }
    }

    // 캐릭터 통계 계산 및 렌더링 함수
    async function renderCharacterStats() {
        characterListDiv.textContent = "데이터 로딩 중...";
        const allGameRecords = await fetchAllGameHistory();

        if (!allGameRecords || allGameRecords.length === 0) {
            characterListDiv.textContent = "게임 기록이 없습니다.";
            return;
        }

        // 최근 40게임으로 제한 (가장 최신 게임부터)
        const recentGames = allGameRecords.slice(0, 60);

        const characterWinCounts = {}; // { characterId: winCount }

        recentGames.forEach(game => {
            if (game.Game && game.Game.joinedPlayers && game.Player) {
                const joinedPlayers = game.Game.joinedPlayers.split(',').map(s => s.trim());
                
                joinedPlayers.forEach(playerUUID => {
                    const playerData = game.Player[playerUUID];
                    if (playerData && playerData.Character !== undefined && playerData.outCuase === "우승") {
                        const characterId = playerData.Character;
                        // 특정 값 이상인 캐릭터는 계산 대상에서 제외 (statistics.js와 동일하게)
                        if (characterId < 900) {
                            characterWinCounts[characterId] = (characterWinCounts[characterId] || 0) + 1;
                        }
                    }
                });
            }
        });

        // 승리 횟수 기준으로 정렬
        const sortedCharacters = Object.entries(characterWinCounts).sort(([, countA], [, countB]) => countB - countA);

        characterListDiv.innerHTML = ''; // 기존 "데이터 로딩 중..." 메시지 제거

        if (sortedCharacters.length === 0) {
            characterListDiv.textContent = "승리한 캐릭터 데이터가 없습니다.";
            return;
        }

        sortedCharacters.slice(0, 20).forEach(([characterId, winCount]) => {
            const charDiv = document.createElement('div');
            charDiv.classList.add('character-stat-item');
            charDiv.innerHTML = `
                <img src="/Resource/character/${characterId}.png" alt="Character ${characterId}" class="character-stat-img">
                <p><strong>${winCount}승</strong></p>
            `;
            characterListDiv.appendChild(charDiv);
        });
    }

    renderCharacterStats();
});