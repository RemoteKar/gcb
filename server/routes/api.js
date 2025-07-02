const express = require('express');
const router = express.Router();
const { getUUID, getProfileByUUID } = require('../services/mojang');
const { getBadgeData, getGameHistory, getAllGameHistoryFileMetadata, fetchAndParseYamlFile } = require('../services/github');
const { computeStatistics, aggregateAllPlayerStatistics } = require('../utils/statistics');
const cacheMiddleware = require('../middleware/cache');
const { formatUUID } = require('../util');
const { toNonHyphenatedUUID } = require('../util'); // toNonHyphenatedUUID 추가

module.exports.precalculatedLeaderboard = []; // 전역 변수로 랭킹 데이터 저장
let allGameRecordsCache = null; // 모든 게임 기록 캐시 변수 선언
let allGameRecordsCache = null; // 모든 게임 기록 캐시 변수 선언

async function initializeLeaderboard() {
  console.log("🚀 [서버] 랭킹 데이터 초기화 시작...");
  try {
    const filesMetadata = await getAllGameHistoryFileMetadata();
    console.log(`🔍 [서버] 가져온 파일 메타데이터 수: ${filesMetadata.length}`);

    const allGameRecordsPromises = filesMetadata.map(file => fetchAndParseYamlFile(file.download_url));
    const allParsedGameRecords = (await Promise.all(allGameRecordsPromises)).filter(record => record !== null);
    console.log(`🔍 [서버] 파싱된 게임 기록 수: ${allParsedGameRecords.length}`);
    if (allParsedGameRecords.length === 0) {
        console.warn("⚠️ [서버] 파싱된 게임 기록이 없습니다. 랭킹 초기화 실패.");
        return; // 데이터가 없으면 더 이상 진행하지 않음
    }

    const allPlayerStatistics = aggregateAllPlayerStatistics(allParsedGameRecords);
    console.log(`🔍 [서버] 집계된 플레이어 통계 수: ${Object.keys(allPlayerStatistics).length}`);
    if (Object.keys(allPlayerStatistics).length === 0) {
        console.warn("⚠️ [서버] 집계된 플레이어 통계가 없습니다. 랭킹 초기화 실패.");
        return; // 통계가 없으면 더 이상 진행하지 않음
    }

    // 랭킹 기준: 승률 * 순방률
    allPlayerStatistics.forEach(stats => {
      stats.rankingScore = (stats.winRate / 100) * (stats.avarageRankLeast50 / 100);
    });

    allPlayerStatistics.sort((a, b) => b.rankingScore - a.rankingScore);
    console.log(`🔍 [서버] 정렬된 플레이어 통계 수: ${allPlayerStatistics.length}`);

    module.exports.precalculatedLeaderboard = await Promise.all(allPlayerStatistics.map(async stats => {
      let nickname = stats.uuid; // 기본값은 UUID
      try {
        const profile = await getProfileByUUID(stats.uuid);
        if (profile && profile.name) {
          nickname = profile.name;
        }
      } catch (error) {
        console.warn(`⚠️ [서버] UUID ${stats.uuid} 에 대한 닉네임 조회 실패: ${error.message}`);
      }

      return {
        uuid: stats.uuid,
        nickname: nickname,
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
    if (!uuid) {
      return res.status(404).json({ error: "유저를 찾을 수 없습니다." });
    }
    res.json({ uuid });
  } catch (error) {
    console.error("❌ [서버] UUID 조회 오류:", error);
    console.error("❌ [서버] UUID 조회 오류 상세:", error.stack);
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
    console.error("❌ [서버] 배지 데이터 조회 오류 상세:", error.stack);
    // '배지 데이터를 찾을 수 없습니다.' 오류인 경우 404 응답
    if (error.message === '배지 데이터를 찾을 수 없습니다.') {
      return res.status(404).json({ error: error.message });
    }
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
  res.json(module.exports.precalculatedLeaderboard);
});

//----------------------------------------
// 📌 모든 게임 기록 조회
//----------------------------------------
router.get('/all_game_history', cacheMiddleware('all_game_history'), async (req, res) => {
  console.log(`🔍 [서버] 모든 게임 기록 요청`);
  try {
    if (allGameRecordsCache) {
      console.log(`✅ [서버] 모든 게임 기록 캐시 히트`);
      return res.json({ gameRecords: allGameRecordsCache });
    }
    const allParsedGameRecords = await fetchAllGameRecords();
    allGameRecordsCache = allParsedGameRecords; // 캐시에 저장
    res.json({ gameRecords: allParsedGameRecords });
  } catch (error) {
    console.error("❌ [서버] 모든 게임 기록 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.initializeLeaderboard = initializeLeaderboard;