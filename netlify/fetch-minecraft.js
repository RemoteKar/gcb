// netlify/functions/fetch-minecraft.js
const fetch = require('node-fetch');
const yaml = require('js-yaml');

// ※ GitHub 토큰은 실제 토큰으로 교체하세요.
const GITHUB_TOKEN = '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';

/**
 * UUID에 하이픈을 추가하는 함수
 * @param {string} uuid - 하이픈 없는 UUID 문자열
 * @returns {string} - 하이픈이 포함된 UUID
 */
function formatUUID(uuid) {
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

/**
 * GitHub API를 통해 게임 기록 파일 목록을 가져옵니다.
 * @returns {Promise<Array|null>} - 파일 목록 배열 또는 오류 시 null
 */
async function fetchGameHistory() {
  const githubUrl = 'https://api.github.com/repos/RemoteKar/gcb/contents/Data/gameHistory';
  try {
    const response = await fetch(githubUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) {
      throw new Error('게임 기록을 찾을 수 없습니다.');
    }
    const files = await response.json();
    console.log('Fetched Game History Files:', files.length);
    return files;
  } catch (error) {
    console.error('게임 기록 오류:', error);
    return null;
  }
}

/**
 * YAML 파일을 파싱하는 함수
 * @param {string} fileUrl - YAML 파일의 다운로드 URL
 * @returns {Promise<Object|null>} - 파싱된 객체 또는 오류 시 null
 */
async function parseYamlFile(fileUrl) {
  try {
    const response = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    });
    if (!response.ok) {
      throw new Error('YAML 파일을 읽을 수 없습니다.');
    }
    const fileContents = await response.text();
    const parsedData = yaml.load(fileContents);
    return parsedData;
  } catch (error) {
    console.error('YAML 파일 파싱 오류:', error);
    return null;
  }
}

/**
 * 주어진 UUID를 기준으로 게임 기록 데이터를 분석하여 통계를 계산합니다.
 * @param {string} uuid - 하이픈이 포함된 UUID
 * @param {Array} gameHistory - 게임 기록 객체 배열 (필터링된 데이터)
 * @returns {Object} - 통계 데이터 객체
 */
function calculateStatistics(uuid, gameHistory) {
  let totalGames = 0;
  let wins = 0;
  const characterUsage = {};
  const augmentUsage = {};
  let totalDamageDealt = 0;
  let totalKills = 0;
  let totalAliveTime = 0;

  console.log('Calculating statistics for UUID:', uuid);

  gameHistory.forEach(game => {
    // game.Player 객체에 해당 uuid가 있는 경우에만 처리
    if (game.Player && game.Player[uuid]) {
      totalGames++;
      const playerData = game.Player[uuid];

      // 우승 여부 확인
      if (playerData.outCuase === '우승') {
        wins++;
      }

      // 캐릭터 사용량
      const character = playerData.Character;
      if (character) {
        characterUsage[character] = (characterUsage[character] || 0) + 1;
      }

      // 증강 사용량
      if (playerData.Augment) {
        Object.values(playerData.Augment).forEach(augment => {
          if (augment) {
            augmentUsage[augment] = (augmentUsage[augment] || 0) + 1;
          }
        });
      }

      // 데미지와 킬 수 합산
      if (playerData.Damage && playerData.Damage.Dealt) {
        totalDamageDealt += playerData.Damage.Dealt;
      }
      if (playerData.kill) {
        totalKills += playerData.kill;
      }

      // 생존 시간 합산
      if (playerData.TimeSurvived) {
        totalAliveTime += playerData.TimeSurvived;
      }
    }
  });

  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
  const mostUsedCharacter = Object.keys(characterUsage).length > 0
    ? Object.keys(characterUsage).reduce((a, b) => (characterUsage[a] > characterUsage[b] ? a : b))
    : '없음';
  const mostUsedAugments = Object.keys(augmentUsage).length > 0
    ? Object.keys(augmentUsage)
        .sort((a, b) => augmentUsage[b] - augmentUsage[a])
        .slice(0, 3)
    : ['없음'];
  const averageDamageDealt = totalGames > 0 ? totalDamageDealt / totalGames : 0;
  const averageKillRate = totalGames > 0 ? totalKills / totalGames : 0;
  const averageAliveTime = totalGames > 0 ? totalAliveTime / totalGames : 0;

  return {
    winRate: winRate.toFixed(2),
    mostUsedCharacter,
    mostUsedAugments,
    averageDamageDealt: averageDamageDealt.toFixed(2),
    averageKillRate: averageKillRate.toFixed(2),
    averageAliveTime: averageAliveTime.toFixed(2),
  };
}

/**
 * Netlify Function 메인 핸들러
 */
exports.handler = async (event, context) => {
  const { nickname } = event.queryStringParameters;

  // Mojang API를 통해 UUID를 가져옵니다.
  const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
  const mojangResponse = await fetch(mojangUrl);
  if (!mojangResponse.ok) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: '유저를 찾을 수 없습니다.' }),
    };
  }
  const mojangData = await mojangResponse.json();
  const uuid = mojangData.id;

  // UUID 형식 변환 (하이픈 추가)
  const formattedUUID = formatUUID(uuid);
  console.log('Formatted UUID:', formattedUUID);

  // GitHub API를 통해 배지 데이터를 가져옵니다.
  const badgeUrl = `https://api.github.com/repos/RemoteKar/gcb/contents/Data/player/badge/${formattedUUID}.yaml`;
  console.log('Fetching badge data from:', badgeUrl);

  let badgeData = null;
  try {
    const badgeResponse = await fetch(badgeUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    });
    if (badgeResponse.ok) {
      const fileContents = await badgeResponse.text();
      badgeData = yaml.load(fileContents);
    }
  } catch (error) {
    console.error('배지 데이터 오류:', error);
  }

  // 게임 기록 파일 목록을 가져옵니다.
  const gameHistoryFiles = await fetchGameHistory();
  let statistics = null;
  if (gameHistoryFiles) {
    const gameHistory = [];
    // 각 게임 기록 파일을 파싱하여 배열에 추가
    for (const file of gameHistoryFiles) {
      const fileUrl = file.download_url;
      const gameData = await parseYamlFile(fileUrl);
      if (gameData) {
        gameHistory.push(gameData);
      }
    }
    // **여기서 필터링:** 각 게임 데이터의 Game.joinedPlayers 필드에서
    // 콤마로 구분된 UUID 목록에 formattedUUID가 포함되어 있는 경우에만 사용합니다.
    const filteredHistory = gameHistory.filter(record => {
      if (record && record.Game && record.Game.joinedPlayers) {
        const players = record.Game.joinedPlayers.split(',').map(p => p.trim());
        return players.includes(formattedUUID);
      }
      return false;
    });
    console.log(`Filtered game records count: ${filteredHistory.length}`);
    
    statistics = calculateStatistics(formattedUUID, filteredHistory);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      id: uuid,
      badges: badgeData?.badge || null,
      statistics: statistics || null,
    }),
  };
};
