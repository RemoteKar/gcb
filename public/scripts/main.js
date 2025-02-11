//----------------------------------------
// 📌 main.js (디버깅 추가 및 통계 계산 기능 포함)
//----------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    const searchButton = document.getElementById("search-button");
    const nicknameInput = document.getElementById("nickname");
    const resultDisplay = document.getElementById("result");
    const playerHead = document.getElementById("player-head");
    const badgeDisplay = document.getElementById("badge-display");
    const statsDisplay = document.getElementById("stats-display");
  
    //----------------------------------------
    // 📌 Mojang UUID 조회 (Express API 호출)
    async function fetchMinecraftData(nickname) {
      const url = `/api/uuid?nickname=${encodeURIComponent(nickname)}`;
      console.log(`🔍 [fetchMinecraftData] 요청 URL: ${url}`);
  
      try {
        const response = await fetch(url);
        console.log(`🔍 [fetchMinecraftData] 응답 상태 코드: ${response.status}`);
  
        if (!response.ok) {
          throw new Error("유저를 찾을 수 없습니다.");
        }
  
        const data = await response.json();
        console.log("✅ [fetchMinecraftData] 데이터 받음:", data);
        return data;
      } catch (error) {
        console.error("❌ [fetchMinecraftData] API 오류:", error);
        return null;
      }
    }
  
    //----------------------------------------
    // 📌 서버에서 배지 데이터 가져오기
    async function fetchBadgeData(uuid) {
      const url = `/api/badge?uuid=${uuid}`;
      console.log(`🔍 [fetchBadgeData] 요청 URL: ${url}`);
  
      try {
        const response = await fetch(url);
        console.log(`🔍 [fetchBadgeData] 응답 상태 코드: ${response.status}`);
  
        if (!response.ok) {
          throw new Error("배지 데이터를 찾을 수 없습니다.");
        }
  
        const data = await response.json();
        console.log("✅ [fetchBadgeData] 데이터 받음:", data);
        return data;
      } catch (error) {
        console.error("❌ [fetchBadgeData] API 오류:", error);
        return null;
      }
    }
  
    //----------------------------------------
    // 📌 서버에서 게임 기록 가져오기
    async function fetchGameHistory(uuid) {
      const url = `/api/gameHistory?uuid=${uuid}`;
      console.log(`🔍 [fetchGameHistory] 요청 URL: ${url}`);
  
      try {
        const response = await fetch(url);
        console.log(`🔍 [fetchGameHistory] 응답 상태 코드: ${response.status}`);
  
        if (!response.ok) {
          throw new Error("게임 기록을 찾을 수 없습니다.");
        }
  
        const data = await response.json();
        console.log("✅ [fetchGameHistory] 데이터 받음:", data);
        return data;
      } catch (error) {
        console.error("❌ [fetchGameHistory] API 오류:", error);
        return null;
      }
    }
  
    //----------------------------------------
    // 📌 게임 기록 배열을 바탕으로 통계 계산하는 함수 (위에서 정의한 computeStatistics)
    function formatUUID(uuid) {
        if (typeof uuid !== "string" || uuid.length !== 32) {
          return uuid;
        }
        return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
      }

    function computeStatistics(gameRecords, uuid) {
      let totalGames = gameRecords.length || 0;
      let winCount = 0;
      let totalDamageDealt = 0;
      let totalKills = 0;
      let totalAliveTime = 0;
      const characterCounts = {};
      const augmentCounts = {};
  
      const formattedUUID = '"'+formatUUID(uuid)+'"';
      gameRecords.forEach(record => {
        if (record.Player && record.Player[formattedUUID]) {
          totalGames++;
          const playerData = record.Player[formattedUUID];
  
          if (playerData.outCuase === "우승") {
            winCount++;
          }
          if (playerData.Damage && typeof playerData.Damage.Dealt === "number") {
            totalDamageDealt += playerData.Damage.Dealt;
          }
          if (typeof playerData.kill === "number") {
            totalKills += playerData.kill;
          }
          if (typeof playerData.TimeSurvived === "number") {
            totalAliveTime += playerData.TimeSurvived;
          }
          const character = playerData.Character;
          if (character !== undefined) {
            characterCounts[character] = (characterCounts[character] || 0) + 1;
          }
          if (playerData.Augment) {
            Object.values(playerData.Augment).forEach(augmentValue => {
              augmentCounts[augmentValue] = (augmentCounts[augmentValue] || 0) + 1;
            });
          }
        }
      });
  
      if (totalGames === 0) {
        return {
          winRate: "0.00",
          mostUsedCharacter: "N/A",
          mostUsedAugments: [],
          averageDamageDealt: "0.00",
          averageKillRate: "0.00",
          averageAliveTime: "0.00"
        };
      }
  
      const winRate = ((winCount / totalGames) * 100).toFixed(2);
      const averageDamageDealt = (totalDamageDealt / totalGames).toFixed(2);
      const averageKillRate = (totalKills / totalGames).toFixed(2);
      const averageAliveTime = (totalAliveTime / totalGames).toFixed(2);
  
      let mostUsedCharacter = "N/A";
      let maxCharacterCount = 0;
      for (const char in characterCounts) {
        if (characterCounts[char] > maxCharacterCount) {
          maxCharacterCount = characterCounts[char];
          mostUsedCharacter = char;
        }
      }
  
      const mostUsedAugments = Object.entries(augmentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(entry => entry[0]);
  
      return {
        winRate,
        mostUsedCharacter,
        mostUsedAugments,
        averageDamageDealt,
        averageKillRate,
        averageAliveTime,
        totalGames
      };
    }
  
    //----------------------------------------
    // 📌 검색 버튼 클릭 이벤트
    searchButton.addEventListener("click", async () => {
      const nickname = nicknameInput.value.trim();
      if (!nickname) {
        resultDisplay.textContent = "닉네임을 입력하세요!";
        return;
      }
  
      console.log(`🔍 [검색 시작] 닉네임: ${nickname}`);
  
      resultDisplay.textContent = "검색 중...";
      playerHead.innerHTML = "";
      badgeDisplay.innerHTML = "";
      statsDisplay.innerHTML = "";
  
      //----------------------------------------
      // 📌 UUID 가져오기
      const data = await fetchMinecraftData(nickname);
      if (!data) {
        resultDisplay.textContent = "UUID를 찾을 수 없습니다.";
        return;
      }
  
      const uuid = data.uuid;
      console.log(`✅ [검색 완료] UUID: ${uuid}`);
      resultDisplay.textContent = `UUID: ${uuid}`;
  
      //----------------------------------------
      // 📌 플레이어 머리 이미지 표시
      const img = document.createElement("img");
      img.src = `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
      img.alt = `${nickname}'s Head`;
      playerHead.appendChild(img);
  
      //----------------------------------------
      // 📌 배지 데이터 가져오기 및 표시
      const badges = await fetchBadgeData(uuid);
      if (badges) {
        badgeDisplay.innerHTML = `<strong>배지:</strong> ${badges.current || "없음"}`;
      } else {
        badgeDisplay.textContent = "배지 데이터 없음";
      }
  
      //----------------------------------------
      // 📌 게임 기록 가져오기 및 통계 계산 후 표시
      const gameHistory = await fetchGameHistory(uuid);
      if (gameHistory) {
        const statistics = computeStatistics(gameHistory, uuid);
        statsDisplay.innerHTML = `
          <p><strong>총 게임 수:</strong> ${statistics.totalGames}게임</p>
          <p><strong>승률:</strong> ${statistics.winRate}%</p>
          <p><strong>가장 많이 사용한 캐릭터:</strong> ${statistics.mostUsedCharacter}</p>
          <p><strong>가장 많이 사용한 증강:</strong> ${statistics.mostUsedAugments.join(', ')}</p>
          <p><strong>평균 데미지:</strong> ${statistics.averageDamageDealt}</p>
          <p><strong>평균 킬 수:</strong> ${statistics.averageKillRate}</p>
          <p><strong>평균 생존시간:</strong> ${statistics.averageAliveTime}</p>
        `;
      } else {
        statsDisplay.textContent = "게임 기록 없음";
      }
    });
  });
  