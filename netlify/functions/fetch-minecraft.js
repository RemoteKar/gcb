//----------------------------------------
// netlify/functions/fetch-minecraft.js
//----------------------------------------

const fetch = require('node-fetch');
const yaml = require('js-yaml');

// GitHub token (실제 토큰은 환경변수로 관리 권장)
const GITHUB_TOKEN = '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';

//----------------------------------------
// Helper 함수: UUID에 하이픈 추가 (8-4-4-4-12 형식)
function formatUUID(uuid) {
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

//----------------------------------------
// GitHub에서 게임 기록 파일 목록을 가져오기
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

//----------------------------------------
// YAML 파일 내용을 파싱하는 함수
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
    return yaml.load(fileContents);
  } catch (error) {
    console.error('YAML 파일 파싱 오류:', error);
    return null;
  }
}

//----------------------------------------
// 게임 기록 데이터를 기반으로 통계 계산 함수
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
    if (game.Player && game.Player[uuid]) {
      console.log('Player data found in game:', game);
      totalGames++;
      const playerData = game.Player[uuid];

      if (playerData.outCuase === '우승') {
        wins++;
      }

      const character = playerData.Character;
      if (character) {
        characterUsage[character] = (characterUsage[character] || 0) + 1;
      }

      if (playerData.Augment) {
        Object.values(playerData.Augment).forEach(augment => {
          if (augment) {
            augmentUsage[augment] = (augmentUsage[augment] || 0) + 1;
          }
        });
      }

      if (playerData.Damage && playerData.Damage.Dealt) {
        totalDamageDealt += playerData.Damage.Dealt;
      }
      if (playerData.kill) {
        totalKills += playerData.kill;
      }
      if (playerData.TimeSurvived) {
        totalAliveTime += playerData.TimeSurvived;
      }
    } else {
      console.log('Player data not found in game:', game);
    }
  });

  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
  const mostUsedCharacter = Object.keys(characterUsage).length > 0
    ? Object.keys(characterUsage).reduce((a, b) => characterUsage[a] > characterUsage[b] ? a : b)
    : '없음';
  const mostUsedAugments = Object.keys(augmentUsage).length > 0
    ? Object.keys(augmentUsage).sort((a, b) => augmentUsage[b] - augmentUsage[a]).slice(0, 3)
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

//----------------------------------------
// Netlify Function Handler
exports.handler = async (event, context) => {
  const { nickname } = event.queryStringParameters;

  // Mojang API 호출: 닉네임으로 UUID 가져오기
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
  const formattedUUID = formatUUID(uuid);
  console.log('Formatted UUID:', formattedUUID);

  // GitHub에서 배지 데이터 가져오기
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

  // 게임 기록 가져오기 및 통계 계산
  const gameHistoryFiles = await fetchGameHistory();
  let statistics = null;
  if (gameHistoryFiles) {
    const gameHistory = [];
    for (const file of gameHistoryFiles) {
      const fileUrl = file.download_url;
      const gameData = await parseYamlFile(fileUrl);
      if (gameData) {
        gameHistory.push(gameData);
      }
    }
    statistics = calculateStatistics(formattedUUID, gameHistory);
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
