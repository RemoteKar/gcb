const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { computeStatistics } = require('../server/utils/statistics');
const { formatUUID, toNonHyphenatedUUID } = require('../server/util');

const projectRoot = path.resolve(__dirname, '..');
const gameHistoryDir = path.join(projectRoot, 'Data', 'gameHistory');
const outputDir = path.join(projectRoot, 'client', 'data', 'user-statistics');

function formatStatistics(stats) {
  return {
    winRate: stats.winRate.toFixed(1),
    winCount: stats.winCount.toString(),
    avarageRankLeast50: stats.avarageRankLeast50.toFixed(1),
    mostUsedCharacter: stats.mostUsedCharacter,
    mostUsedAugments: stats.mostUsedAugments,
    averageDamageDealt: stats.averageDamageDealt.toFixed(0),
    averageDamageTaken: stats.averageDamageTaken.toFixed(0),
    averageKillRate: stats.averageKillRate.toFixed(2),
    averageAliveTime: stats.averageAliveTime.toFixed(1),
    maxDamageDealt: stats.maxDamageDealt.toFixed(0),
    maxDamageTaken: stats.maxDamageTaken.toFixed(0),
    maxKill: stats.maxKill.toString(),
    totalGames: stats.totalGames.toString(),
    characterStats: stats.characterStats || [],
  };
}

function readGameRecords() {
  if (!fs.existsSync(gameHistoryDir)) {
    console.warn(`[빌드] gameHistory 폴더가 없습니다: ${gameHistoryDir}`);
    return [];
  }

  return fs.readdirSync(gameHistoryDir)
    .filter(fileName => fileName.endsWith('.yaml') || fileName.endsWith('.yml'))
    .map(fileName => {
      const fullPath = path.join(gameHistoryDir, fileName);
      const content = yaml.load(fs.readFileSync(fullPath, 'utf8'));
      return { fileName, content };
    })
    .filter(record => record.content);
}

function indexRecordsByPlayer(records) {
  const byPlayer = new Map();

  for (const record of records) {
    const joinedPlayers = record.content?.Game?.joinedPlayers;
    if (!joinedPlayers) continue;

    for (const rawUuid of joinedPlayers.split(',')) {
      const formattedUUID = formatUUID(toNonHyphenatedUUID(rawUuid.trim()));
      if (!formattedUUID) continue;

      if (!byPlayer.has(formattedUUID)) {
        byPlayer.set(formattedUUID, []);
      }
      byPlayer.get(formattedUUID).push(record);
    }
  }

  return byPlayer;
}

function writeUserStatistics(byPlayer) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [uuid, gameRecords] of byPlayer.entries()) {
    const statistics = computeStatistics(
      gameRecords.map(record => record.content),
      uuid
    );
    const payload = {
      statistics: formatStatistics(statistics),
      gameRecords,
    };

    fs.writeFileSync(
      path.join(outputDir, `${uuid}.json`),
      JSON.stringify(payload)
    );
  }
}

function main() {
  console.log('[빌드] 유저별 전적 인덱스 생성 시작...');
  const records = readGameRecords();
  const byPlayer = indexRecordsByPlayer(records);
  writeUserStatistics(byPlayer);
  console.log(`[빌드] 유저별 전적 인덱스 생성 완료: ${byPlayer.size}명, ${records.length}경기`);
}

main();
