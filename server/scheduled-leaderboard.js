const { schedule } = require('@netlify/functions');
const { PrismaClient } = require('@prisma/client/edge');
const { withAccelerate } = require('@prisma/extension-accelerate');
const { getProfileByUUID } = require('./services/mojang');
const { getBadgeData, refreshAllGameRecordsCache } = require('./services/github');
const { aggregateAllPlayerStatistics } = require('./utils/statistics');

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

const handler = async () => {
  console.log("🚀 [Scheduled] 랭킹 데이터 계산 시작...");

  let prisma;
  try {
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    }).$extends(withAccelerate());
  } catch (error) {
    console.error("❌ [Scheduled] Prisma 초기화 실패:", error);
    return { statusCode: 500 };
  }

  try {
    // 1. 모든 게임 기록 가져오기
    const allParsedGameRecords = await refreshAllGameRecordsCache();
    console.log(`🔍 [Scheduled] 파싱된 게임 기록 수: ${allParsedGameRecords.length}`);
    if (allParsedGameRecords.length === 0) {
      console.warn("⚠️ [Scheduled] 게임 기록 없음. 종료.");
      return { statusCode: 200 };
    }

    // 2. 플레이어 통계 집계
    let allPlayerStatistics = aggregateAllPlayerStatistics(
      allParsedGameRecords.map(record => record?.content || record)
    );
    allPlayerStatistics = allPlayerStatistics.filter(stats => stats.totalGames >= 20);
    console.log(`🔍 [Scheduled] 집계된 플레이어 통계 수: ${allPlayerStatistics.length}`);
    if (allPlayerStatistics.length === 0) {
      console.warn("⚠️ [Scheduled] 자격 플레이어 없음. 종료.");
      return { statusCode: 200 };
    }

    // 3. 랭킹 점수 계산 및 정렬
    allPlayerStatistics.forEach(stats => {
      stats.rankingScore = (stats.winRate / 100) * (stats.avarageRankLeast50 / 100);
    });
    allPlayerStatistics.sort((a, b) => b.rankingScore - a.rankingScore);

    // 4. 상위 20명 닉네임 조회
    const calculatedLeaderboard = await Promise.all(
      allPlayerStatistics.map(async (stats, index) => {
        let nickname = stats.uuid;
        if (index < 20) {
          try {
            const profile = await getProfileByUUID(stats.uuid);
            if (profile && profile.name) {
              nickname = profile.name;
            }
          } catch (error) {
            console.warn(`⚠️ [Scheduled] UUID ${stats.uuid} 닉네임 조회 실패: ${error.message}`);
          }
        }
        return {
          uuid: stats.uuid,
          nickname,
          ...formatStatistics(stats)
        };
      })
    );

    // 5. DB에 저장
    await prisma.leaderboardCache.upsert({
      where: { id: 'leaderboard' },
      update: { data: calculatedLeaderboard, updatedAt: new Date() },
      create: { id: 'leaderboard', data: calculatedLeaderboard }
    });

    console.log(`✅ [Scheduled] 랭킹 데이터 DB 저장 완료. (${calculatedLeaderboard.length}명)`);
    return { statusCode: 200 };
  } catch (error) {
    console.error("❌ [Scheduled] 랭킹 계산 오류:", error);
    return { statusCode: 500 };
  }
};

module.exports.handler = schedule("@hourly", handler);
