// /user/:name → 정적 user.html 에 OG 메타태그만 끼워 넣어 응답 (디스코드/카톡 링크 미리보기용)
// 일반 브라우저에는 조회 없이 즉시 응답, 봇(UA)에게만 닉네임→UUID→전적 조회 후 상세 설명 삽입
const express = require('express');
const fetch = require('node-fetch');
const { getUUID } = require('../services/mojang');
const { formatUUID } = require('../util');

const router = express.Router();

const BOT_UA = /bot|discord|slack|twitter|facebook|kakao|telegram|whatsapp|line|preview|embed|crawler|spider|curl/i;
const HTML_TTL_MS = 5 * 60 * 1000;
let htmlCache = { base: null, html: null, at: 0 };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function getUserHtml(base) {
    if (htmlCache.html && htmlCache.base === base && Date.now() - htmlCache.at < HTML_TTL_MS) return htmlCache.html;
    const res = await fetch(`${base}/user.html`);
    if (!res.ok) throw new Error(`user.html 로드 실패: ${res.status}`);
    const html = await res.text();
    htmlCache = { base, html, at: Date.now() };
    return html;
}

async function buildBotDescription(base, name) {
    const isUuid = /^[0-9a-f]{32}$/i.test(name) || /^[0-9a-f-]{36}$/i.test(name);
    const uuid = isUuid ? name.replace(/-/g, '') : await getUUID(name);
    if (!uuid) return null;
    const res = await fetch(`${base}/data/user-statistics/${formatUUID(uuid)}.json`);
    if (!res.ok) return { uuid, description: '기록된 게임이 없습니다.' };
    const { statistics: s } = await res.json();
    const most = s.mostUsedCharacter && s.mostUsedCharacter !== 'N/A' ? ` · 모스트 캐릭터 #${s.mostUsedCharacter}` : '';
    return { uuid, description: `${s.totalGames}판 · 승률 ${s.winRate}% (${s.winCount}승) · 순방률 ${s.avarageRankLeast50}% · 평균 ${s.averageKillRate}킬${most}` };
}

router.get('/:name', async (req, res) => {
    const name = decodeURIComponent(req.params.name || '');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const base = `${proto}://${host}`;

    let html;
    try {
        html = await getUserHtml(base);
    } catch (e) {
        console.error('❌ [UserPage] HTML 로드 실패:', e.message);
        return res.redirect(302, `/user.html`);
    }

    let title = `${name} - GCB.gg 전적`;
    let description = '게임캐릭터배틀 유저 전적 · 캐릭터별 통계 · 게임 기록';
    let image = '';

    if (BOT_UA.test(req.headers['user-agent'] || '')) {
        try {
            const info = await buildBotDescription(base, name);
            if (info) {
                description = info.description;
                image = `https://mc-heads.net/avatar/${info.uuid}/128`;
            }
        } catch (e) {
            console.warn('⚠️ [UserPage] 봇용 전적 조회 실패:', e.message);
        }
    }

    const tags = [
        `<title>${esc(title)}</title>`,
        `<meta property="og:title" content="${esc(title)}">`,
        `<meta property="og:description" content="${esc(description)}">`,
        `<meta property="og:type" content="profile">`,
        `<meta property="og:url" content="${esc(`${base}/user/${encodeURIComponent(name)}`)}">`,
        image ? `<meta property="og:image" content="${esc(image)}">` : '',
        `<meta name="twitter:card" content="summary">`,
    ].filter(Boolean).join('\n  ');

    const out = html.includes('<!--OG-->')
        ? html.replace('<!--OG-->', tags).replace(/<title>GCB\.gg - 유저 프로필<\/title>\s*/, '')
        : html;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(out);
});

module.exports = router;
