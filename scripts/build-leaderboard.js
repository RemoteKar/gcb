const { getProfileByUUID } = require('../server/services/mojang');
const { refreshAllGameRecordsCache } = require('../server/services/github');
const { getPrismaClient } = require('../server/services/prisma');
const { aggregateAllPlayerStatistics } = require('../server/utils/statistics');

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

  let prisma;
  try {
    prisma = getPrismaClient();
  } catch (error) {
    console.error("❌ [빌드] Prisma 초기화 실패:", error);
    process.exit(1);
  }

  try {
    // 1. 모든 게임 기록 가져오기
    const allParsedGameRecords = await refreshAllGameRecordsCache();
    console.log(`🔍 [빌드] 파싱된 게임 기록 수: ${allParsedGameRecords.length}`);
    if (allParsedGameRecords.length === 0) {
      console.warn("⚠️ [빌드] 게임 기록 없음. 빈 데이터로 저장.");
      await prisma.leaderboardCache.upsert({
        where: { id: 'leaderboard' },
        update: { data: [], updatedAt: new Date() },
        create: { id: 'leaderboard', data: [] }
      });
      return;
    }

    // 2. 플레이어 통계 집계
    let allPlayerStatistics = aggregateAllPlayerStatistics(
      allParsedGameRecords.map(record => record?.content || record)
    );
    allPlayerStatistics = allPlayerStatistics.filter(stats => stats.totalGames >= 10);
    console.log(`🔍 [빌드] 집계된 플레이어 통계 수: ${allPlayerStatistics.length}`);

    if (allPlayerStatistics.length === 0) {
      console.warn("⚠️ [빌드] 자격 플레이어 없음. 빈 데이터로 저장.");
      await prisma.leaderboardCache.upsert({
        where: { id: 'leaderboard' },
        update: { data: [], updatedAt: new Date() },
        create: { id: 'leaderboard', data: [] }
      });
      return;
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
            console.warn(`⚠️ [빌드] UUID ${stats.uuid} 닉네임 조회 실패: ${error.message}`);
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

    console.log(`✅ [빌드] 랭킹 데이터 DB 저장 완료. (${calculatedLeaderboard.length}명)`);
  } catch (error) {
    console.error("❌ [빌드] 랭킹 계산 오류:", error);
    // 빌드 실패로 인해 배포가 중단되지 않도록 exit(0)
    console.warn("⚠️ [빌드] 랭킹 계산 실패했지만 배포는 계속 진행합니다.");
  }
}

buildLeaderboard().then(() => {
  console.log("✅ [빌드] 랭킹 빌드 스크립트 완료.");
  process.exit(0);
}).catch(error => {
  console.error("❌ [빌드] 예기치 않은 오류:", error);
  process.exit(0); // 배포 중단 방지
});
