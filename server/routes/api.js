const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getUUID, getProfileByUUID } = require('../services/mojang');
const { getPrismaClient } = require('../services/prisma');
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

// 유동 작성자 검증 (닉네임/비밀번호/IP) — 실패하면 { error }
function parseAnonAuthor(req) {
    const { nickname, password } = req.body || {};

    const rawNick = typeof nickname === 'string' ? nickname.trim() : '';
    if (rawNick.length > 15) {
        return { error: '닉네임은 15자 이하로 입력하세요.' };
    }
    if (/\s/.test(rawNick)) {
        return { error: '닉네임에 공백을 포함할 수 없습니다.' };
    }
    if (typeof password !== 'string' || !/^[a-zA-Z0-9]{4}$/.test(password)) {
        return { error: '비밀번호는 영문/숫자 4자입니다.' };
    }

    const ipv4 = extractIpv4(getClientIp(req));
    if (!ipv4) {
        return { error: 'IPv4 환경에서만 작성할 수 있습니다.' };
    }

    return {
        nickname: rawNick || config.defaultCommentNickname || 'ㅇㅇ',
        password,
        ipv4,
        ipPrefix: getIpv4Prefix(ipv4),
    };
}

function isMaster(password) {
    return !!config.masterPassword && timingSafeStringEqual(password, config.masterPassword);
}

// 작성자 비밀번호 또는 관리자(마스터) 비밀번호면 삭제 가능
async function canDelete(password, passwordHash) {
    return isMaster(password) || bcrypt.compare(password, passwordHash);
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
    const { characterId, content } = req.body || {};

    const charId = parseInt(characterId, 10);
    if (isNaN(charId)) {
        return res.status(400).json({ error: '유효하지 않은 캐릭터 ID입니다.' });
    }

    const author = parseAnonAuthor(req);
    if (author.error) {
        return res.status(400).json({ error: author.error });
    }

    if (typeof content !== 'string') {
        return res.status(400).json({ error: '내용이 필요합니다.' });
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 300) {
        return res.status(400).json({ error: '내용은 1~300자로 입력하세요.' });
    }

    const rateKey = `comment_${author.ipv4}`;
    if (commentRateLimit.get(rateKey)) {
        return res.status(429).json({ error: '30초에 한 번만 작성할 수 있습니다.' });
    }

    try {
        const passwordHash = await bcrypt.hash(author.password, 10);

        const prisma = getPrismaClient();

        const comment = await prisma.characterComment.create({
            data: {
                characterId: charId,
                nickname: author.nickname,
                passwordHash,
                ipPrefix: author.ipPrefix,
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

        if (!(await canDelete(password, comment.passwordHash))) {
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
// 📌 건의/버그 (댓글과 같은 유동 방식: 비로그인, 닉네임/비밀번호 매번 입력)
//----------------------------------------
router.get('/feedback-list', async (req, res) => {
    try {
        const prisma = getPrismaClient();

        const feedbacks = await prisma.feedback.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: {
                id: true,
                category: true,
                title: true,
                content: true,
                nickname: true,
                ipPrefix: true,
                status: true,
                createdAt: true,
            },
        });

        res.json({ feedbacks });
    } catch (error) {
        console.error('❌ [서버] 건의 목록 조회 오류:', error);
        res.status(500).json({ error: '목록을 가져올 수 없습니다.' });
    }
});

router.post('/feedback', async (req, res) => {
    const { category, title, content } = req.body || {};

    if (!['bug', 'enhancement', 'other', 'gcbc'].includes(category)) {
        return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (trimmedTitle.length === 0 || trimmedTitle.length > 100) {
        return res.status(400).json({ error: '제목은 1~100자로 입력하세요.' });
    }
    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    if (trimmedContent.length === 0 || trimmedContent.length > 2000) {
        return res.status(400).json({ error: '내용은 1~2000자로 입력하세요.' });
    }

    const author = parseAnonAuthor(req);
    if (author.error) {
        return res.status(400).json({ error: author.error });
    }

    try {
        const prisma = getPrismaClient();

        // 같은 IP 앞자리에서 10분에 3개까지 (함수 메모리는 콜드 스타트마다 비므로 DB로 셈)
        const recentCount = await prisma.feedback.count({
            where: {
                ipPrefix: author.ipPrefix,
                createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) },
            },
        });
        if (recentCount >= 3) {
            return res.status(429).json({ error: '너무 많은 요청입니다. 10분 후 다시 시도해주세요.' });
        }

        const passwordHash = await bcrypt.hash(author.password, 10);

        await prisma.feedback.create({
            data: {
                category,
                title: trimmedTitle,
                content: trimmedContent,
                nickname: author.nickname,
                passwordHash,
                ipPrefix: author.ipPrefix,
            },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('❌ [서버] 건의 작성 오류:', error);
        res.status(500).json({ error: '제출에 실패했습니다.' });
    }
});

router.delete('/feedback/:id', async (req, res) => {
    const feedbackId = parseInt(req.params.id, 10);
    const { password } = req.body || {};

    if (isNaN(feedbackId)) {
        return res.status(400).json({ error: '유효하지 않은 글 ID입니다.' });
    }
    if (typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ error: '비밀번호가 필요합니다.' });
    }

    try {
        const prisma = getPrismaClient();

        const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
        if (!feedback) {
            return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
        }

        if (!(await canDelete(password, feedback.passwordHash))) {
            return res.status(403).json({ error: '비밀번호가 일치하지 않습니다.' });
        }

        await prisma.feedback.delete({ where: { id: feedbackId } });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [서버] 건의 삭제 오류:', error);
        res.status(500).json({ error: '삭제에 실패했습니다.' });
    }
});

// 상태 전환(열림·해결·닫힘)은 관리자만
router.patch('/feedback/:id/status', async (req, res) => {
    const feedbackId = parseInt(req.params.id, 10);
    const { status, password } = req.body || {};

    if (isNaN(feedbackId)) {
        return res.status(400).json({ error: '유효하지 않은 글 ID입니다.' });
    }
    if (!['open', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }
    if (!isMaster(password)) {
        return res.status(403).json({ error: '관리자 비밀번호가 아닙니다.' });
    }

    try {
        const prisma = getPrismaClient();

        const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
        if (!feedback) {
            return res.status(404).json({ error: '글을 찾을 수 없습니다.' });
        }

        await prisma.feedback.update({ where: { id: feedbackId }, data: { status } });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [서버] 건의 상태 변경 오류:', error);
        res.status(500).json({ error: '상태를 바꾸지 못했습니다.' });
    }
});

module.exports = router;
