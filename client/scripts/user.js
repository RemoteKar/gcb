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
  // pathParts[0]는 빈 문자열, [1]은 "user", [2]는 닉네임
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
  // API 호출 함수들
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
  // 1. Mojang UUID 조회
  const data = await fetchMinecraftData(nickname);
  if (!data) {
    userTitle.textContent = "UUID를 찾을 수 없습니다.";
    return;
  }
  const uuid = data.uuid;

  // ──────────────────────────────
  // 2. 플레이어 머리 이미지 표시
  const headImg = document.createElement("img");
  headImg.src = `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
  headImg.alt = `${nickname}'s Head`;
  playerHead.appendChild(headImg);

  // ──────────────────────────────
  // 3. 배지 데이터 가져오기 및 표시
  const badges = await fetchBadgeData(uuid);
  if (badges && badges.current) {
    const badgeName = badges.current;
    const badgeImg = document.createElement("img");
    badgeImg.src = `/Resource/badge/${badgeName}.png`;
    badgeImg.alt = badgeName;
    badgeImg.classList.add("badge-img");
    badgeDisplay.innerHTML = `<strong></strong>`;
    badgeDisplay.appendChild(badgeImg);
  }

  // ──────────────────────────────
  // 4. 게임 기록 및 통계 데이터 가져오기 및 표시
  const statisticsData = await fetchStatistic(uuid);
  if (!statisticsData) {
    statsDisplay.textContent = "게임 기록 없음";
    return;
  }
  // statisticsData 구조: { statistics, gameRecords }
  const { statistics, gameRecords } = statisticsData;

  // 4-1. 통계 데이터 표시 (왼쪽 영역)
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
  }

  // ──────────────────────────────
  // 5. 오른쪽 영역: 게임 리스트 (수직 리스트 형태) 구현
  if (Array.isArray(gameRecords) && gameRecords.length > 0) {
    initGameList(gameRecords, uuid);
  } else {
    const gameList = document.getElementById("gameList");
    gameList.textContent = "플레이 기록이 없습니다.";
    document.getElementById("loadMoreButton").style.display = "none";
  }
});

// ──────────────────────────────
// 전역 변수 및 페이지네이션 관련 상수
let allGames = [];
let currentOffset = 0;
const PAGE_SIZE = 10;

// 파일 이름(날짜 형식) 파싱 함수
function parseDateFromFileName(fileName) {
  // 파일 이름 예시: "2025.02.09-18.57.05"
  const parts = fileName.split('-');
  return `${parts[0]}`;
}

// 초기화 및 [더보기] 버튼 클릭 시 추가 렌더링 함수
function initGameList(gameRecords, uuid) {
  allGames = gameRecords.slice().reverse(); // 전체 게임 기록 배열 저장
  currentOffset = 0;      // 페이지 시작 인덱스 초기화

  // 최초 PAGE_SIZE개 렌더링
  renderNextGames(uuid);

  // [더보기] 버튼에 이벤트 리스너 등록
  const loadMoreButton = document.getElementById("loadMoreButton");
  loadMoreButton.addEventListener("click", () => {
    renderNextGames(uuid);
  });
}

// 추가 로드할 PAGE_SIZE개의 게임 기록 렌더링 함수
function renderNextGames(uuid) {
  const gameListContainer = document.getElementById("gameList");

  // 현재 인덱스부터 PAGE_SIZE만큼 잘라내기
  const nextSlice = allGames.slice(currentOffset, currentOffset + PAGE_SIZE);
  currentOffset += PAGE_SIZE;

  nextSlice.forEach(game => {
    const gameItem = document.createElement("div");
    gameItem.classList.add("game-item");

    // YAML 데이터에 파일 이름이 있다면(서버에서 추가됨) 날짜 형식으로 파싱해서 사용,
    // 그렇지 않으면 game.Game.date 필드를 사용 (없으면 'N/A')
    let displayDate = 'N/A';
    if (game.fileName) {
      displayDate = parseDateFromFileName(game.fileName);
    } else if (game.Game.date) {
      displayDate = game.Game.date;
    }

    // 유저별 데이터 접근 (UUID 포맷에 따라 조정)
    const formattedUUID = formatUUID(uuid);
    const playerData = (game.Player && game.Player[formattedUUID]) || {};
    const ranking = (playerData.Ranking !== undefined)? playerData.Ranking: (playerData.ranking !== undefined ? playerData.ranking : '0');
    const kills = (playerData.kill !== undefined)? playerData.kill: (playerData.Kill !== undefined ? playerData.Kill : 0);

    gameItem.innerHTML = `
    <div class="game-card">
      <div class="game-card-left">
        <img src="/Resource/character/${playerData.Character}.png" alt="Game Image" class="game-card-img">
      </div>
      <div class="game-card-right">
        </strong> ${displayDate}</p>
        <p><strong>랭킹:</strong> ${ranking}/${game.Game.amountOfPlayers}</p>
        <p><strong>처치:</strong> ${kills}</p>
        <p><strong>생존:</strong> ${playerData.TimeSurvived}</p>
      </div>
      <div  class="game-card-augment">
        <img src="/Resource/augment/icon/${playerData.Augment[1]}.png" alt="Augment1">
        <img src="/Resource/augment/icon/${playerData.Augment[2]}.png" alt="Augment2">
        <img src="/Resource/augment/icon/${playerData.Augment[3]}.png" alt="Augment3">
        <img src="/Resource/augment/icon/${playerData.Augment[4]}.png" alt="Augment4">
      </div>
    </div>
  `;
  
  

    gameListContainer.appendChild(gameItem);
  });

  // 더 이상 추가할 게임이 없다면 [더보기] 버튼 숨김 처리
  if (currentOffset >= allGames.length) {
    const loadMoreButton = document.getElementById("loadMoreButton");
    loadMoreButton.style.display = 'none';
  }
}

function formatUUID(uuid) {
  if (typeof uuid !== "string" || uuid.length !== 32) {
    return uuid;
  }
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

module.exports = { formatUUID };