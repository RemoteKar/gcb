const express = require('express');
const router = express.Router();
const { getUUID, getProfileByUUID } = require('../services/mojang');
const { getBadgeData, getGameHistory, fetchAllGameRecords, refreshAllGameRecordsCache, getCharacterList, getCharacterInfo, getSkillLinks, getWeaponList } = require('../services/github');
const { computeStatistics, aggregateAllPlayerStatistics } = require('../utils/statistics');
const cacheMiddleware = require('../middleware/cache');
const { formatUUID } = require('../util');
const { toNonHyphenatedUUID } = require('../util'); // toNonHyphenatedUUID 추가

module.exports.precalculatedLeaderboard = []; // 전역 변수로 랭킹 데이터 저장

// 통계 데이터를 클라이언트 응답 형식으로 포맷팅하는 헬퍼 함수
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

async function initializeLeaderboard() {
  console.log("🚀 [서버] 랭킹 데이터 초기화 시작...");
  try {
    // GitHub API를 통해 모든 게임 기록을 가져옴
    const allParsedGameRecords = await refreshAllGameRecordsCache();
    console.log(`🔍 [서버] 파싱된 게임 기록 수: ${allParsedGameRecords.length}`);
    if (allParsedGameRecords.length === 0) {
        console.warn("⚠️ [서버] 파싱된 게임 기록이 없습니다. 랭킹 초기화 실패.");
        module.exports.precalculatedLeaderboard = []; // 빈 배열로 설정
        return; // 데이터가 없으면 더 이상 진행하지 않음
    }

    let allPlayerStatistics = aggregateAllPlayerStatistics(allParsedGameRecords.map(record => record?.content || record));
    // 플레이 수가 20 이상인 유저만 포함
    allPlayerStatistics = allPlayerStatistics.filter(stats => stats.totalGames >= 20);
    console.log(`🔍 [서버] 집계된 플레이어 통계 수: ${allPlayerStatistics.length}`);
    if (allPlayerStatistics.length === 0) {
        console.warn("⚠️ [서버] 집계된 플레이어 통계가 없습니다. 랭킹 초기화 실패.");
        module.exports.precalculatedLeaderboard = []; // 빈 배열로 설정
        return; // 통계가 없으면 더 이상 진행하지 않음
    }

    // 랭킹 기준: 승률 * 순방률
    allPlayerStatistics.forEach(stats => {
      stats.rankingScore = (stats.winRate / 100) * (stats.avarageRankLeast50 / 100);
    });

    allPlayerStatistics.sort((a, b) => b.rankingScore - a.rankingScore);
    console.log(`🔍 [서버] 정렬된 플레이어 통계 수: ${allPlayerStatistics.length}`);

    // 모든 고유 UUID에 대해 Mojang API 프로필 및 배지 데이터를 미리 캐싱
    const uniqueUUIDs = [...new Set(allPlayerStatistics.map(stats => stats.uuid))];
    await Promise.all(uniqueUUIDs.map(async uuid => {
        await getProfileByUUID(uuid).catch(error => {
            console.warn(`⚠️ [서버] 사전 캐싱 중 UUID ${uuid} 에 대한 닉네임 조회 실패: ${error.message}`);
            return null; // 실패해도 진행
        });
        await getBadgeData(uuid).catch(error => {
            console.warn(`⚠️ [서버] 사전 캐싱 중 UUID ${uuid} 에 대한 배지 데이터 조회 실패: ${error.message}`);
            return null; // 실패해도 진행
        });
    }));

    const calculatedLeaderboard = await Promise.all(allPlayerStatistics.map(async (stats, index) => {
      let nickname = stats.uuid; // 기본값은 UUID
      // 상위 20명에 대해서만 닉네임 조회
      if (index < 20) {
        try {
          const profile = await getProfileByUUID(stats.uuid); // 이미 캐시되어 있을 가능성이 높음
          if (profile && profile.name) {
            nickname = profile.name;
          }
        } catch (error) {
          console.warn(`⚠️ [서버] UUID ${stats.uuid} 에 대한 닉네임 조회 실패: ${error.message}`);
        }
      }

      return {
        uuid: stats.uuid,
        nickname: nickname,
        ...formatStatistics(stats)
      };
    }));

    module.exports.precalculatedLeaderboard = calculatedLeaderboard;

    console.log("✅ [서버] 랭킹 데이터 초기화 완료.");
  } catch (error) {
    console.error("❌ [서버] 랭킹 데이터 초기화 오류:", error);
  } finally {
    isLeaderboardInitializing = false; // 초기화 완료 또는 오류 발생 시 플래그 해제
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
    const statistics = computeStatistics(gameHistory.map(record => record.content), req.formattedUUID);
    const responsePayload = {
      statistics: formatStatistics(statistics),
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
let isLeaderboardInitializing = false;

router.get('/leaderboard', async (req, res) => {
  console.log(`🔍 [서버] 랭킹 데이터 요청`);

  // 데이터가 없거나 비어있고, 현재 초기화 중이 아닐 때만 초기화 진행
  if (!module.exports.precalculatedLeaderboard || module.exports.precalculatedLeaderboard.length === 0) {
    if (!isLeaderboardInitializing) {
      isLeaderboardInitializing = true; // 초기화 시작 플래그 설정
      try {
        await initializeLeaderboard();
      } finally {
        isLeaderboardInitializing = false; // 완료 또는 실패 시 플래그 해제
      }
    } else {
      // 이미 초기화가 진행 중인 경우, 클라이언트에게 잠시 후 다시 시도하라는 응답을 보낼 수 있습니다.
      // 또는, 완료될 때까지 기다리게 할 수도 있습니다. 여기서는 간단하게 503을 반환합니다.
      return res.status(503).json({ error: "랭킹 데이터를 준비하고 있습니다. 잠시 후 다시 시도해주세요." });
    }
  }

  res.json(module.exports.precalculatedLeaderboard);
});

const { getCharacterStats, getAugmentStats } = require('../services/statisticsService');

//----------------------------------------
// 📌 글로벌 캐릭터 통계 조회 (최신 60경기 기반)
//----------------------------------------
router.get('/character-stats', async (req, res) => {
    console.log(`🔍 [서버] 글로벌 캐릭터 통계 요청`);
    try {
        const stats = await getCharacterStats();
        res.json(stats);
    } catch (error) {
        console.error("❌ [서버] 글로벌 캐릭터 통계 조회 오류:", error);
        res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});

//----------------------------------------
// 📌 모든 게임 기록 조회
//----------------------------------------
router.get('/all_game_history', cacheMiddleware('all_game_history'), async (req, res) => {
  console.log(`🔍 [서버] 모든 게임 기록 요청`);
  try {
    const allParsedGameRecords = await fetchAllGameRecords(); // fetchAllGameRecords 복원
    res.json({ gameRecords: allParsedGameRecords });
  } catch (error) {
    console.error("❌ [서버] 모든 게임 기록 조회 오류:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/augment-stats', async (req, res) => {
    console.log(`🔍 [서버] 증강 통계 요청`);
    try {
        const stats = await getAugmentStats();
        res.json(stats);
    } catch (error) {
        console.error("❌ [서버] 증강 통계 조회 오류:", error);
        res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});

//----------------------------------------
// 📌 캐릭터 목록 조회 (1~899번)
//----------------------------------------
router.get('/character-list', async (req, res) => {
    console.log(`🔍 [서버] 캐릭터 목록 요청`);
    try {
        const characters = await getCharacterList();
        res.json({ characters });
    } catch (error) {
        console.error("❌ [서버] 캐릭터 목록 조회 오류:", error);
        res.status(500).json({ error: '캐릭터 목록을 가져올 수 없습니다.' });
    }
});

//----------------------------------------
// 📌 캐릭터 상세 정보 조회
//----------------------------------------
router.get('/character-info', async (req, res) => {
    const { id } = req.query;
    console.log(`🔍 [서버] 캐릭터 정보 요청: ID = ${id}`);

    if (!id) {
        return res.status(400).json({ error: "캐릭터 ID를 입력하세요." });
    }

    const characterId = parseInt(id, 10);
    if (isNaN(characterId) || characterId < 1 || characterId >= 900) {
        return res.status(400).json({ error: "유효하지 않은 캐릭터 ID입니다." });
    }

    try {
        const charInfo = await getCharacterInfo(characterId);
        if (!charInfo) {
            return res.status(404).json({ error: "캐릭터를 찾을 수 없습니다." });
        }
        res.json(charInfo);
    } catch (error) {
        console.error("❌ [서버] 캐릭터 정보 조회 오류:", error);
        res.status(500).json({ error: '캐릭터 정보를 가져올 수 없습니다.' });
    }
});

//----------------------------------------
// 📌 스킬 링크 매핑 조회 (skillId → 이동 경로)
//----------------------------------------
router.get('/skill-links', async (req, res) => {
    console.log(`🔍 [서버] 스킬 링크 매핑 요청`);
    try {
        const skillLinks = await getSkillLinks();
        res.json({ skillLinks });
    } catch (error) {
        console.error("❌ [서버] 스킬 링크 조회 오류:", error);
        res.status(500).json({ error: '스킬 링크를 가져올 수 없습니다.' });
    }
});

//----------------------------------------
// 📌 무기 정보 조회
//----------------------------------------
router.get('/weapon-info', async (req, res) => {
    const { id } = req.query;
    console.log(`🔍 [서버] 무기 정보 요청: ID = ${id}`);

    if (!id) {
        return res.status(400).json({ error: "무기 ID를 입력하세요." });
    }

    // 경로 조작 방지
    if (id.includes('/') || id.includes('\\') || id.includes('..')) {
        return res.status(400).json({ error: "유효하지 않은 무기 ID입니다." });
    }

    try {
        const weapons = await getWeaponList(id);
        if (!weapons) {
            return res.status(404).json({ error: "무기 정보를 찾을 수 없습니다." });
        }
        res.json({ weaponId: id, weapons });
    } catch (error) {
        console.error("❌ [서버] 무기 정보 조회 오류:", error);
        res.status(500).json({ error: '무기 정보를 가져올 수 없습니다.' });
    }
});

module.exports = router;
module.exports.initializeLeaderboard = initializeLeaderboard;