
document.addEventListener("DOMContentLoaded", () => {
  const searchButton = document.getElementById("search-button");
  const nicknameInput = document.getElementById("nickname");
  searchButton.addEventListener("click", () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      return;
    }
    // 검색 후 /user/{닉네임}으로 이동
    window.location.href = `/user/${encodeURIComponent(nickname)}`;
  });
});


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
  
    async function fetchStatistic(uuid) {
      const url = `/api/statistic?uuid=${uuid}`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("게임 기록을 찾을 수 없습니다.");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("fetchStatistic error:", error);
        return null;
      }
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
    const statistics = await fetchStatistic(uuid);
    if (statistics) {
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
  