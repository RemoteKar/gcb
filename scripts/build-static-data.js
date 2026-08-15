// 빌드 시 Data/ 폴더를 읽어 클라이언트가 바로 fetch 할 수 있는 정적 JSON 생성
//   client/data/user-statistics/{uuid}.json  유저별 전적 + 게임 기록
//   client/data/recent-games.json            최근 60게임 (캐릭터 통계 페이지)
//   client/data/augment-stats.json           최근 60게임 증강 픽 통계
//   client/data/badges.json                  { uuid: { current, List } }
//   client/data/names.json                   { characters: {id: name}, augments: {id: name} }
//   client/data/character-stats.json         캐릭터별 기간(recent60/recent200/all) 통계 + 증강 시너지
//   client/data/augment-stats.json           증강별 기간 통계 { recent60: [...], recent200: [...], all: [...] }
//   client/data/home.json                    메인 페이지용 (최근 게임 요약 + 최근 60게임 1등 캐릭터)
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { computeStatistics } = require('../server/utils/statistics');
const { formatUUID, toNonHyphenatedUUID } = require('../server/util');
const { readGameRecords } = require('./read-game-records');
const { CREATIVE_ID_MAX_EXCLUSIVE, isOfficialCharacter } = require('../client/scripts/character-config');

const projectRoot = path.resolve(__dirname, '..');
const badgeDir = path.join(projectRoot, 'Data', 'player', 'badge');
const descriptionDir = path.join(projectRoot, 'Data', 'description');
const outputDir = path.join(projectRoot, 'client', 'data');
const userStatsDir = path.join(outputDir, 'user-statistics');
const RECENT_GAMES = 60;
const PERIODS = { recent60: 60, recent200: 200, all: Infinity };
const HOME_RECENT_GAMES = 8;

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
    totalGames: stats.totalGames.toString(),
    characterStats: stats.characterStats || [],
  };
}

function writeJson(relPath, data) {
  const fullPath = path.join(outputDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data));
}

function indexRecordsByPlayer(records) {
  const byPlayer = new Map();
  for (const record of records) {
    const joinedPlayers = record.content?.Game?.joinedPlayers;
    if (!joinedPlayers) continue;
    for (const rawUuid of joinedPlayers.split(',')) {
      const uuid = formatUUID(toNonHyphenatedUUID(rawUuid.trim()));
      if (!uuid) continue;
      if (!byPlayer.has(uuid)) byPlayer.set(uuid, []);
      byPlayer.get(uuid).push(record);
    }
  }
  return byPlayer;
}

function buildBadges() {
  if (!fs.existsSync(badgeDir)) return {};
  const badges = {};
  for (const fileName of fs.readdirSync(badgeDir)) {
    if (!fileName.endsWith('.yaml')) continue;
    try {
      const data = yaml.load(fs.readFileSync(path.join(badgeDir, fileName), 'utf8'));
      const badge = data?.badge || data;
      if (badge && badge.current) badges[fileName.replace('.yaml', '')] = badge;
    } catch (e) {
      console.warn(`[빌드] 배지 파싱 실패: ${fileName} (${e.message})`);
    }
  }
  return badges;
}

function loadYaml(filePath) {
  try { return yaml.load(fs.readFileSync(filePath, 'utf8')); } catch (e) { return null; }
}

// Data/description → { characters: {id: name}, augments: {id: name} }
function buildNames() {
  const characters = {};
  const augments = {};
  if (!fs.existsSync(descriptionDir)) return { characters, augments };
  for (const dir of fs.readdirSync(descriptionDir)) {
    if (!dir.startsWith('char_')) continue;
    const stat = loadYaml(path.join(descriptionDir, dir, 'stat.yaml'));
    if (stat?.name) characters[dir.replace('char_', '')] = String(stat.name);
  }
  const augDir = path.join(descriptionDir, 'augments');
  if (fs.existsSync(augDir)) {
    for (const file of fs.readdirSync(augDir)) {
      if (!file.endsWith('.yaml')) continue;
      const aug = loadYaml(path.join(augDir, file));
      if (aug?.id != null && aug.name) augments[aug.id] = String(aug.name);
    }
  }
  return { characters, augments };
}

const isStatCharacter = id => Number(id) > 0 && Number(id) < CREATIVE_ID_MAX_EXCLUSIVE && isOfficialCharacter(id);
const rate = (n, d) => d > 0 ? Number(((n / d) * 100).toFixed(1)) : 0;
const avg = (n, d) => d > 0 ? Number((n / d).toFixed(1)) : 0;

// 한 기간의 게임 기록 → 캐릭터별/증강별 원시 집계
function aggregatePeriod(records) {
  const characters = {};
  const augments = {};
  let slots = 0; // 전체 플레이어 참가 수 (픽률 분모)
  const bump = (obj, key) => obj[key] || (obj[key] = { picks: 0, wins: 0, top50: 0, kills: 0, damage: 0, augments: {} });
  for (const { content } of records) {
    const players = content?.Player;
    const total = content?.Game?.amountOfPlayers;
    if (!players || !total) continue;
    slots += Object.keys(players).length;
    for (const p of Object.values(players)) {
      const win = p.outCuase === '우승';
      const top50 = typeof p.Ranking === 'number' && p.Ranking / total <= 0.5;
      const kills = typeof p.kill === 'number' ? p.kill : 0;
      const dmg = typeof p.Damage?.Dealt === 'number' ? p.Damage.Dealt : 0;
      const augIds = Object.values(p.Augment || {}).filter(a => typeof a === 'number');

      for (const a of augIds) {
        const s = bump(augments, a);
        s.picks++; if (win) s.wins++; if (top50) s.top50++;
      }
      if (!isStatCharacter(p.Character)) continue;
      const c = bump(characters, p.Character);
      c.picks++; if (win) c.wins++; if (top50) c.top50++; c.kills += kills; c.damage += dmg;
      for (const a of augIds) {
        const s = c.augments[a] || (c.augments[a] = { picks: 0, wins: 0 });
        s.picks++; if (win) s.wins++;
      }
    }
  }
  return { characters, augments, slots };
}

function finalizeStats(records) {
  const characterStats = {};
  const augmentStats = {};
  for (const [period, size] of Object.entries(PERIODS)) {
    const slice = size === Infinity ? records : records.slice(-size);
    const { characters, augments, slots } = aggregatePeriod(slice);
    for (const [id, c] of Object.entries(characters)) {
      characterStats[id] = characterStats[id] || {};
      characterStats[id][period] = {
        picks: c.picks, wins: c.wins,
        pickRate: rate(c.picks, slots), // 전체 참가자 중 이 캐릭터를 고른 비율
        winRate: rate(c.wins, c.picks), top50Rate: rate(c.top50, c.picks),
        avgKills: avg(c.kills, c.picks), avgDamage: Math.round(c.damage / c.picks),
        augments: Object.entries(c.augments)
          .map(([aid, s]) => ({ augmentId: Number(aid), picks: s.picks, winRate: rate(s.wins, s.picks) }))
          .sort((a, b) => b.picks - a.picks),
      };
    }
    augmentStats[period] = Object.entries(augments)
      .map(([aid, s]) => ({ augmentId: Number(aid), picks: s.picks, winRate: rate(s.wins, s.picks), top50Rate: rate(s.top50, s.picks) }))
      .sort((a, b) => b.picks - a.picks);
  }
  return { characterStats: { periods: Object.keys(PERIODS), games: records.length, characters: characterStats }, augmentStats };
}

// 메인 페이지: 최근 게임 요약 + 최근 60게임 1등 캐릭터
function buildHome(records, characterStats) {
  const recentGames = records.slice(-HOME_RECENT_GAMES).reverse().map(({ fileName, content }) => {
    const players = content?.Player || {};
    const winner = Object.entries(players).find(([, p]) => p.outCuase === '우승' || p.Ranking === 1);
    return {
      fileName,
      players: content?.Game?.amountOfPlayers ?? Object.keys(players).length,
      winner: winner ? { uuid: winner[0], character: winner[1].Character ?? null, kills: winner[1].kill ?? 0 } : null,
    };
  });
  const top = Object.entries(characterStats.characters)
    .map(([id, s]) => ({ characterId: Number(id), ...(s.recent60 || {}) }))
    .filter(s => s.picks)
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
  return { recentGames, topCharacters: top.slice(0, 5), totalGames: records.length };
}

function main() {
  console.log('[빌드] 정적 데이터 생성 시작...');
  fs.rmSync(userStatsDir, { recursive: true, force: true }); // 다른 스크립트 산출물(leaderboard/patchnotes)은 건드리지 않음

  const records = readGameRecords();

  const byPlayer = indexRecordsByPlayer(records);
  for (const [uuid, gameRecords] of byPlayer.entries()) {
    const statistics = computeStatistics(gameRecords.map(r => r.content), uuid);
    writeJson(path.join('user-statistics', `${uuid}.json`), {
      statistics: formatStatistics(statistics),
      gameRecords,
    });
  }

  const recent = records.slice(-RECENT_GAMES);
  writeJson('recent-games.json', { gameRecords: recent });

  const badges = buildBadges();
  writeJson('badges.json', badges);

  writeJson('names.json', buildNames());
  const { characterStats, augmentStats } = finalizeStats(records);
  writeJson('character-stats.json', characterStats);
  writeJson('augment-stats.json', augmentStats);
  writeJson('home.json', buildHome(records, characterStats));

  console.log(`[빌드] 정적 데이터 생성 완료: ${byPlayer.size}명, ${records.length}경기, 배지 ${Object.keys(badges).length}개`);
}

main();
