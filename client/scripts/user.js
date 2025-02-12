

document.addEventListener("DOMContentLoaded", async () => {
    // URL 경로에서 닉네임 추출 (예: /user/Steve)
    const pathParts = window.location.pathname.split('/');
    // pathParts[0]는 빈 문자열, [1]는 "user", [2]는 닉네임
    const nickname = decodeURIComponent(pathParts[2] || "");
    const userTitle = document.getElementById("user-title");
    const playerHead = document.getElementById("player-head");
    const badgeDisplay = document.getElementById("badge-display");
    const statsDisplay = document.getElementById("stats-display");
  
    if (!nickname) {
      document.body.innerHTML = "<h1>닉네임이 없습니다.</h1>";
      return;
    }
    userTitle.textContent = `${nickname}`;
  
    // ──────────────────────────────
    // API 호출 함수들 (index.html의 main.js 코드 일부를 재사용)
    async function fetchMinecraftData(nickname) {
      const url = `/api/uuid?nickname=${encodeURIComponent(nickname)}`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("유저를 찾을 수 없습니다.");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("fetchMinecraftData error:", error);
        return null;
      }
    }
  
    async function fetchBadgeData(uuid) {
      const url = `/api/badge?uuid=${uuid}`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("배지 데이터를 찾을 수 없습니다.");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("fetchBadgeData error:", error);
        return null;
      }
    }
  
    async function fetchGameHistory(uuid) {
      const url = `/api/gameHistory?uuid=${uuid}`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("게임 기록을 찾을 수 없습니다.");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("fetchGameHistory error:", error);
        return null;
      }
    }
  
    function formatUUID(uuid) {
      if (typeof uuid !== "string" || uuid.length !== 32) return uuid;
      return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
    }
  
    function computeStatistics(gameRecords, uuid) {
      let totalGames = gameRecords.length || 0;
      let winCount = 0;
      let totalDamageDealt = 0;
      let totalDamageTaken = 0;
      let totalKills = 0;
      let totalAliveTime = 0;
      let maxDamageDealt = 0;
      let maxDamageTaken = 0;
      let maxKill = 0;  
      let rankAtLeast50 = 0;
      const characterCounts = {};
      const augmentCounts = {};
  
      const formattedUUID = formatUUID(uuid);
      gameRecords.forEach(record => {
        if (record.Player && record.Player[formattedUUID]) {
          totalGames++;
          const playerData = record.Player[formattedUUID];
      
          if (playerData.Ranking / record.Game.amountOfPlayers <= 0.5) {
            rankAtLeast50++;
          }
          if (playerData.outCuase === "우승") {
            winCount++;
          }
          if (playerData.Damage) {
            if (typeof playerData.Damage.Dealt === "number") {
              if (playerData.Damage.Dealt >= maxDamageDealt) {
                maxDamageDealt = playerData.Damage.Dealt;
              }
              totalDamageDealt += playerData.Damage.Dealt;
            }
            if (typeof playerData.Damage.Taken === "number") {
              if (playerData.Damage.Taken >= maxDamageTaken) {
                maxDamageTaken = playerData.Damage.Taken;
              }
              totalDamageTaken += playerData.Damage.Taken;
            }
          }
          if (typeof playerData.kill === "number") {
            if (playerData.kill >= maxKill) {
              maxKill = playerData.kill;
            }
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
          winRate: "0.0",
          winCount: "0",
          avarageRankLeast50: 0.0,
          mostUsedCharacter: "N/A",
          mostUsedAugments: [],
          averageDamageDealt: "0",
          averageDamageTaken: "0",       
          averageKillRate: "0.0",
          averageAliveTime: "0.0",
          maxDamageDealt: "0",
          maxDamageTaken: "0",
          maxKill: "0",   
          totalGames: "0"
        };
      }
  
      const winRate = ((winCount / totalGames) * 100).toFixed(1);
      const avarageRankLeast50 = ((rankAtLeast50 / totalGames) * 100).toFixed(1);
      const averageDamageDealt = (totalDamageDealt / totalGames).toFixed(0);
      const averageDamageTaken = (totalDamageTaken / totalGames).toFixed(0);
      const averageKillRate = (totalKills / totalGames).toFixed(2);
      const averageAliveTime = (totalAliveTime / totalGames).toFixed(1);
      let mostUsedCharacter = "N/A";
      let maxCharacterCount = 0;
      maxDamageDealt = maxDamageDealt.toFixed(0);
      maxDamageTaken = maxDamageTaken.toFixed(0);
  
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
        winCount,
        avarageRankLeast50,
        mostUsedCharacter,
        mostUsedAugments,
        averageDamageDealt,
        averageDamageTaken,        
        averageKillRate,
        averageAliveTime,
        maxDamageDealt,
        maxDamageTaken,   
        maxKill,
        totalGames
      };
    }
  
    // ──────────────────────────────
    // 순서대로 API 호출하여 데이터 표시
  
    // 1. Mojang UUID 조회
    const data = await fetchMinecraftData(nickname);
    if (!data) {
      userTitle.textContent = "UUID를 찾을 수 없습니다.";
      return;
    }
    const uuid = data.uuid;
  
    // 2. 플레이어 머리 이미지 표시
    const headImg = document.createElement("img");
    headImg.src = `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
    headImg.alt = `${nickname}'s Head`;
    playerHead.appendChild(headImg);
  
    // 3. 배지 데이터 가져오기 및 표시
    const badges = await fetchBadgeData(uuid);
    if (badges && badges.current) {
      const badgeName = badges.current;
      const badgeImg = document.createElement("img");
      badgeImg.src = `/Resource/badge/${badgeName}.png`;
      badgeImg.alt = badgeName;
      badgeImg.classList.add("badge-img");
      badgeDisplay.innerHTML = `<strong></strong> `;
      badgeDisplay.appendChild(badgeImg);
    }
  
    // 4. 게임 기록 및 통계 데이터 가져오기 및 표시
    const gameHistory = await fetchGameHistory(uuid);
    if (gameHistory) {
      const statistics = computeStatistics(gameHistory, uuid);
      statsDisplay.innerHTML = `
        <p><strong>총 게임 수:</strong> ${statistics.totalGames}게임</p>
        <p><strong>승률:</strong> ${statistics.winRate}% (${statistics.winCount}승)</p>
        <p><strong>순방률:</strong> ${statistics.avarageRankLeast50}%</p>
        <p><strong>가한 피해:</strong> ${statistics.averageDamageDealt} (${statistics.maxDamageDealt})</p>
        <p><strong>받은 피해:</strong> ${statistics.averageDamageTaken} (${statistics.maxDamageTaken})</p>        
        <p><strong>처치:</strong> ${statistics.averageKillRate} (${statistics.maxKill})</p>
        <p><strong>평균 생존시간:</strong> ${statistics.averageAliveTime}</p>
      `;
    
      // 캐릭터 이미지 + 테두리 오버레이 (모스트 캐릭터)
      const charContainer = document.createElement("div");
      charContainer.classList.add("char-container");
    
      const charImg = document.createElement("img");
      charImg.src = `/Resource/character/${statistics.mostUsedCharacter}.png`;
      charImg.alt = statistics.mostUsedCharacter;
      charImg.classList.add("char-img");
    
      const borderImg = document.createElement("img");
      borderImg.src = `/Resource/character/nemo.png`;
      borderImg.alt = "border";
      borderImg.classList.add("border-img");
    
      charContainer.appendChild(charImg);
      charContainer.appendChild(borderImg);
    
      statsDisplay.prepend(charContainer);
    } else {
      statsDisplay.textContent = "게임 기록 없음";
    }
  });
  