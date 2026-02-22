const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client/edge');
const { withAccelerate } = require('@prisma/extension-accelerate');
const { getUUID, getProfileByUUID } = require('../services/mojang');
const { getBadgeData, getGameHistory, fetchAllGameRecords, getCharacterList, getCharacterInfo, getSkillLinks, getWeaponList, getTitanList, getTitanInfo, getAugmentList, createFeedbackIssue, getFeedbackIssues } = require('../services/github');
const authMiddleware = require('../middleware/auth');
const NodeCache = require('node-cache');
const { computeStatistics } = require('../utils/statistics');
const cacheMiddleware = require('../middleware/cache');
const { formatUUID } = require('../util');
const { toNonHyphenatedUUID } = require('../util');

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
// 📌 랭킹 데이터 조회 (DB에서 읽기)
//----------------------------------------
router.get('/leaderboard', async (req, res) => {
  console.log(`🔍 [서버] 랭킹 데이터 요청`);
  try {
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    }).$extends(withAccelerate());

    const cached = await prisma.leaderboardCache.findUnique({
      where: { id: 'leaderboard' }
    });

    if (!cached || !cached.data) {
      return res.json([]);
    }

    res.json(cached.data);
  } catch (error) {
    console.error("❌ [서버] 랭킹 데이터 조회 오류:", error);
    res.status(500).json({ error: '랭킹 데이터를 가져올 수 없습니다.' });
  }
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

//----------------------------------------
// 📌 증강 목록 조회 (이름 + 설명)
//----------------------------------------
router.get('/augment-list', async (req, res) => {
    console.log(`🔍 [서버] 증강 목록 요청`);
    try {
        const augments = await getAugmentList();
        res.json({ augments });
    } catch (error) {
        console.error("❌ [서버] 증강 목록 조회 오류:", error);
        res.status(500).json({ error: '증강 목록을 가져올 수 없습니다.' });
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

//----------------------------------------
// 📌 타이탄 목록 조회
//----------------------------------------
router.get('/titan-list', async (req, res) => {
    console.log(`🔍 [서버] 타이탄 목록 요청`);
    try {
        const result = await getTitanList();
        if (!result) {
            return res.status(404).json({ error: "타이탄 정보를 찾을 수 없습니다." });
        }
        res.json({ titans: result.titans, smartPistol: result.smartPistol });
    } catch (error) {
        console.error("❌ [서버] 타이탄 목록 조회 오류:", error);
        res.status(500).json({ error: '타이탄 목록을 가져올 수 없습니다.' });
    }
});

//----------------------------------------
// 📌 타이탄 상세 정보 조회
//----------------------------------------
router.get('/titan-info', async (req, res) => {
    const { id } = req.query;
    console.log(`🔍 [서버] 타이탄 정보 요청: ID = ${id}`);

    if (!id) {
        return res.status(400).json({ error: "타이탄 ID를 입력하세요." });
    }

    if (id.includes('/') || id.includes('\\') || id.includes('..')) {
        return res.status(400).json({ error: "유효하지 않은 타이탄 ID입니다." });
    }

    try {
        const titanInfo = await getTitanInfo(id);
        if (!titanInfo) {
            return res.status(404).json({ error: "타이탄을 찾을 수 없습니다." });
        }
        res.json(titanInfo);
    } catch (error) {
        console.error("❌ [서버] 타이탄 정보 조회 오류:", error);
        res.status(500).json({ error: '타이탄 정보를 가져올 수 없습니다.' });
    }
});

//----------------------------------------
// 📌 배치 UUID → 닉네임 조회
//----------------------------------------
router.get('/profiles', async (req, res) => {
  const { uuids } = req.query;
  if (!uuids) {
    return res.status(400).json({ error: "UUID 목록을 입력하세요." });
  }

  const uuidList = uuids.split(',').slice(0, 50); // 최대 50개 제한
  const result = {};

  await Promise.all(uuidList.map(async (uuid) => {
    try {
      const profile = await getProfileByUUID(uuid.trim());
      if (profile && profile.name) {
        result[uuid.trim()] = profile.name;
      }
    } catch (error) {
      // 실패 시 무시 (닉네임 없이 UUID로 표시)
    }
  }));

  res.json(result);
});

//----------------------------------------
// 📌 클라이언트 설정 (Google Client ID 등)
//----------------------------------------
router.get('/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        githubClientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    });
});

//----------------------------------------
// 📌 GitHub OAuth 코드 → 액세스 토큰 교환
//----------------------------------------
router.post('/auth/github', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: '인증 코드가 필요합니다.' });
    }

    try {
        // GitHub에 코드 → 액세스 토큰 교환 요청
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
                client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('❌ [Auth] GitHub 토큰 교환 실패:', tokenData.error_description);
            return res.status(401).json({ error: 'GitHub 인증에 실패했습니다.' });
        }

        // 액세스 토큰으로 유저 정보 조회
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${tokenData.access_token}`,
                'User-Agent': 'GCB-App',
            },
        });

        if (!userResponse.ok) {
            return res.status(401).json({ error: 'GitHub 유저 정보 조회 실패' });
        }

        const user = await userResponse.json();

        res.json({
            accessToken: tokenData.access_token,
            name: user.name || user.login,
            login: user.login,
            avatarUrl: user.avatar_url,
        });
    } catch (error) {
        console.error('❌ [Auth] GitHub OAuth 오류:', error);
        res.status(500).json({ error: 'GitHub 인증 처리 중 오류가 발생했습니다.' });
    }
});

// 피드백 제출 제한 (10분에 3회)
const feedbackRateLimit = new NodeCache({ stdTTL: 600 });

//----------------------------------------
// 📌 건의/버그 제출 (Google 로그인 필수)
//----------------------------------------
router.post('/feedback', authMiddleware, async (req, res) => {
    console.log(`🔍 [서버] 피드백 제출 요청`);

    // Rate limit 체크
    const rateKey = `feedback_${req.user.sub}`;
    const currentCount = feedbackRateLimit.get(rateKey) || 0;
    if (currentCount >= 3) {
        return res.status(429).json({ error: '너무 많은 요청입니다. 10분 후 다시 시도해주세요.' });
    }

    const { category, title, content } = req.body;

    if (!category || !title || !content) {
        return res.status(400).json({ error: '카테고리, 제목, 내용을 모두 입력하세요.' });
    }
    if (!['bug', 'enhancement', 'other'].includes(category)) {
        return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    if (title.trim().length === 0 || title.length > 100) {
        return res.status(400).json({ error: '제목은 1~100자로 입력하세요.' });
    }
    if (content.trim().length === 0 || content.length > 2000) {
        return res.status(400).json({ error: '내용은 1~2000자로 입력하세요.' });
    }

    const categoryNames = { bug: '버그', enhancement: '건의', other: '기타' };
    const issueTitle = `[${categoryNames[category]}] ${title.trim()}`;
    const issueBody = `**카테고리**: ${categoryNames[category]}\n**작성자**: ${req.user.name}\n\n---\n\n${content.trim()}`;
    const labels = [category, 'user-feedback'];

    try {
        const issue = await createFeedbackIssue(issueTitle, issueBody, labels);
        feedbackRateLimit.set(rateKey, currentCount + 1);
        console.log(`✅ [서버] 피드백 제출 완료: Issue #${issue.number}`);
        res.json({ success: true, issueNumber: issue.number });
    } catch (error) {
        console.error("❌ [서버] 피드백 제출 오류:", error);
        res.status(500).json({ error: '제출에 실패했습니다.' });
    }
});

//----------------------------------------
// 📌 건의/버그 목록 조회
//----------------------------------------
router.get('/feedback-list', async (req, res) => {
    console.log(`🔍 [서버] 피드백 목록 요청`);
    try {
        const issues = await getFeedbackIssues();
        res.json({ issues });
    } catch (error) {
        console.error("❌ [서버] 피드백 목록 조회 오류:", error);
        res.status(500).json({ error: '목록을 가져올 수 없습니다.' });
    }
});

module.exports = router;