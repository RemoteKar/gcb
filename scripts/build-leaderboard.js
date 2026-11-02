// 빌드 시 Data/gameHistory 로 랭킹 계산 → client/data/leaderboard.json (+ DB: /api/uuid 닉네임 폴백용)
// 기록에 나온 모든 유저 닉네임 → client/data/nicknames.json (화면이 /api/profiles 를 부르지 않게)
const fs = require('fs');
const path = require('path');
const { getProfileByUUID } = require('../server/services/mojang');
const { getPrismaClientOrNull } = require('../server/services/prisma');
const { readGameRecords } = require('./read-game-records');
const { gameRows, totals, add, summarize, isStatCharacter } = require('./game-stats');

const outDir = path.resolve(__dirname, '..', 'client', 'data');
const MIN_GAMES = 10;
const PRIOR_GAMES = 20; // 모든 유저가 '50점짜리 20판'을 깔고 시작
const MMR_AVERAGE = 1000; // 점수 50 = MMR 1000
const NICKNAME_CONCURRENCY = 4; // Mojang 429 방지

// 정식 캐릭터 판만. 점수 = 판마다 이긴 사람 비율 평균을 50점짜리 PRIOR_GAMES 판과 섞은 값(판수가 적을수록 50 쪽), 동점이면 판수 많은 쪽 위
function rankPlayers(records) {
    const players = new Map();
    for (const { content } of records) {
        for (const row of gameRows(content)) {
            if (!isStatCharacter(row.character)) continue;
            if (!players.has(row.uuid)) players.set(row.uuid, { uuid: row.uuid, t: totals(), characters: {} });
            const p = players.get(row.uuid);
            add(p.t, row);
            p.characters[row.character] = (p.characters[row.character] || 0) + 1;
        }
    }
    return [...players.values()]
        .filter(p => p.t.games >= MIN_GAMES)
        .map(p => {
            const score = (p.t.place + PRIOR_GAMES * 0.5) / (p.t.games + PRIOR_GAMES) * 100;
            const most = Object.entries(p.characters).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
            return { uuid: p.uuid, score, mmr: Math.round(score / 50 * MMR_AVERAGE), mostCharacter: Number(most[0]), ...summarize(p.t) };
        })
        .sort((a, b) => b.score - a.score || b.games - a.games)
        .map(({ score, ...p }) => p);
}

// uuid 들 → { uuid: 닉네임 } (실패한 uuid 는 빠짐)
async function resolveNicknames(uuids) {
    const names = {};
    let next = 0;
    await Promise.all(Array.from({ length: NICKNAME_CONCURRENCY }, async () => {
        while (next < uuids.length) {
            const uuid = uuids[next++];
            try {
                const profile = await getProfileByUUID(uuid);
                if (profile?.name) names[uuid] = profile.name;
            } catch (error) {
                console.warn(`⚠️ [빌드] UUID ${uuid} 닉네임 조회 실패: ${error.message}`);
            }
        }
    }));
    return names;
}

async function buildLeaderboard() {
    console.log("🚀 [빌드] 랭킹 데이터 계산 시작...");

    const records = readGameRecords();
    const players = rankPlayers(records);
    const everyone = [...new Set(records.flatMap(r => gameRows(r.content).map(row => row.uuid)))];
    console.log(`🔍 [빌드] 게임 ${records.length}판 · 유저 ${everyone.length}명 · 랭킹 자격 ${players.length}명`);

    const names = await resolveNicknames(everyone);
    const leaderboard = players.map(p => ({ uuid: p.uuid, nickname: names[p.uuid] || p.uuid, ...p }));

    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'leaderboard.json'), JSON.stringify(leaderboard));
    fs.writeFileSync(path.join(outDir, 'nicknames.json'), JSON.stringify(names));
    console.log(`✅ [빌드] leaderboard.json (${leaderboard.length}명) · nicknames.json (${Object.keys(names).length}/${everyone.length}명) 저장`);

    const prisma = getPrismaClientOrNull();
    if (prisma) {
        try {
            await prisma.leaderboardCache.upsert({
                where: { id: 'leaderboard' },
                update: { data: leaderboard, updatedAt: new Date() },
                create: { id: 'leaderboard', data: leaderboard }
            });
            console.log("✅ [빌드] 랭킹 DB 저장 완료.");
        } catch (error) {
            console.warn(`⚠️ [빌드] 랭킹 DB 저장 실패 (닉네임 폴백만 영향): ${error.message}`);
        }
    }
}

buildLeaderboard()
    .catch(error => console.error("❌ [빌드] 랭킹 계산 오류 (배포는 계속 진행):", error))
    .finally(() => process.exit(0));
