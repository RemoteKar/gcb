const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { getUUID } = require('../services/mojang');
const { getBadgeData, getGameHistory } = require('../services/github');

const MAX_RECORDS = 400;
const CACHE_DURATION_MS = 180 * 1000; // 캐시 유지 시간 (300초 = 5분)

// GitHub 관련 설정 (환경 변수로 관리)
const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN; 

// Repository 루트 기준 Data 폴더 경로
const baseDataPath = '/Data';

// 캐시 객체들


//----------------------------------------
// 📌 UUID 조회 (Mojang API 사용)
//----------------------------------------
router.get('/uuid', async (req, res) => {
  const { nickname } = req.query;
  console.log(`🔍 [서버] UUID 요청: 닉네임 = ${nickname}`);

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
const cacheMiddleware = require('../middleware/cache');

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

    badgeCache[formattedUUID] = {
      data: badgeData,
      timestamp: now
    };

    res.json(badgeData);
  } catch (error) {
    console.error("❌ [서버] 배지 데이터 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

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

    statisticCache[formattedUUID] = {
      data: responsePayload,
      timestamp: now
    };

    res.json(responsePayload);
  } catch (error) {
    console.error("❌ [서버] 게임 기록 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
