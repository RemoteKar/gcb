const express = require('express');
const router = express.Router();
const { getUUID } = require('../services/mojang');
const { getBadgeData, getGameHistory } = require('../services/github');
const { computeStatistics } = require('../utils/statistics');
const cacheMiddleware = require('../middleware/cache');
const { formatUUID } = require('../util');

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
  try {
    // 1. 모든 게임 기록 파일 메타데이터 가져오기
    const filesMetadata = await getAllGameHistoryFileMetadata();

    // 2. 모든 게임 기록 파일 다운로드 및 파싱
    const allGameRecordsPromises = filesMetadata.map(file => fetchAndParseYamlFile(file.download_url));
    const allParsedGameRecords = (await Promise.all(allGameRecordsPromises)).filter(record => record !== null);

    // 3. 모든 플레이어의 통계 집계
    const allPlayerStatistics = aggregateAllPlayerStatistics(allParsedGameRecords);

    // 4. 통계 기준으로 정렬 (예: totalGames 기준 내림차순)
    // 필요에 따라 다른 정렬 기준을 추가할 수 있습니다 (예: winRate, averageKillRate 등)
    allPlayerStatistics.sort((a, b) => b.totalGames - a.totalGames);

    // 5. 클라이언트에 반환할 형식으로 포맷팅
    const formattedLeaderboard = allPlayerStatistics.map(stats => ({
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

    res.json(formattedLeaderboard);
  } catch (error) {
    console.error("❌ [서버] 랭킹 데이터 조회 오류:", error);
    res.status(500).json({ error: "랭킹 데이터를 가져오는 중 오류가 발생했습니다." });
  }
});

module.exports = router;