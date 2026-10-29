// 빌드 시 Data/gameHistory 로 랭킹 계산 → client/data/leaderboard.json (+ DB: /api/uuid 닉네임 폴백용)
const fs = require('fs');
const path = require('path');
const { getProfileByUUID } = require('../server/services/mojang');
const { getPrismaClientOrNull } = require('../server/services/prisma');
const { aggregateAllPlayerStatistics } = require('../server/utils/statistics');
const { readGameRecords } = require('./read-game-records');
const { formatUUID } = require('../server/util');
const { CREATIVE_ID_MAX_EXCLUSIVE, isCreativeCharacter } = require('../client/scripts/character-config');

const outPath = path.resolve(__dirname, '..', 'client', 'data', 'leaderboard.json');
const MIN_GAMES = 10;
const PRIOR_GAMES = 20; // 모든 유저가 '50점짜리 20판'을 깔고 시작
const MMR_AVERAGE = 1000; // 점수 50 = MMR 1000
const NICKNAME_CONCURRENCY = 4; // Mojang 429 방지

function formatStatistics(stats) {
  return {
    mmr: Math.round(stats.rankingScore / 50 * MMR_AVERAGE).toString(),
    averagePlacement: stats.averagePlacement.toFixed(1),
    winRate: stats.winRate.toFixed(1),
    winCount: stats.winCount.toString(),
    avarageRankLeast50: stats.avarageRankLeast50.toFixed(1),
    mostUsedCharacter: stats.mostUsedCharacter,
    mostUsedAugments: stats.mostUsedAugments,
    averageDamageDealt: stats.averageDamageDealt.toFixed(0),
    averageDamageTaken: stats.averageDamageTaken.toFixed(0),
    averageKillRate: stats.averageKillRate.toFixed(2),
    averageDeaths: stats.averageDeaths.toFixed(1),
    maxDamageDealt: stats.maxDamageDealt.toFixed(0),
    maxDamageTaken: stats.maxDamageTaken.toFixed(0),
    maxKill: stats.maxKill.toString(),
    totalGames: stats.totalGames.toString()
  };
}

// 판마다 순위 백분위 = 이긴 사람 수 / (참가자 - 1): 1등 1, 꼴등 0. 순위 없음 = 공동 꼴찌
function placementSums(contents) {
  const sums = {};
  for (const { Game, Player } of contents) {
    if (!Game?.joinedPlayers || !Player) continue;
    const rows = Game.joinedPlayers.split(',').map(s => s.trim()).filter(u => Player[u])
      .map(u => ({ u, r: typeof Player[u].Ranking === 'number' ? Player[u].Ranking : Infinity, ch: Player[u].Character ?? 99999 }));
    for (const a of rows) {
      if (a.ch >= CREATIVE_ID_MAX_EXCLUSIVE || isCreativeCharacter(a.ch)) continue;
      const beaten = rows.filter(b => b.r > a.r).length + (rows.filter(b => b.r === a.r).length - 1) / 2;
      const key = formatUUID(a.u);
      sums[key] = (sums[key] || 0) + (rows.length > 1 ? beaten / (rows.length - 1) : 0.5);
    }
  }
  return sums;
}

// 점수 = 백분위 평균을 50점짜리 PRIOR_GAMES 판과 섞은 값(판수가 적을수록 50 쪽), 동점이면 판수 많은 쪽 위
function rankPlayers(contents) {
  const sums = placementSums(contents);
  const players = aggregateAllPlayerStatistics(contents).filter(s => s.totalGames >= MIN_GAMES);
  players.forEach(s => {
    const sum = sums[s.uuid] || 0;
    s.averagePlacement = sum / s.totalGames * 100;
    s.rankingScore = (sum + PRIOR_GAMES * 0.5) / (s.totalGames + PRIOR_GAMES) * 100;
  });
  return players.sort((a, b) => b.rankingScore - a.rankingScore || b.totalGames - a.totalGames);
}

async function buildLeaderboard() {
  console.log("🚀 [빌드] 랭킹 데이터 계산 시작...");

  const records = readGameRecords();
  console.log(`🔍 [빌드] 파싱된 게임 기록 수: ${records.length}`);

  const players = rankPlayers(records.map(r => r.content));
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
