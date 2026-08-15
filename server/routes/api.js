const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getUUID, getProfileByUUID } = require('../services/mojang');
const { getCharacterList, getCharacterInfo, getSkillLinks, getWeaponList, getTitanList, getTitanInfo, getAugmentList, createFeedbackIssue, getFeedbackIssues, clearFeedbackCache } = require('../services/github');
const { getPrismaClient } = require('../services/prisma');
const authMiddleware = require('../middleware/auth');
const NodeCache = require('node-cache');
const { getClientIp, extractIpv4, getIpv4Prefix } = require('../utils/ip');
const config = require('../../config');

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
    if (!['bug', 'enhancement', 'other', 'gcbc'].includes(category)) {
        return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    if (title.trim().length === 0 || title.length > 100) {
        return res.status(400).json({ error: '제목은 1~100자로 입력하세요.' });
    }
    if (content.trim().length === 0 || content.length > 2000) {
        return res.status(400).json({ error: '내용은 1~2000자로 입력하세요.' });
    }

    const categoryNames = { bug: '버그', enhancement: '건의', other: '기타', gcbc: 'GCBC' };
    const issueTitle = `[${categoryNames[category]}] ${title.trim()}`;
    const issueBody = `**카테고리**: ${categoryNames[category]}\n**작성자**: ${req.user.name}\n\n---\n\n${content.trim()}`;
    const labels = [category, 'user-feedback'];

    try {
        const issue = await createFeedbackIssue(issueTitle, issueBody, labels);
        clearFeedbackCache();
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
    const skipCache = !!req.query.t;
    console.log(`🔍 [서버] 피드백 목록 요청${skipCache ? ' (캐시 무시)' : ''}`);
    try {
        if (skipCache) clearFeedbackCache();
        const issues = await getFeedbackIssues();
        res.json({ issues });
    } catch (error) {
        console.error("❌ [서버] 피드백 목록 조회 오류:", error);
        res.status(500).json({ error: '목록을 가져올 수 없습니다.' });
    }
});

//----------------------------------------
// 📌 캐릭터 댓글 (디시 스타일: 비로그인, 닉네임/비밀번호 매번 입력)
//----------------------------------------
const COMMENTS_PER_PAGE = 20;
const MAX_COMMENTS_PER_CHARACTER = 100;
const commentRateLimit = new NodeCache({ stdTTL: 30 });

function timingSafeStringEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

router.get('/character-comments', async (req, res) => {
    const characterId = parseInt(req.query.id, 10);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    if (isNaN(characterId)) {
        return res.status(400).json({ error: '캐릭터 ID가 필요합니다.' });
    }

    try {
        const prisma = getPrismaClient();

        const [comments, totalCount] = await Promise.all([
            prisma.characterComment.findMany({
                where: { characterId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * COMMENTS_PER_PAGE,
                take: COMMENTS_PER_PAGE,
                select: {
                    id: true,
                    nickname: true,
                    ipPrefix: true,
                    content: true,
                    createdAt: true,
                },
            }),
            prisma.characterComment.count({ where: { characterId } }),
        ]);

        res.json({
            comments,
            totalCount,
            totalPages: Math.max(1, Math.ceil(totalCount / COMMENTS_PER_PAGE)),
            page,
        });
    } catch (error) {
        console.error('❌ [서버] 댓글 조회 오류:', error);
        res.status(500).json({ error: '댓글을 가져올 수 없습니다.' });
    }
});

router.post('/character-comments', async (req, res) => {
    const { characterId, nickname, password, content } = req.body || {};

    const charId = parseInt(characterId, 10);
    if (isNaN(charId)) {
        return res.status(400).json({ error: '유효하지 않은 캐릭터 ID입니다.' });
    }

    const rawNick = typeof nickname === 'string' ? nickname.trim() : '';
    let finalNick;
    if (rawNick.length === 0) {
        finalNick = config.defaultCommentNickname || 'ㅇㅇ';
    } else {
        if (rawNick.length > 15) {
            return res.status(400).json({ error: '닉네임은 15자 이하로 입력하세요.' });
        }
        if (/\s/.test(rawNick)) {
            return res.status(400).json({ error: '닉네임에 공백을 포함할 수 없습니다.' });
        }
        finalNick = rawNick;
    }

    if (typeof password !== 'string' || !/^[a-zA-Z0-9]{4}$/.test(password)) {
        return res.status(400).json({ error: '비밀번호는 영문/숫자 4자입니다.' });
    }

    if (typeof content !== 'string') {
        return res.status(400).json({ error: '내용이 필요합니다.' });
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 300) {
        return res.status(400).json({ error: '내용은 1~300자로 입력하세요.' });
    }

    const rawIp = getClientIp(req);
    const ipv4 = extractIpv4(rawIp);
    if (!ipv4) {
        return res.status(400).json({ error: 'IPv4 환경에서만 댓글을 작성할 수 있습니다.' });
    }
    const ipPrefix = getIpv4Prefix(ipv4);

    const rateKey = `comment_${ipv4}`;
    if (commentRateLimit.get(rateKey)) {
        return res.status(429).json({ error: '30초에 한 번만 작성할 수 있습니다.' });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const prisma = getPrismaClient();

        const comment = await prisma.characterComment.create({
            data: {
                characterId: charId,
                nickname: finalNick,
                passwordHash,
                ipPrefix,
                content: trimmedContent,
            },
            select: {
                id: true,
                nickname: true,
                ipPrefix: true,
                content: true,
                createdAt: true,
            },
        });

        // 캐릭터당 최대 100개 유지: 초과 시 오래된 것부터 삭제
        const totalCount = await prisma.characterComment.count({ where: { characterId: charId } });
        if (totalCount > MAX_COMMENTS_PER_CHARACTER) {
            const excess = totalCount - MAX_COMMENTS_PER_CHARACTER;
            const oldest = await prisma.characterComment.findMany({
                where: { characterId: charId },
                orderBy: { createdAt: 'asc' },
                take: excess,
                select: { id: true },
            });
            if (oldest.length > 0) {
                await prisma.characterComment.deleteMany({
                    where: { id: { in: oldest.map(c => c.id) } },
                });
            }
        }

        commentRateLimit.set(rateKey, true);
        res.json({ success: true, comment });
    } catch (error) {
        console.error('❌ [서버] 댓글 작성 오류:', error);
        res.status(500).json({ error: '댓글 작성에 실패했습니다.' });
    }
});

router.delete('/character-comments/:id', async (req, res) => {
    const commentId = parseInt(req.params.id, 10);
    const { password } = req.body || {};

    if (isNaN(commentId)) {
        return res.status(400).json({ error: '유효하지 않은 댓글 ID입니다.' });
    }
    if (typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ error: '비밀번호가 필요합니다.' });
    }

    try {
        const prisma = getPrismaClient();

        const comment = await prisma.characterComment.findUnique({ where: { id: commentId } });
        if (!comment) {
            return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
        }

        const isMaster = !!config.masterPassword && timingSafeStringEqual(password, config.masterPassword);
        const isOwner = !isMaster && (await bcrypt.compare(password, comment.passwordHash));

        if (!isMaster && !isOwner) {
            return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
        }

        await prisma.characterComment.delete({ where: { id: commentId } });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [서버] 댓글 삭제 오류:', error);
        res.status(500).json({ error: '댓글 삭제에 실패했습니다.' });
    }
});

//----------------------------------------
// 📌 [임시] 디시 모바일 글 본문 프록시 (패치노트 일회성 가져오기용, 끝나면 삭제)
//----------------------------------------
router.get('/dc-post/:no', async (req, res) => {
    const no = String(req.params.no).replace(/\D/g, '');
    if (!no) return res.status(400).send('');
    try {
        const r = await fetch(`https://m.dcinside.com/board/steve/${no}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
                'Accept-Language': 'ko',
                'Referer': 'https://m.dcinside.com/board/steve',
            },
        });
        const html = await r.text();
        res.status(r.status).set('Content-Type', 'text/html; charset=utf-8').send(html);
    } catch (e) {
        res.status(502).send('');
    }
});

module.exports = router;
