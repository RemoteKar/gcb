document.addEventListener("DOMContentLoaded", async () => {
    const characterListDiv = document.getElementById("character-list");
    const pageTitle = document.getElementById("page-title");
    const sortByWinsButton = document.getElementById("sort-by-wins");
    const sortByPlaysButton = document.getElementById("sort-by-plays");
    const sortByKillsButton = document.getElementById("sort-by-kills");

    let allGameRecords = []; // 모든 게임 기록을 저장할 변수
    let currentSortBy = 'wins'; // 현재 정렬 기준

    async function fetchAllGameHistory() {
        try {
            const response = await fetch('/api/all_game_history');
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
        if (!allGameRecords || allGameRecords.length === 0) { // 한 번만 가져오도록 수정
            allGameRecords = await fetchAllGameHistory();
            if (!allGameRecords) { // fetchAllGameHistory가 null을 반환하면 여기서 종료
                characterListDiv.textContent = "캐릭터 통계를 불러오는 데 실패했습니다.";
                return;
            }
        }

        if (allGameRecords.length === 0) {
            characterListDiv.textContent = "게임 기록이 없습니다.";
            return;
        }

        // 최근 60게임으로 제한
        const recentGames = allGameRecords.slice(0, 60);

        const characterStats = {}; // { characterId: { wins: 0, plays: 0, kills: 0 } }

        recentGames.forEach(game => {
            if (game.content && game.content.Game && game.content.Game.joinedPlayers && game.content.Player) {
                const joinedPlayers = game.content.Game.joinedPlayers.split(',').map(s => s.trim());
                
                joinedPlayers.forEach(playerUUID => {
                    const playerData = game.content.Player[playerUUID];
                    if (playerData && playerData.Character !== undefined) {
                        const characterId = playerData.Character;
                        if (characterId > 0 && characterId < 900) { // 특정 값 이상인 캐릭터는 계산 대상에서 제외
                            if (!characterStats[characterId]) {
                                characterStats[characterId] = { wins: 0, plays: 0, kills: 0 };
                            }
                            characterStats[characterId].plays++;
                            if (playerData.outCuase === "우승") {
                                characterStats[characterId].wins++;
                            }
                            if (typeof playerData.kill === "number") {
                                characterStats[characterId].kills += playerData.kill;
                            }
                        }
                    }
                });
            }
        });

        let sortedCharacters = [];
        if (currentSortBy === 'wins') {
            sortedCharacters = Object.entries(characterStats).sort(([, statsA], [, statsB]) => statsB.wins - statsA.wins);
            pageTitle.textContent = "캐릭터 승리 통계 (최근 60게임)";
        } else if (currentSortBy === 'plays') {
            sortedCharacters = Object.entries(characterStats).sort(([, statsA], [, statsB]) => statsB.plays - statsA.plays);
            pageTitle.textContent = "캐릭터 플레이 횟수 통계 (최근 60게임)";
        } else if (currentSortBy === 'kills') {
            sortedCharacters = Object.entries(characterStats).sort(([, statsA], [, statsB]) => statsB.kills - statsA.kills);
            pageTitle.textContent = "캐릭터 킬 수 통계 (최근 60게임)";
        }

        characterListDiv.innerHTML = '';

        if (sortedCharacters.length === 0) {
            characterListDiv.textContent = "데이터가 없습니다.";
            return;
        }

        sortedCharacters.forEach(([characterId, stats], index) => {
            const charDiv = document.createElement('div');
            charDiv.classList.add('character-stat-item');
            let statValue = 0;
            if (currentSortBy === 'wins') {
                statValue = stats.wins;
            } else if (currentSortBy === 'plays') {
                statValue = stats.plays;
            } else if (currentSortBy === 'kills') {
                statValue = stats.kills;
            }

            charDiv.innerHTML = `
                <span class="rank-number">#${index + 1}</span> <!-- 순위 번호 추가 -->
                <img src="/Resource/character/${characterId ?? 'default'}.png" alt="Character ${characterId}" class="character-stat-img">
                <p><strong>${statValue}${currentSortBy === 'wins' ? '승' : currentSortBy === 'plays' ? '회' : '킬'}</strong></p>
            `;
            characterListDiv.appendChild(charDiv);
        });
    }

    // 버튼 이벤트 리스너
    sortByWinsButton.addEventListener('click', () => {
        currentSortBy = 'wins';
        document.querySelectorAll('.stat-button').forEach(btn => btn.classList.remove('active'));
        sortByWinsButton.classList.add('active');
        renderCharacterStats();
    });

    sortByPlaysButton.addEventListener('click', () => {
        currentSortBy = 'plays';
        document.querySelectorAll('.stat-button').forEach(btn => btn.classList.remove('active'));
        sortByPlaysButton.classList.add('active');
        renderCharacterStats();
    });

    sortByKillsButton.addEventListener('click', () => {
        currentSortBy = 'kills';
        document.querySelectorAll('.stat-button').forEach(btn => btn.classList.remove('active'));
        sortByKillsButton.classList.add('active');
        renderCharacterStats();
    });

    renderCharacterStats(); // 초기 렌더링
});