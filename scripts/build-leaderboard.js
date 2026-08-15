// 빌드 시 Data/gameHistory 로 랭킹 계산 → client/data/leaderboard.json (+ DB: /api/uuid 닉네임 폴백용)
const fs = require('fs');
const path = require('path');
const { getProfileByUUID } = require('../server/services/mojang');
const { getPrismaClientOrNull } = require('../server/services/prisma');
const { aggregateAllPlayerStatistics } = require('../server/utils/statistics');
const { readGameRecords } = require('./read-game-records');

const outPath = path.resolve(__dirname, '..', 'client', 'data', 'leaderboard.json');
const MIN_GAMES = 10;
const NICKNAME_CONCURRENCY = 4; // Mojang 429 방지

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
    totalGames: stats.totalGames.toString()
  };
}

async function buildLeaderboard() {
  console.log("🚀 [빌드] 랭킹 데이터 계산 시작...");

  const records = readGameRecords();
  console.log(`🔍 [빌드] 파싱된 게임 기록 수: ${records.length}`);

  const players = aggregateAllPlayerStatistics(records.map(r => r.content))
    .filter(stats => stats.totalGames >= MIN_GAMES);
  players.forEach(stats => {
    stats.rankingScore = (stats.winRate / 100) * (stats.avarageRankLeast50 / 100);
  });
  players.sort((a, b) => b.rankingScore - a.rankingScore);
  console.log(`🔍 [빌드] 자격 플레이어 수: ${players.length}`);

  // 전원 닉네임 조회 (랭킹 전체 리스트 표시용). 실패 시 uuid 유지
  const leaderboard = new Array(players.length);
  let next = 0;
  await Promise.all(Array.from({ length: NICKNAME_CONCURRENCY }, async () => {
    while (next < players.length) {
      const i = next++;
      const stats = players[i];
      let nickname = stats.uuid;
      try {
        const profile = await getProfileByUUID(stats.uuid);
        if (profile?.name) nickname = profile.name;
      } catch (error) {
        console.warn(`⚠️ [빌드] UUID ${stats.uuid} 닉네임 조회 실패: ${error.message}`);
      }
      leaderboard[i] = { uuid: stats.uuid, nickname, ...formatStatistics(stats) };
    }
  }));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(leaderboard));
  console.log(`✅ [빌드] leaderboard.json 저장 완료 (${leaderboard.length}명)`);

  const prisma = getPrismaClientOrNull();
  if (prisma) {
    try {
      await prisma.leaderboardCache.upsert({
        where: { id: 'leaderboard' },
        update: { data: leaderboard, updatedAt: new Date() },
        create: { id: 'leaderboard', data: leaderboard }
      });
      console.log("✅ [빌드] 랭킹 DB 저장 완료.");
    } catch (error) {
      console.warn(`⚠️ [빌드] 랭킹 DB 저장 실패 (닉네임 폴백만 영향): ${error.message}`);
    }
  }
}

buildLeaderboard()
  .catch(error => console.error("❌ [빌드] 랭킹 계산 오류 (배포는 계속 진행):", error))
  .finally(() => process.exit(0));
