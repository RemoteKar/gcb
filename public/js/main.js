//----------------------------------------
// public/js/main.js
//----------------------------------------

// api.js에서 getSkinUrl와 getUUID 함수를 가져옴
import { getSkinUrl, getUUID } from './api.js';

//----------------------------------------
// 이벤트 리스너: 검색 버튼 클릭 시 처리
document.getElementById('search-button').addEventListener('click', async () => {
  const input = document.getElementById('nickname').value.trim();
  if (!input) {
    alert('닉네임 또는 UUID를 입력하세요.');
    return;
  }

  // 결과 영역 초기화
  document.getElementById('result').innerHTML = '';
  document.getElementById('game-history').innerHTML = '';
  document.getElementById('player-head').innerHTML = '';

  try {
    //----------------------------------------
    // 입력값을 통해 UUID 얻기 (직접 UUID 입력 시 그대로 반환, 닉네임이면 서버 API 통해 변환)
    const uuid = await getUUID(input);

    //----------------------------------------
    // 게임 기록 API 호출: 해당 UUID가 포함된 기록을 가져옴
    const historyRes = await fetch(`/api/gameHistory?uuid=${uuid}`);
    if (!historyRes.ok) {
      throw new Error('게임 기록을 불러오지 못했습니다.');
    }
    const gameRecords = await historyRes.json();

    //----------------------------------------
    // 통계 데이터 계산
    const statistics = computeStatistics(gameRecords, uuid);

    //----------------------------------------
    // 플레이어 스킨 이미지 표시 (Crafatar API)
    document.getElementById('player-head').innerHTML = `<img src="${getSkinUrl(uuid)}" alt="Player Skin">`;

    //----------------------------------------
    // 게임 기록 표시
    displayGameHistory(gameRecords);

    //----------------------------------------
    // 통계 데이터 표시
    displayStatistics(statistics);

    //----------------------------------------
    // 플레이어 배지 API 호출 및 표시
    const badgeRes = await fetch(`/api/playerBadge?uuid=${uuid}`);
    if (badgeRes.ok) {
      const badgeData = await badgeRes.json(); // 예: { current: "2주년기념", List: [...] }
      const badgeImgUrl = `/Resource/badge/${badgeData.current}.png`;
      document.getElementById('result').innerHTML += `
        <div class="badge-display">
          <p><strong>배지:</strong></p>
          <img src="${badgeImgUrl}" alt="Badge" class="badge-img">
        </div>
      `;
    } else {
      console.warn('배지 정보를 불러오지 못했습니다.');
    }
  } catch (error) {
    console.error(error);
    document.getElementById('result').textContent = error.message;
  }
});

//----------------------------------------
// 함수: 게임 기록 데이터를 기반으로 통계 계산
function computeStatistics(gameRecords, uuid) {
  const totalGames = gameRecords.length;
  let wins = 0;
  const characterCount = {};
  const augmentCount = {};
  let totalDamage = 0;
  let totalKill = 0;
  let totalAliveTime = 0;

  gameRecords.forEach(record => {
    const playerData = record.Player[uuid];
    if (!playerData) return;

    // 승리 여부: outCuase가 '우승'이면 승리
    if (playerData.outCuase === '우승') {
      wins++;
    }

    // 사용 캐릭터 집계
    const char = playerData.Character;
    characterCount[char] = (characterCount[char] || 0) + 1;

    // 증강(Augment) 집계
    if (playerData.Augment) {
      Object.values(playerData.Augment).forEach(aug => {
        augmentCount[aug] = (augmentCount[aug] || 0) + 1;
      });
    }

    // 데미지, 킬, 생존시간 합산
    if (playerData.Damage && typeof playerData.Damage.Dealt === 'number') {
      totalDamage += playerData.Damage.Dealt;
    }
    if (playerData.kill) {
      totalKill += playerData.kill;
    }
    if (playerData.TimeSurvived) {
      totalAliveTime += playerData.TimeSurvived;
    }
  });

  const winRate = totalGames ? ((wins / totalGames) * 100).toFixed(2) : 0;
  const mostUsedCharacter = Object.entries(characterCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const mostUsedAugments = Object.entries(augmentCount)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
  const averageDamageDealt = totalGames ? (totalDamage / totalGames).toFixed(2) : 0;
  const averageKillRate = totalGames ? (totalKill / totalGames).toFixed(2) : 0;
  const averageAliveTime = totalGames ? (totalAliveTime / totalGames).toFixed(2) : 0;

  return {
    winRate,
    mostUsedCharacter,
    mostUsedAugments,
    averageDamageDealt,
    averageKillRate,
    averageAliveTime
  };
}

//----------------------------------------
// 함수: 게임 기록 데이터를 화면에 표시
function displayGameHistory(gameRecords) {
  const gameHistoryEl = document.getElementById('game-history');
  gameHistoryEl.innerHTML = '';

  if (gameRecords.length === 0) {
    gameHistoryEl.textContent = '해당 플레이어의 게임 기록이 없습니다.';
    return;
  }

  gameRecords.forEach(record => {
    const gameMode = record.Game.mode;
    const totalTime = record.Game.totalTime;
    const recordDiv = document.createElement('div');
    recordDiv.classList.add('game-record');
    recordDiv.innerHTML = `<h3>${gameMode}</h3><p>총 시간: ${totalTime}</p>`;
    gameHistoryEl.appendChild(recordDiv);
  });
}

//----------------------------------------
// 함수: 계산된 통계 데이터를 화면에 표시
function displayStatistics(statistics) {
  const statsDisplay = document.getElementById('result');
  if (statistics) {
    statsDisplay.innerHTML = `
      <p><strong>승률:</strong> ${statistics.winRate}%</p>
      <p><strong>가장 많이 사용한 캐릭터:</strong> ${statistics.mostUsedCharacter}</p>
      <p><strong>가장 많이 사용한 증강:</strong> ${statistics.mostUsedAugments.join(', ')}</p>
      <p><strong>평균 데미지:</strong> ${statistics.averageDamageDealt}</p>
      <p><strong>평균 킬 수:</strong> ${statistics.averageKillRate}</p>
      <p><strong>평균 생존시간:</strong> ${statistics.averageAliveTime}</p>
    `;
  } else {
    statsDisplay.textContent = '통계 데이터가 없습니다.';
  }
}
