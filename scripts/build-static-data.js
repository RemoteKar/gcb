// 빌드 시 Data/ 폴더를 읽어 클라이언트가 바로 fetch 할 수 있는 정적 JSON 생성
//   client/data/user-statistics/{uuid}.json  유저별 전적 + 게임 기록
//   client/data/recent-games.json            최근 60게임 (캐릭터 통계 페이지)
//   client/data/augment-stats.json           최근 60게임 증강 픽 통계
//   client/data/badges.json                  { uuid: { current, List } }
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { computeStatistics, computeGlobalAugmentStatistics } = require('../server/utils/statistics');
const { formatUUID, toNonHyphenatedUUID } = require('../server/util');
const { readGameRecords } = require('./read-game-records');

const projectRoot = path.resolve(__dirname, '..');
const badgeDir = path.join(projectRoot, 'Data', 'player', 'badge');
const outputDir = path.join(projectRoot, 'client', 'data');
const userStatsDir = path.join(outputDir, 'user-statistics');
const RECENT_GAMES = 60;

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

function writeJson(relPath, data) {
  const fullPath = path.join(outputDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data));
}

function indexRecordsByPlayer(records) {
  const byPlayer = new Map();
  for (const record of records) {
    const joinedPlayers = record.content?.Game?.joinedPlayers;
    if (!joinedPlayers) continue;
    for (const rawUuid of joinedPlayers.split(',')) {
      const uuid = formatUUID(toNonHyphenatedUUID(rawUuid.trim()));
      if (!uuid) continue;
      if (!byPlayer.has(uuid)) byPlayer.set(uuid, []);
      byPlayer.get(uuid).push(record);
    }
  }
  return byPlayer;
}

function buildBadges() {
  if (!fs.existsSync(badgeDir)) return {};
  const badges = {};
  for (const fileName of fs.readdirSync(badgeDir)) {
    if (!fileName.endsWith('.yaml')) continue;
    try {
      const data = yaml.load(fs.readFileSync(path.join(badgeDir, fileName), 'utf8'));
      const badge = data?.badge || data;
      if (badge && badge.current) badges[fileName.replace('.yaml', '')] = badge;
    } catch (e) {
      console.warn(`[빌드] 배지 파싱 실패: ${fileName} (${e.message})`);
    }
  }
  return badges;
}

function main() {
  console.log('[빌드] 정적 데이터 생성 시작...');
  fs.rmSync(outputDir, { recursive: true, force: true });

  const records = readGameRecords();

  const byPlayer = indexRecordsByPlayer(records);
  for (const [uuid, gameRecords] of byPlayer.entries()) {
    const statistics = computeStatistics(gameRecords.map(r => r.content), uuid);
    writeJson(path.join('user-statistics', `${uuid}.json`), {
      statistics: formatStatistics(statistics),
      gameRecords,
    });
  }

  const recent = records.slice(-RECENT_GAMES);
  writeJson('recent-games.json', { gameRecords: recent });
  writeJson('augment-stats.json', computeGlobalAugmentStatistics(recent.map(r => r.content)));

  const badges = buildBadges();
  writeJson('badges.json', badges);

  console.log(`[빌드] 정적 데이터 생성 완료: ${byPlayer.size}명, ${records.length}경기, 배지 ${Object.keys(badges).length}개`);
}

main();
