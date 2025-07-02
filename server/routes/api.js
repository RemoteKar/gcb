const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { getUUID } = require('../services/mojang');
const { getBadgeData, getGameHistory } = require('../services/github');

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
router.get('/badge', cacheMiddleware('badge'), async (req, res) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 배지 데이터 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  const formattedUUID = formatUUID(uuid);

  try {
    const badgeData = await getBadgeData(formattedUUID);
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
router.get('/statistic', cacheMiddleware('statistic'), async (req, res) => {
  const { uuid } = req.query;
  console.log(`🔍 [서버] 게임 기록 요청: UUID = ${uuid}`);

  if (!uuid) {
    return res.status(400).json({ error: "UUID를 입력하세요." });
  }

  const formattedUUID = formatUUID(uuid);

  try {
    const gameHistory = await getGameHistory(formattedUUID);
    const statistics = computeStatistics(gameHistory, uuid);
    const responsePayload = {
      statistics,
      gameRecords: gameHistory
    };
    res.json(responsePayload);
  } catch (error) {
    console.error("❌ [서버] 게임 기록 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
