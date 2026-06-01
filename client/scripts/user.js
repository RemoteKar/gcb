document.addEventListener("DOMContentLoaded", async () => {
  // 검색 버튼 이벤트 리스너 등록
  const searchButton = document.getElementById("search-button");
  const nicknameInput = document.getElementById("nickname");
  if (searchButton && nicknameInput) {
    searchButton.addEventListener("click", () => {
      const searchNickname = nicknameInput.value.trim();
      if (!searchNickname) {
        return;
      }
      window.location.href = `/user/${encodeURIComponent(searchNickname)}`;
    });
  }

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
    const staticUrl = `/data/user-statistics/${formatUUID(uuid)}.json`;
    try {
      const staticResponse = await fetch(staticUrl);
      if (staticResponse.ok) {
        return await staticResponse.json();
      }
    } catch (error) {
      console.warn("fetchStaticStatistic error:", error);
    }

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
  console.log(`[DEBUG] UUID for avatar: ${uuid}`);
  const headImg = document.createElement("img");
  headImg.src = `https://mc-heads.net/avatar/${uuid}/100`;
  headImg.alt = `${nickname}'s Head`;
  headImg.onerror = () => {
    console.error(`[ERROR] Failed to load avatar for UUID: ${uuid}`);
    headImg.src = `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
  };
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
      <div class="user-stat-grid">
        <div class="user-stat-card user-stat-card-primary">
          <span class="user-stat-label">승률</span>
          <strong class="user-stat-value">${statistics.winRate}%</strong>
          <span class="user-stat-meta">${statistics.winCount}승</span>
        </div>
        <div class="user-stat-card">
          <span class="user-stat-label">게임</span>
          <strong class="user-stat-value">${statistics.totalGames}</strong>
          <span class="user-stat-meta">판</span>
        </div>
        <div class="user-stat-card">
          <span class="user-stat-label">순방률</span>
          <strong class="user-stat-value">${statistics.avarageRankLeast50}%</strong>
          <span class="user-stat-meta">상위권</span>
        </div>
        <div class="user-stat-card">
          <span class="user-stat-label">처치</span>
          <strong class="user-stat-value">${statistics.averageKillRate}</strong>
          <span class="user-stat-meta">최대 ${statistics.maxKill}</span>
        </div>
        <div class="user-stat-card">
          <span class="user-stat-label">가한 피해</span>
          <strong class="user-stat-value">${statistics.averageDamageDealt}</strong>
          <span class="user-stat-meta">최대 ${statistics.maxDamageDealt}</span>
        </div>
        <div class="user-stat-card">
          <span class="user-stat-label">받은 피해</span>
          <strong class="user-stat-value">${statistics.averageDamageTaken}</strong>
          <span class="user-stat-meta">최대 ${statistics.maxDamageTaken}</span>
        </div>
      </div>
      <div class="user-survival-stat">
        <span>평균 생존시간</span>
        <strong>${statistics.averageAliveTime}</strong>
      </div>
    `;
    
    // 캐릭터 이미지 + 테두리 오버레이 (모스트 캐릭터)
    const charContainer = document.createElement("div");
    charContainer.classList.add("char-container");
    charContainer.classList.add("profile-favorite-character");

    const mostUsedId = statistics.mostUsedCharacter;
    const mostUsedIsCreative = CharacterConfig.isCreativeCharacter(mostUsedId);
    const charImg = document.createElement("img");
    charImg.src = mostUsedIsCreative
      ? `/Resource/character/0.png`
      : `/Resource/character/${mostUsedId}.png`;
    charImg.alt = mostUsedIsCreative
      ? CharacterConfig.getCreativeCharacterName(mostUsedId)
      : String(mostUsedId);
    charImg.classList.add("char-img");
  
    const borderImg = document.createElement("img");
    borderImg.src = `/Resource/character/nemo.png`;
    borderImg.alt = "border";
    borderImg.classList.add("border-img");
  
    charContainer.appendChild(charImg);
    charContainer.appendChild(borderImg);
  
    statsDisplay.prepend(charContainer);

    // 캐릭터별 통계 렌더링
    if (statistics.characterStats && statistics.characterStats.length > 0) {
      const charStatsSection = document.createElement('div');
      charStatsSection.className = 'user-char-stats';
      charStatsSection.innerHTML = '<h3 class="user-char-stats-title">캐릭터별 통계</h3>';

      const INITIAL_COUNT = 10;
      const allStats = statistics.characterStats;

      allStats.forEach((cs, idx) => {
        const row = document.createElement('div');
        row.className = 'user-char-stat-row';
        if (idx >= INITIAL_COUNT) row.classList.add('user-char-stat-hidden');

        const isCreative = CharacterConfig.isCreativeCharacter(cs.characterId);
        const portraitSrc = isCreative
          ? `/Resource/character/0.png`
          : `/Resource/character/${cs.characterId}.png`;
        const mainLabel = isCreative
          ? `${CharacterConfig.getCreativeCharacterName(cs.characterId)} · ${cs.games}게임 | ${cs.winRate}% 승률`
          : `${cs.games}게임 | ${cs.winRate}% 승률`;

        row.innerHTML = `
          <img class="user-char-stat-portrait" src="${portraitSrc}" alt="캐릭터">
          <div class="user-char-stat-info">
            <div class="user-char-stat-main">${mainLabel}</div>
            <div class="user-char-stat-sub">평균 ${cs.avgKills}킬 | 평균 ${cs.avgDamage} 피해</div>
          </div>
        `;
        if (!isCreative) {
          row.style.cursor = 'pointer';
          row.addEventListener('click', () => {
            window.location.href = `/character/${cs.characterId}`;
          });
        }
        charStatsSection.appendChild(row);
      });

      if (allStats.length > INITIAL_COUNT) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'user-char-stats-expand';
        expandBtn.textContent = `더보기 (${allStats.length - INITIAL_COUNT}개)`;
        let expanded = false;
        expandBtn.addEventListener('click', () => {
          expanded = !expanded;
          charStatsSection.querySelectorAll('.user-char-stat-hidden').forEach(el => {
            el.style.display = expanded ? 'flex' : 'none';
          });
          expandBtn.textContent = expanded ? '접기' : `더보기 (${allStats.length - INITIAL_COUNT}개)`;
        });
        charStatsSection.appendChild(expandBtn);
      }

      statsDisplay.appendChild(charStatsSection);
    }
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

function parseDateFromFileName(fileName) {
  // 파일 이름 예시: "2025.02.09-18.57.05"
  const parts = fileName.split('-');
  const timeArr = parts[1].split('.');  // 예: ["18", "57", "05"]
  return `${parts[0]}-${timeArr[0]}:${timeArr[1]}`;
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
  
    // YAML 데이터에 파일 이름이 있다면(서버에서 추가됨) 날짜 형식으로 파싱해서 사용,
    // 그렇지 않으면 game.Game.date 필드를 사용 (없으면 'N/A')
    let displayDate = 'N/A';
    if (game.fileName) {
      displayDate = parseDateFromFileName(game.fileName);
    }else if (game.content.Game.date) {
      displayDate = game.content.Game.date;
    }

    const formattedUUID = formatUUID(uuid);
    const playerData = (game.content.Player && game.content.Player[formattedUUID]);
    const ranking = (playerData?.Ranking !== undefined)? playerData.Ranking: (playerData?.ranking !== undefined ? playerData.ranking : '0');
    const kills = (playerData?.kill !== undefined)? playerData.kill: (playerData?.Kill !== undefined ? playerData.Kill : 0);
    const joins = game.content.Game.amountOfPlayers;

    const damageDealt = ((playerData?.Damage?.Dealt ?? 0)).toFixed(0);
    const damageTaken = ((playerData?.Damage?.Taken) ?? 0).toFixed(0);

    let resultTone = "neutral";
    let cardAccent = "#585858";
    const rankingNumber = Number(ranking);
    const joinsNumber = Number(joins);
    const rankp = rankingNumber / joinsNumber;
    if (rankingNumber === 1) {
      resultTone = "win";
      cardAccent = "#5383E8";
    } else if (rankp < 0.25) {
      resultTone = "top";
      cardAccent = "#32A800";
    } else if (rankp >= 0.75) {
      resultTone = "bottom";
      cardAccent = "#E84057";
    }

    const dateClass = (playerData?.Character >= 900) ? 'game-card-date creative-date' : 'game-card-date';

    const gameCardCharId = playerData?.Character;
    const gameCardIsCreative = CharacterConfig.isCreativeCharacter(gameCardCharId);
    const gameCardPortrait = gameCardIsCreative
      ? `/Resource/character/0.png`
      : `/Resource/character/${gameCardCharId ?? 'default'}.png`;
    const gameCardAlt = gameCardIsCreative
      ? CharacterConfig.getCreativeCharacterName(gameCardCharId)
      : '캐릭터';

    gameItem.innerHTML = `
    <div class="game-card game-card-${resultTone}" style="--result-accent: ${cardAccent};">
        <div class="game-card-rank">
          <span>#${ranking}</span>
          <small>${joins}명</small>
        </div>
        <div class="game-card-left">
          <img src="${gameCardPortrait}" alt="${gameCardAlt}">
        </div>
        <div class="game-card-info">
          <p class="${dateClass}">
            <strong>${displayDate}</strong>
          </p>
          <div class="game-card-info-sub">
            <span><strong>처치</strong> ${kills}</span>
            <span><strong>생존</strong> ${playerData?.TimeSurvived ?? 'N/A'}</span>
            <span><strong>피해</strong> ${damageDealt} / ${damageTaken}</span>
          </div>
        </div>
        <div class="game-card-augment">
          ${[1,2,3,4].map(i => {
            const aug = playerData?.Augment?.[i];
            const src = aug != null ? `/Resource/augment/icon/${aug}.png` : `/Resource/augment/icon/level.png`;
            return `<img src="${src}" alt="Augment${i}" data-augment-id="${aug != null ? aug : ''}" style="${aug != null ? 'cursor:pointer;' : ''}">`;
          }).join('\n          ')}
        </div>
      </div>
    `;

    // 게임 카드 증강 아이콘 클릭 → 팝업
    gameItem.querySelectorAll('.game-card-augment img[data-augment-id]').forEach(img => {
      const augId = img.getAttribute('data-augment-id');
      if (augId !== '') {
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          showAugmentPopup(Number(augId));
        });
      }
    });

    // 게임 카드 클릭 → 모달 열기
    const gameCard = gameItem.querySelector('.game-card');
    gameCard.style.cursor = 'pointer';
    gameCard.addEventListener('click', () => {
      openGameDetailModal(game);
    });

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

function stripHyphens(uuid) {
  return uuid.replace(/-/g, '');
}

// ──────────────────────────────
// 게임 상세 모달
async function openGameDetailModal(game) {
  const modal = document.getElementById('gameDetailModal');
  const playerListEl = document.getElementById('modalPlayerList');
  playerListEl.innerHTML = '<p style="text-align:center;color:#888;">로딩 중...</p>';
  modal.style.display = 'flex';

  const players = game.content.Player;
  if (!players) {
    playerListEl.innerHTML = '<p style="text-align:center;color:#888;">플레이어 데이터 없음</p>';
    return;
  }

  // 플레이어 목록 추출 및 순위 정렬
  const playerEntries = Object.entries(players).map(([uuid, data]) => {
    const ranking = data?.Ranking ?? data?.ranking ?? 999;
    return { uuid, data, ranking };
  });
  playerEntries.sort((a, b) => a.ranking - b.ranking);

  const joins = game.content.Game?.amountOfPlayers ?? playerEntries.length;

  // UUID → 닉네임 배치 조회
  const uuids = playerEntries.map(p => stripHyphens(p.uuid));
  let nicknameMap = {};
  try {
    const res = await fetch(`/api/profiles?uuids=${uuids.join(',')}`);
    if (res.ok) nicknameMap = await res.json();
  } catch (e) {
    console.error('닉네임 조회 실패:', e);
  }

  // 킬 관계 맵 생성 (killerUUID → [victimUUID, ...])
  const killMap = {};
  for (const [puuid, pdata] of Object.entries(players)) {
    if (pdata.killedBy) {
      const killerUUID = pdata.killedBy;
      if (!killMap[killerUUID]) killMap[killerUUID] = [];
      killMap[killerUUID].push(puuid);
    }
  }

  // 데미지 차트 렌더링
  const dmgSorted = playerEntries
    .filter(p => p.data?.Damage?.Dealt > 0)
    .sort((a, b) => (b.data.Damage.Dealt || 0) - (a.data.Damage.Dealt || 0))
    .slice(0, 10);

  const maxDealt = dmgSorted.length > 0 ? dmgSorted[0].data.Damage.Dealt : 1;
  const maxTaken = Math.max(...dmgSorted.map(p => p.data?.Damage?.Taken || 0), 1);
  const maxDmg = Math.max(maxDealt, maxTaken);

  playerListEl.innerHTML = '';

  if (dmgSorted.length > 0) {
    const chartSection = document.createElement('div');
    chartSection.className = 'modal-damage-chart';
    chartSection.innerHTML = '<div class="modal-section-title">피해량</div>';

    dmgSorted.forEach(({ uuid: pUuid, data: pData }) => {
      const cleanUUID = stripHyphens(pUuid);
      const pNick = nicknameMap[cleanUUID] || cleanUUID.slice(0, 8);
      const dealt = pData?.Damage?.Dealt || 0;
      const taken = pData?.Damage?.Taken || 0;
      const dealtPct = (dealt / maxDmg * 100).toFixed(1);
      const takenPct = (taken / maxDmg * 100).toFixed(1);

      const barRow = document.createElement('div');
      barRow.className = 'dmg-bar-row';
      barRow.innerHTML = `
        <span class="dmg-bar-name">${pNick}</span>
        <div class="dmg-bar-container">
          <div class="dmg-bar dmg-bar-dealt" style="width: ${dealtPct}%"><span>${dealt.toFixed(0)}</span></div>
          <div class="dmg-bar dmg-bar-taken" style="width: ${takenPct}%"><span>${taken.toFixed(0)}</span></div>
        </div>
      `;
      chartSection.appendChild(barRow);
    });

    playerListEl.appendChild(chartSection);
  }

  // 플레이어 목록 렌더링
  const playerSection = document.createElement('div');
  playerSection.className = 'modal-player-section';

  playerEntries.forEach(({ uuid, data, ranking }) => {
    const cleanUUID = stripHyphens(uuid);
    const nickname = nicknameMap[cleanUUID] || cleanUUID.slice(0, 8);
    const character = data?.Character ?? 'default';
    const modalIsCreative = CharacterConfig.isCreativeCharacter(character);
    const modalPortrait = modalIsCreative
      ? `/Resource/character/0.png`
      : `/Resource/character/${character}.png`;
    const modalAlt = modalIsCreative
      ? CharacterConfig.getCreativeCharacterName(character)
      : '캐릭터';

    let rowBg = '#2c2c2c';
    let rowBorder = '#3c3c3c';
    const rankp = ranking / joins;
    if (ranking === 1) {
      rowBg = '#4066B2'; rowBorder = '#5383E8';
    } else if (rankp < 0.25) {
      rowBg = '#267F00'; rowBorder = '#32A800';
    } else if (rankp >= 0.75) {
      rowBg = '#59343B'; rowBorder = '#E84057';
    }

    const augmentHtml = [1,2,3,4].map(i => {
      const aug = data?.Augment?.[i];
      const src = aug != null ? `/Resource/augment/icon/${aug}.png` : `/Resource/augment/icon/level.png`;
      return `<img src="${src}" alt="Augment${i}" data-augment-id="${aug != null ? aug : ''}" style="${aug != null ? 'cursor:pointer;' : ''}">`;
    }).join('');

    const row = document.createElement('div');
    row.className = 'modal-player-row';
    row.style.backgroundColor = rowBg;
    row.style.borderColor = rowBorder;
    row.innerHTML = `
      <span class="modal-player-rank">#${ranking}</span>
      <img class="modal-player-char" src="${modalPortrait}" alt="${modalAlt}">
      <img class="modal-player-head" src="https://mc-heads.net/avatar/${cleanUUID}/40" alt="${nickname}">
      <span class="modal-player-name">${nickname}</span>
      <span class="modal-player-kills">${(data?.kill || 0)}킬</span>
      <div class="modal-player-augments">${augmentHtml}</div>
    `;

    // 캐릭터 초상화 클릭 → 캐릭터 정보 페이지 이동 (정식 캐릭터만)
    const charImg = row.querySelector('.modal-player-char');
    if (character !== 'default' && !modalIsCreative && Number(character) < CharacterConfig.CREATIVE_ID_MAX_EXCLUSIVE) {
      charImg.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `/character/${character}`;
      });
    }

    // 모달 증강 아이콘 클릭 → 팝업
    row.querySelectorAll('.modal-player-augments img[data-augment-id]').forEach(img => {
      const augId = img.getAttribute('data-augment-id');
      if (augId !== '') {
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          showAugmentPopup(Number(augId));
        });
      }
    });

    // 행 클릭 → 해당 유저 전적 페이지 이동
    if (nicknameMap[cleanUUID]) {
      row.addEventListener('click', () => {
        window.location.href = `/user/${encodeURIComponent(nicknameMap[cleanUUID])}`;
      });
    }

    playerSection.appendChild(row);
  });

  playerListEl.appendChild(playerSection);
}

// 모달 닫기 이벤트
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('gameDetailModal');
  const closeBtn = modal.querySelector('.modal-close');

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });
});

