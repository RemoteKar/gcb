// 빌드 시 Data/ 를 읽어 클라이언트가 바로 fetch 하는 정적 JSON 을 client/data/ 에 만든다 (gitignore)
//   names.json                  { characters: {id: 이름}, augments: {id: 이름}, cores: {key: 이름} }
//   augments.json · cores.json  증강·코어 설명 (목록·팝업)
//   characters/{id}.json        스탯(정식 캐릭터 중 순위)·스킬 설명 + 기간별 실전 통계 + 성향 6축 + 많이 하는 유저
//   weapons/{id}.json · titans.json · titans/{id}.json   스킬에서 이어지는 무기·타이탄 설명
//   character-stats.json · augment-stats.json · core-stats.json   기간별(recent60/recent200/all) 통계 표
//   home.json · badges.json
//   games/{id}.json             게임 하나의 참가자 전체 (전적 상세)
//   user-statistics/{uuid}.json 유저 요약 · 플레이 성향 · 캐릭터별 · 상대 + 판별 한 줄
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { readGameRecords } = require('./read-game-records');
const { gameRows, rankTier, totals, add, summarize, rate, isStatCharacter, isUserCharacter } = require('./game-stats');

const root = path.resolve(__dirname, '..');
const descriptionDir = path.join(root, 'Data', 'description');
const playerDir = path.join(root, 'Data', 'player');
const resourceDir = path.join(root, 'client', 'Resource');
const outputDir = path.join(root, 'client', 'data');
const PERIODS = { recent60: 60, recent200: 200, all: Infinity };
const HOME_RECENT_GAMES = 8;
const STYLE_MIN_GAMES = 5;
const GENERATED = ['user-statistics', 'games', 'characters', 'weapons', 'titans', 'recent-games.json'];

function writeJson(rel, data) {
    const file = path.join(outputDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data));
}

const loadYaml = file => { try { return yaml.load(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
const dirsIn = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort() : []);
const text = v => String(v ?? '');
const entry = d => ({ id: d.id != null ? String(d.id) : null, name: text(d.name), description: text(d.description) });

// 폴더의 yaml → [{ key: 파일명, data }] (파일명 순)
function yamlsIn(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).sort()
        .map(f => ({ key: f.slice(0, -5), data: loadYaml(path.join(dir, f)) }))
        .filter(x => x.data);
}

// 이미지 확장자는 빌드 때 찾아 둔다 (브라우저가 확장자를 하나씩 404 내며 시도하지 않게)
function imagePath(relDir, id) {
    const ext = ['webp', 'png', 'jpg', 'jpeg', 'gif'].find(e => fs.existsSync(path.join(resourceDir, relDir, `${id}.${e}`)));
    return ext ? `/Resource/${relDir}/${id}.${ext}` : null;
}

const SKILL_SLOTS = [['0', '패시브'], ['baseattack', '기본 공격'], ['1', '스킬 1'], ['2', '스킬 2'], ['3', '스킬 3'], ['4', '궁극기']];

function readDescriptions() {
    const augments = yamlsIn(path.join(descriptionDir, 'augments')).map(x => x.data)
        .filter(a => a.id != null && a.name)
        .map(a => ({ id: Number(a.id), name: text(a.name), description: text(a.description) }))
        .sort((a, b) => a.id - b.id);
    const cores = yamlsIn(path.join(descriptionDir, 'cores')).map(x => x.data)
        .filter(c => c.id != null && c.name)
        .map(c => ({ id: String(c.id), index: Number(c.index) || 0, name: text(c.name), description: text(c.description) }))
        .sort((a, b) => a.index - b.index);

    const weaponDir = path.join(descriptionDir, 'weapons');
    const weapons = Object.fromEntries(dirsIn(weaponDir).map(dir => [dir,
        yamlsIn(path.join(weaponDir, dir)).map(x => ({ ...entry(x.data), img: imagePath(`weapon/${dir}`, x.data.id ?? x.key) }))]));

    // 타이탄 폴더 yaml 은 index 순으로 0 = 타이탄 설명, 1~4 = 스킬, 5 = 무기
    const titanDir = path.join(descriptionDir, 'titan');
    const titans = dirsIn(titanDir).map(dir => {
        const parts = yamlsIn(path.join(titanDir, dir)).map(x => x.data).filter(d => d.index !== undefined).sort((a, b) => a.index - b.index);
        if (!parts.length) return null;
        const weapon = parts[5] ? { ...entry(parts[5]), img: imagePath('titan/weapon', parts[5].id) } : null;
        return { ...entry(parts[0]), id: dir, img: imagePath('titan', dir), skills: parts.slice(1, 5).map(entry), weapon };
    }).filter(Boolean);
    const titanRoot = Object.fromEntries(yamlsIn(titanDir).map(x => [x.key, entry(x.data)]));

    // 스킬 id → 이어지는 페이지 (weapons 폴더 = /weapon/{id}, 타이탄이 있으면 잭4 = /titan/잭4)
    const links = Object.fromEntries(Object.keys(weapons).map(id => [id, `/weapon/${id}`]));
    if (titans.length) links['잭4'] = '/titan/잭4';

    const characters = dirsIn(descriptionDir).filter(d => /^char_\d+$/.test(d)).map(dir => {
        const files = Object.fromEntries(yamlsIn(path.join(descriptionDir, dir)).map(x => [x.key, x.data]));
        const { name, ...stat } = files.stat || {};
        if (!name) return null;
        const skills = SKILL_SLOTS.filter(([key]) => files[key]).map(([key, type]) => {
            const s = entry(files[key]);
            return { type, ...s, link: links[s.id] ? `${links[s.id]}?name=${encodeURIComponent(s.name)}` : null };
        });
        return { id: Number(dir.slice(5)), name: text(name), stat, skills };
    }).filter(Boolean).sort((a, b) => a.id - b.id);

    return { augments, cores, weapons, titans, smartPistol: titanRoot.smartpistol || null, titanPassive: titanRoot['잭0-2'] || null, characters };
}

function readBadges() {
    const badges = {};
    for (const { key, data } of yamlsIn(path.join(playerDir, 'badge'))) {
        const badge = data.badge || data;
        if (badge?.current) badges[key] = badge;
    }
    return badges;
}

// 캐릭터별 누적 우승 (황금 스킨 해금용 WinCount, 26.3 이전 포함) → { uuid: [{ id, wins }] }
function readLifetimeWins() {
    return Object.fromEntries(yamlsIn(path.join(playerDir, 'achieve')).map(({ key, data }) => [key,
        Object.entries(data.WinCount || {})
            .map(([k, n]) => ({ id: Number(String(k).replace('char', '')), wins: Number(n) || 0 }))
            .filter(w => w.id && w.wins)
            .sort((a, b) => b.wins - a.wins)]));
}

// 게임 기록 → [{ id(KST 시각), duration, rows }] 시간순. 참가자 없는 기록은 뺀다
function readGames() {
    const ids = new Set();
    return readGameRecords().map(r => {
        let id = r.time;
        for (let n = 2; ids.has(id); n++) id = `${r.time}_${n}`;
        ids.add(id);
        return { id, duration: Number(r.content?.Game?.totalTime) || 0, rows: gameRows(r.content) };
    }).filter(g => g.rows.length);
}

const bump = (map, key) => map[key] || (map[key] = totals());
const byGames = (a, b) => b[1].games - a[1].games || b[1].wins - a[1].wins;
const pick = (entries, n, idOf) => entries.sort(byGames).slice(0, n).map(([k, t]) => ({ id: idOf(k), games: t.games, winRate: rate(t.wins, t.games) }));
const round = row => ({ ...row, dealt: Math.round(row.dealt), taken: Math.round(row.taken), heal: Math.round(row.heal) });

// 기간 하나 → 캐릭터별 / 증강별 / 코어별 합계. 픽률 분모 = 기간 전체 참가자 수
function aggregate(games) {
    const characters = {};
    const augments = {};
    const cores = {};
    let slots = 0;
    for (const { rows } of games) {
        for (const row of rows) {
            slots++;
            for (const a of row.augments) if (a != null) add(bump(augments, a), row);
            if (row.core) add(bump(cores, row.core), row);
            if (!isStatCharacter(row.character)) continue;
            const c = characters[row.character] || (characters[row.character] = { t: totals(), augments: {}, cores: {}, tiers: [0, 0, 0, 0, 0] });
            add(c.t, row);
            c.tiers[rankTier(row)]++;
            for (const a of row.augments) if (a != null) add(bump(c.augments, a), row);
            if (row.core) add(bump(c.cores, row.core), row);
        }
    }
    const table = map => Object.entries(map).sort(byGames).map(([id, t]) => ({ id, ...summarize(t), pickRate: rate(t.games, slots) }));
    return { characters, slots, augmentTable: table(augments).map(r => ({ ...r, id: Number(r.id) })), coreTable: table(cores) };
}

// 캐릭터별 많이 하는 유저 (전체 기간, 2판 이상) → { characterId: [{ uuid, games, wins, winRate }] }
function mainsOf(games) {
    const byChar = {};
    for (const { rows } of games) {
        for (const row of rows) {
            if (!isStatCharacter(row.character)) continue;
            add(bump(byChar[row.character] || (byChar[row.character] = {}), row.uuid), row);
        }
    }
    return Object.fromEntries(Object.entries(byChar).map(([id, players]) => [id,
        Object.entries(players).filter(([, t]) => t.games >= 2).sort(byGames).slice(0, 5)
            .map(([uuid, t]) => ({ uuid, games: t.games, wins: t.wins, winRate: rate(t.wins, t.games) }))]));
}

// 유저별 합계 + 상대(천적·먹잇감·자주 만난 유저). 상대는 모든 판, 통계는 관리자 캐릭터(900+) 판만 뺀다
function aggregateUsers(games) {
    const users = new Map();
    for (const game of games) {
        for (const row of game.rows) {
            if (!users.has(row.uuid)) users.set(row.uuid, { t: totals(), games: [], characters: {}, augments: {}, cores: {}, nemesis: {}, prey: {}, mates: {} });
            const u = users.get(row.uuid);
            u.games.push({ game, row });
            for (const [killer, n] of Object.entries(row.killedBy)) {
                if (killer !== row.uuid && n) u.nemesis[killer] = (u.nemesis[killer] || 0) + n;
            }
            for (const other of game.rows) {
                if (other === row) continue;
                u.mates[other.uuid] = (u.mates[other.uuid] || 0) + 1;
                const n = other.killedBy[row.uuid];
                if (n) u.prey[other.uuid] = (u.prey[other.uuid] || 0) + n;
            }
            if (!isUserCharacter(row.character)) continue;
            add(u.t, row);
            add(bump(u.characters, row.character), row);
            for (const a of row.augments) if (a != null) add(bump(u.augments, a), row);
            if (row.core) add(bump(u.cores, row.core), row);
        }
    }
    return users;
}

// 플레이 성향 6축 = 판당 값의 백분위 (STYLE_MIN_GAMES 판 이상 한 유저 사이, 0~100, 높을수록 그 성향이 강함)
const STYLE_AXES = {
    dealt: t => t.dealt / t.games,
    kills: t => t.kills / t.games,
    place: t => t.place / t.games,
    survive: t => -t.deaths / t.games,
    heal: t => t.heal / t.games,
    taken: t => t.taken / t.games,
};

function styleScorer(users) {
    const pool = [...users.values()].filter(u => u.t.games >= STYLE_MIN_GAMES);
    const sorted = Object.fromEntries(Object.entries(STYLE_AXES).map(([k, f]) => [k, pool.map(u => f(u.t)).sort((a, b) => a - b)]));
    const percentile = (k, v) => {
        const s = sorted[k];
        if (s.length < 2) return 50;
        const below = s.filter(x => x < v).length;
        const same = s.filter(x => x === v).length;
        return Math.round((below + (same - 1) / 2) / (s.length - 1) * 100);
    };
    return u => (u.t.games >= STYLE_MIN_GAMES
        ? { of: pool.length, pct: Object.fromEntries(Object.entries(STYLE_AXES).map(([k, f]) => [k, percentile(k, f(u.t))])) }
        : null);
}

// 스탯별 순위 (값이 클수록 1위, 같은 값은 같은 순위, 정식 캐릭터 사이) → c => { 스탯: { rank, of, max } }
function statRanker(characters) {
    const pool = characters.filter(c => isStatCharacter(c.id));
    const sorted = {};
    for (const c of pool) {
        for (const [k, v] of Object.entries(c.stat)) if (typeof v === 'number') (sorted[k] || (sorted[k] = [])).push(v);
    }
    for (const list of Object.values(sorted)) list.sort((a, b) => b - a);
    return c => Object.fromEntries(Object.entries(c.stat).filter(([k, v]) => typeof v === 'number' && sorted[k])
        .map(([k, v]) => [k, { rank: sorted[k].filter(x => x > v).length + 1, of: sorted[k].length, max: sorted[k][0] }]));
}

function main() {
    console.log('[빌드] 정적 데이터 생성 시작...');
    for (const rel of GENERATED) fs.rmSync(path.join(outputDir, rel), { recursive: true, force: true }); // leaderboard·patchnotes 산출물은 남김

    const desc = readDescriptions();
    const names = {
        characters: Object.fromEntries(desc.characters.map(c => [c.id, c.name])),
        augments: Object.fromEntries(desc.augments.map(a => [a.id, a.name])),
        cores: Object.fromEntries(desc.cores.map(c => [c.id, c.name])),
    };
    writeJson('names.json', names);
    writeJson('augments.json', desc.augments);
    writeJson('cores.json', desc.cores);
    for (const [id, list] of Object.entries(desc.weapons)) writeJson(`weapons/${id}.json`, list);
    writeJson('titans.json', { titans: desc.titans.map(({ skills, weapon, ...t }) => t), smartPistol: desc.smartPistol });
    for (const t of desc.titans) writeJson(`titans/${t.id}.json`, { ...t, passive: desc.titanPassive });

    const games = readGames();
    const periods = Object.fromEntries(Object.entries(PERIODS).map(([p, n]) => [p, aggregate(n === Infinity ? games : games.slice(-n))]));
    const mains = mainsOf(games);

    const characterStats = {};
    for (const [p, agg] of Object.entries(periods)) {
        for (const [id, c] of Object.entries(agg.characters)) {
            (characterStats[id] || (characterStats[id] = {}))[p] = { ...summarize(c.t), pickRate: rate(c.t.games, agg.slots) };
        }
    }
    writeJson('character-stats.json', { games: games.length, characters: characterStats });
    writeJson('augment-stats.json', Object.fromEntries(Object.entries(periods).map(([p, agg]) => [p, agg.augmentTable])));
    writeJson('core-stats.json', Object.fromEntries(Object.entries(periods).map(([p, agg]) => [p, agg.coreTable])));

    const statRanksOf = statRanker(desc.characters);
    const characterStyleOf = styleScorer(new Map(Object.entries(periods.all.characters)));
    for (const c of desc.characters) {
        const live = Object.fromEntries(Object.entries(periods).map(([p, agg]) => {
            const s = agg.characters[c.id];
            return [p, s ? {
                ...characterStats[c.id][p],
                tiers: s.tiers,
                augments: pick(Object.entries(s.augments), 10, Number).map(a => ({ ...a, name: names.augments[a.id] || null })),
                cores: pick(Object.entries(s.cores), 5, String).map(a => ({ ...a, name: names.cores[a.id] || null })),
            } : null];
        }));
        const all = periods.all.characters[c.id];
        writeJson(`characters/${c.id}.json`, { ...c, statRanks: statRanksOf(c), style: all ? characterStyleOf(all) : null, live, mains: mains[c.id] || [] });
    }

    for (const g of games) {
        const rows = g.rows.slice().sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))
            .map(({ uuid, character, rank, kills, deaths, dealt, taken, heal, augments, core, quit }) => round({ uuid, character, rank, kills, deaths, dealt, taken, heal, augments, core, quit }));
        writeJson(`games/${g.id}.json`, { id: g.id, players: g.rows[0].players, duration: g.duration, rows });
    }

    const badges = readBadges();
    writeJson('badges.json', badges);
    const lifetimeWins = readLifetimeWins();

    const users = aggregateUsers(games);
    const styleOf = styleScorer(users);
    const top = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([uuid, count]) => ({ uuid, count }));
    for (const [uuid, u] of users) {
        const characters = Object.entries(u.characters).sort(byGames).map(([id, t]) => ({ id: Number(id), ...summarize(t) }));
        writeJson(`user-statistics/${uuid}.json`, {
            uuid,
            stats: { ...summarize(u.t), maxKills: u.t.maxKills, maxDealt: Math.round(u.t.maxDealt), maxTaken: Math.round(u.t.maxTaken), mostCharacter: characters[0]?.id ?? null },
            style: styleOf(u),
            characters,
            augments: pick(Object.entries(u.augments), 6, Number),
            cores: pick(Object.entries(u.cores), 4, String),
            people: { nemesis: top(u.nemesis, 3), prey: top(u.prey, 3), mates: top(u.mates, 3) },
            badge: badges[uuid] || null,
            lifetimeWins: lifetimeWins[uuid] || [],
            games: u.games.slice().reverse().map(({ game, row }) => round({
                id: game.id, players: row.players, duration: game.duration, character: row.character, rank: row.rank,
                kills: row.kills, deaths: row.deaths, dealt: row.dealt, taken: row.taken, heal: row.heal,
                augments: row.augments, core: row.core, quit: row.quit,
            })),
        });
    }

    const recent60 = periods.recent60.characters;
    writeJson('home.json', {
        totalGames: games.length,
        recentGames: games.slice(-HOME_RECENT_GAMES).reverse().map(g => {
            const w = g.rows.find(r => r.win);
            return { id: g.id, players: g.rows[0].players, duration: g.duration, winner: w ? { uuid: w.uuid, character: w.character, kills: w.kills, deaths: w.deaths } : null };
        }),
        topCharacters: Object.entries(recent60)
            .sort((a, b) => b[1].t.wins - a[1].t.wins || rate(b[1].t.wins, b[1].t.games) - rate(a[1].t.wins, a[1].t.games))
            .slice(0, 5).map(([id, c]) => ({ id: Number(id), games: c.t.games, wins: c.t.wins, winRate: rate(c.t.wins, c.t.games) })),
    });

    console.log(`[빌드] 정적 데이터 생성 완료: ${users.size}명, ${games.length}경기, 캐릭터 ${desc.characters.length}명, 배지 ${Object.keys(badges).length}개`);
}

main();
