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
router.get('/badge', cacheMiddleware('badge'), async (req, res, next) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 배지 데이터 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  req.formattedUUID = formatUUID(uuid);
  next();
}, async (req, res) => {
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
router.get('/statistic', cacheMiddleware('statistic'), async (req, res, next) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 게임 기록 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  req.formattedUUID = formatUUID(uuid);
  next();
}, async (req, res) => {
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

module.exports = router;