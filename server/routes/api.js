const express = require('express');
const router = express.Router();
const { getUUID } = require('../services/mojang');
const { getBadgeData, getGameHistory, getAllGameHistoryFileMetadata, fetchAndParseYamlFile } = require('../services/github');
const { computeStatistics, aggregateAllPlayerStatistics } = require('../utils/statistics');
const cacheMiddleware = require('../middleware/cache');
const { formatUUID } = require('../util');

let precalculatedLeaderboard = []; // 전역 변수로 랭킹 데이터 저장

async function initializeLeaderboard() {
  console.log("🚀 [서버] 랭킹 데이터 초기화 시작...");
  try {
    const filesMetadata = await getAllGameHistoryFileMetadata();
    const allGameRecordsPromises = filesMetadata.map(file => fetchAndParseYamlFile(file.download_url));
    const allParsedGameRecords = (await Promise.all(allGameRecordsPromises)).filter(record => record !== null);

    const allPlayerStatistics = aggregateAllPlayerStatistics(allParsedGameRecords);

    // 랭킹 기준: 승률 * 순방률
    allPlayerStatistics.forEach(stats => {
      stats.rankingScore = (stats.winRate / 100) * (stats.avarageRankLeast50 / 100);
    });

    allPlayerStatistics.sort((a, b) => b.rankingScore - a.rankingScore);

    precalculatedLeaderboard = allPlayerStatistics.map(stats => ({
      uuid: stats.uuid,
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
    }));

    console.log("✅ [서버] 랭킹 데이터 초기화 완료.");
  } catch (error) {
    console.error("❌ [서버] 랭킹 데이터 초기화 오류:", error);
  }
}

//----------------------------------------
// 📌 UUID 조회 (Mojang API 사용)
//----------------------------------------
router.get('/uuid', async (req, res) => {
  const { nickname } = req.query;
  console.log(`🔍 [서버] UUID 요청: 닉네임 = ${nickname}`);

  if (!nickname) {
    return res.status(400).json({ error: "닉네임을 입력하세요." });
  }

  try {
    const uuid = await getUUID(nickname);
    res.json({ uuid });
  } catch (error) {
    console.error("❌ [서버] UUID 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

//----------------------------------------
// 📌 배지 데이터 조회 (GitHub Private Repository 사용 + 캐싱)
//----------------------------------------
router.get('/badge', (req, res, next) => {
  const { uuid } = req.query;
  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }
  req.formattedUUID = formatUUID(uuid);
  next();
}, cacheMiddleware('badge'), async (req, res) => {
  console.log(`🔍 [서버] 배지 데이터 요청: UUID = ${req.query.uuid}`);
  try {
    const badgeData = await getBadgeData(req.formattedUUID);
    console.log(`✅ [서버] 배지 데이터 응답: ${JSON.stringify(badgeData)}`);
    res.json(badgeData);
  } catch (error) {
    console.error("❌ [서버] 배지 데이터 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

//----------------------------------------
// 📌 게임 기록 조회 및 통계 계산 (GitHub Private Repository 사용 + 캐싱)
//----------------------------------------
router.get('/statistic', (req, res, next) => {
  const { uuid } = req.query;
  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }
  req.formattedUUID = formatUUID(uuid);
  next();
}, cacheMiddleware('statistic'), async (req, res) => {
  console.log(`🔍 [서버] 게임 기록 요청: UUID = ${req.query.uuid}`);
  try {
    const gameHistory = await getGameHistory(req.formattedUUID);
    const statistics = computeStatistics(gameHistory, req.formattedUUID);
    const formattedStatistics = {
      winRate: statistics.winRate.toFixed(1),
      winCount: statistics.winCount.toString(),
      avarageRankLeast50: statistics.avarageRankLeast50.toFixed(1),
      mostUsedCharacter: statistics.mostUsedCharacter,
      mostUsedAugments: statistics.mostUsedAugments,
      averageDamageDealt: statistics.averageDamageDealt.toFixed(0),
      averageDamageTaken: statistics.averageDamageTaken.toFixed(0),
      averageKillRate: statistics.averageKillRate.toFixed(2),
      averageAliveTime: statistics.averageAliveTime.toFixed(1),
      maxDamageDealt: statistics.maxDamageDealt.toFixed(0),
      maxDamageTaken: statistics.maxDamageTaken.toFixed(0),
      maxKill: statistics.maxKill.toString(),
      totalGames: statistics.totalGames.toString()
    };
    const responsePayload = {
      statistics: formattedStatistics,
      gameRecords: gameHistory
    };
    res.json(responsePayload);
  } catch (error) {
    console.error("❌ [서버] 게임 기록 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

//----------------------------------------
// 📌 랭킹 데이터 조회 (모든 유저 통계 집계 및 정렬)
//----------------------------------------
router.get('/leaderboard', cacheMiddleware('leaderboard'), async (req, res) => {
  console.log(`🔍 [서버] 랭킹 데이터 요청`);
  // 미리 계산된 랭킹 데이터를 반환
  res.json(precalculatedLeaderboard);
});

module.exports = router;
module.exports.initializeLeaderboard = initializeLeaderboard; // initializeLeaderboard 함수를 외부로 노출