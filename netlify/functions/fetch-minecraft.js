// netlify/functions/fetch-minecraft.js
const fetch = require('node-fetch');
const yaml = require('js-yaml');

// GitHub token (replace with your actual token)
const GITHUB_TOKEN = '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';

// Helper function to add hyphens to UUID
function formatUUID(uuid) {
  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

// Fetch all game history YAML files
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
    console.log('Fetched Game History Files:', files.length); // Log number of files fetched
    return files;
  } catch (error) {
    console.error('게임 기록 오류:', error);
    return null;
  }
}

// Parse YAML file content
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

// Calculate statistics for a UUID owner
function calculateStatistics(uuid, gameHistory) {
  let totalGames = 0;
  let wins = 0;
  const characterUsage = {};
  const augmentUsage = {};
  let totalDamageDealt = 0;
  let totalKills = 0;
  let totalAliveTime = 0;

  console.log('Calculating statistics for UUID:', uuid); // Log UUID being processed

  gameHistory.forEach(game => {
    if (game.Player && game.Player[uuid]) {
      console.log('Player data found in game:', game); // Log game where player data is found
      totalGames++;
      const playerData = game.Player[uuid];

      // Check if the player won the game
      if (playerData.outCuase === '우승') {
        wins++;
      }

      // Track character usage
      const character = playerData.Character;
      if (character) {
        characterUsage[character] = (characterUsage[character] || 0) + 1;
      }

      // Track augment usage
      if (playerData.Augment) {
        Object.values(playerData.Augment).forEach(augment => {
          if (augment) {
            augmentUsage[augment] = (augmentUsage[augment] || 0) + 1;
          }
        });
      }

      // Sum damage dealt and kills
      if (playerData.Damage && playerData.Damage.Dealt) {
        totalDamageDealt += playerData.Damage.Dealt;
      }
      if (playerData.kill) {
        totalKills += playerData.kill;
      }

      // Sum alive time
      if (playerData.TimeSurvived) {
        totalAliveTime += playerData.TimeSurvived;
      }
    } else {
      console.log('Player data not found in game:', game); // Log game where player data is missing
    }
  });

  // Calculate win rate
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

  // Find most used character
  const mostUsedCharacter = Object.keys(characterUsage).length > 0
    ? Object.keys(characterUsage).reduce((a, b) =>
        characterUsage[a] > characterUsage[b] ? a : b
      )
    : '없음'; // Default value if no character data is found

  // Find most used augments
  const mostUsedAugments = Object.keys(augmentUsage).length > 0
    ? Object.keys(augmentUsage)
        .sort((a, b) => augmentUsage[b] - augmentUsage[a])
        .slice(0, 3) // Top 3 most used augments
    : ['없음']; // Default value if no augment data is found

  // Calculate average damage dealt and kill rate
  const averageDamageDealt = totalGames > 0 ? totalDamageDealt / totalGames : 0;
  const averageKillRate = totalGames > 0 ? totalKills / totalGames : 0;

  // Calculate average alive time
  const averageAliveTime = totalGames > 0 ? totalAliveTime / totalGames : 0;

  return {
    winRate: winRate.toFixed(2),
    mostUsedCharacter,
    mostUsedAugments,
    averageDamageDealt: averageDamageDealt.toFixed(2),
    averageKillRate: averageKillRate.toFixed(2),
    averageAliveTime: averageAliveTime.toFixed(2), // Add average alive time
  };
}

exports.handler = async (event, context) => {
  const { nickname } = event.queryStringParameters;

  // Fetch UUID from Mojang API
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

  // Format UUID with hyphens
  const formattedUUID = formatUUID(uuid);
  console.log('Formatted UUID:', formattedUUID);

  // Fetch badge data from GitHub API
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

  // Fetch game history and calculate statistics
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
    statistics = calculateStatistics(uuid, gameHistory);
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