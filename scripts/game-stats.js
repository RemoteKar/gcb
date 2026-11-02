// 게임 기록 → 참가자 행 · 합계 (build-static-data / build-leaderboard 공용)
const { formatUUID, toNonHyphenatedUUID } = require('../server/util');
const { CREATIVE_ID_MAX_EXCLUSIVE, isCreativeCharacter } = require('../client/scripts/character-config');

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const uuidOf = raw => formatUUID(toNonHyphenatedUUID(String(raw).trim()));

// 정식 캐릭터(1~100): 캐릭터·랭킹 통계 / 유저 전적은 관리자(900+)만 뺀다
const isStatCharacter = id => Number(id) > 0 && Number(id) < CREATIVE_ID_MAX_EXCLUSIVE && !isCreativeCharacter(id);
const isUserCharacter = id => id != null && Number(id) < CREATIVE_ID_MAX_EXCLUSIVE;

// 판 하나 → 참가자 행. place = 그 판에서 이긴 사람 비율(1등 1, 꼴등 0, 순위 없음 = 공동 꼴찌)
function gameRows(content) {
    const { Game, Player } = content || {};
    if (!Game?.joinedPlayers || !Player) return [];
    const rows = Game.joinedPlayers.split(',').map(s => s.trim()).filter(u => Player[u]).map(u => {
        const p = Player[u];
        const killedBy = typeof p.killedBy === 'string' ? { [p.killedBy]: 1 } : (p.killedBy || {});
        return {
            uuid: uuidOf(u),
            character: p.Character ?? null,
            core: p.Core || null,
            augments: [1, 2, 3, 4].map(i => (typeof p.Augment?.[i] === 'number' ? p.Augment[i] : null)),
            dealt: num(p.Damage?.Dealt),
            taken: num(p.Damage?.Taken),
            heal: num(p.Heal?.Taken),
            kills: num(p.kill),
            deaths: num(p.death),
            rank: typeof p.Ranking === 'number' ? p.Ranking : null,
            quit: p.quit === true,
            killedBy: Object.fromEntries(Object.entries(killedBy).map(([k, n]) => [uuidOf(k), Number(n) || 0])),
        };
    });
    const total = Number(Game.amountOfPlayers) || rows.length;
    const order = r => r.rank ?? Infinity;
    for (const a of rows) {
        const beaten = rows.filter(b => order(b) > order(a)).length + (rows.filter(b => order(b) === order(a)).length - 1) / 2;
        a.place = rows.length > 1 ? beaten / (rows.length - 1) : 0.5;
        a.players = total;
        a.win = a.rank === 1;
        a.top50 = a.rank != null && a.rank / total <= 0.5;
    }
    return rows;
}

// 순위 구간: 0 = 1등, 1~4 = 상위 25/50/75/100%
const rankTier = row => (row.win ? 0 : row.rank == null ? 4 : Math.min(4, Math.max(1, Math.ceil(row.rank / row.players * 4))));

const totals = () => ({ games: 0, wins: 0, top50: 0, place: 0, rank: 0, ranked: 0, kills: 0, deaths: 0, dealt: 0, taken: 0, heal: 0, maxKills: 0, maxDealt: 0, maxTaken: 0 });

function add(t, row) {
    t.games++;
    if (row.win) t.wins++;
    if (row.top50) t.top50++;
    t.place += row.place;
    if (row.rank != null) { t.rank += row.rank; t.ranked++; }
    t.kills += row.kills;
    t.deaths += row.deaths;
    t.dealt += row.dealt;
    t.taken += row.taken;
    t.heal += row.heal;
    t.maxKills = Math.max(t.maxKills, row.kills);
    t.maxDealt = Math.max(t.maxDealt, row.dealt);
    t.maxTaken = Math.max(t.maxTaken, row.taken);
    return t;
}

const rate = (n, d) => (d > 0 ? Math.round(n / d * 1000) / 10 : 0);
const avg = (n, d, digits = 1) => (d > 0 ? Number((n / d).toFixed(digits)) : 0);

// 합계 → 표시용 평균 (%·평균은 소수 1자리, 피해·회복은 정수)
function summarize(t) {
    return {
        games: t.games,
        wins: t.wins,
        winRate: rate(t.wins, t.games),
        top50Rate: rate(t.top50, t.games),
        avgPlace: rate(t.place, t.games),
        avgRank: avg(t.rank, t.ranked),
        avgKills: avg(t.kills, t.games),
        avgDeaths: avg(t.deaths, t.games),
        avgDamage: Math.round(avg(t.dealt, t.games, 0)),
        avgTaken: Math.round(avg(t.taken, t.games, 0)),
        avgHeal: Math.round(avg(t.heal, t.games, 0)),
    };
}

module.exports = { gameRows, rankTier, totals, add, summarize, rate, isStatCharacter, isUserCharacter };
