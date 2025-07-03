const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { formatUUID, toNonHyphenatedUUID } = require('../util');
const NodeCache = require('node-cache');
const { PrismaClient } = require('@prisma/client/edge');

const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN;
const baseDataPath = 'Data';

const badgeCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시 (초 단위)

let prisma; // prisma 인스턴스를 전역으로 선언

try {
  const databaseUrl = process.env.DATABASE_URL;
  console.log(`[DEBUG] DATABASE_URL (processed) in github.js: ${databaseUrl ? '*****' : 'UNDEFINED'}`); // 민감 정보이므로 실제 값은 ***** 처리
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
  console.log("✅ [Prisma] PrismaClient (github.js) 초기화 성공.");
} catch (error) {
  console.error("❌ [Prisma] PrismaClient (github.js) 초기화 오류: 데이터베이스 연결 실패. 캐싱 기능 비활성화.", error);
  console.error(`[DEBUG] PrismaClientInitializationError (github.js) details: ${error.message}`);
  prisma = null; // 초기화 실패 시 prisma를 null로 설정
}

// 재시도 로직을 위한 헬퍼 함수
async function retryOperation(operation, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await operation();
            if (result === null) { // operation이 null을 반환하면 재시도하지 않고 즉시 반환
                return null;
            }
            return result;
        } catch (error) {
            if (i < retries - 1) {
                console.warn(`⚠️ [GitHub API] 재시도 (${i + 1}/${retries}): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // 마지막 재시도에서도 실패하면 에러 발생
            }
        }
    }
}

async function getBadgeData(formattedUUID) {
    // 1. 인메모리 캐시에서 조회
    const inMemoryCachedData = badgeCache.get(formattedUUID);
    if (inMemoryCachedData) {
        console.log(`✅ [GitHub API] 인메모리 배지 데이터 캐시 히트: ${formattedUUID}`);
        return inMemoryCachedData;
    }

    // 2. Prisma 캐시에서 조회 (Prisma가 유효할 경우)
    if (prisma) {
        try {
            const cachedBadge = await prisma.badgeData.findUnique({
                where: { uuid: formattedUUID },
            });

            if (cachedBadge && (!cachedBadge.expiresAt || cachedBadge.expiresAt > new Date())) {
                console.log(`✅ [GitHub API] Prisma 배지 데이터 캐시 히트: ${formattedUUID}`);
                badgeCache.set(formattedUUID, cachedBadge.badgeData); // 인메모리 캐시에도 저장
                return cachedBadge.badgeData;
            }
        } catch (error) {
            console.error(`❌ [GitHub API] Prisma 배지 데이터 캐시 조회 오류: ${error}`);
            // 오류 발생 시 캐시 사용 안 하고 다음 로직으로 진행
        }
    }

    // 3. GitHub API에서 조회
    const filePath = `${baseDataPath}/player/badge/${formattedUUID}.yaml`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 배지 데이터 요청 URL: ${githubApiUrl}`);

    const data = await retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            console.error(`❌ [GitHub API] 응답 코드: ${response.status}`);
            if (response.status === 404) {
                return null; // 배지 데이터를 찾을 수 없을 경우 null 반환
            }
            throw new Error(`GitHub API 오류: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.content) {
            return null; // 배지 데이터가 없을 경우 null 반환
        }

        const buff = Buffer.from(data.content, 'base64');
        const fileContents = buff.toString('utf8');
        const badgeData = yaml.load(fileContents);
        return badgeData.badge || badgeData;
    });

    // 4. 캐시에 저장
    if (data !== null) { // 데이터가 유효할 때만 캐시
        badgeCache.set(formattedUUID, data); // 인메모리 캐시에 저장

        if (prisma) { // prisma가 유효할 때만 Prisma 캐시 저장 로직 실행
            try {
                await prisma.badgeData.upsert({
                    where: { uuid: formattedUUID },
                    update: {
                        badgeData: data,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24)) // 24시간 캐시
                    },
                    create: {
                        uuid: formattedUUID,
                        badgeData: data,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24)) // 24시간 캐시
                    }
                });
                console.log(`✅ [GitHub API] Prisma에 배지 데이터 저장: ${formattedUUID}`);
            } catch (error) {
                console.error(`❌ [GitHub API] Prisma 배지 데이터 저장 오류: ${error}`);
                // 저장 실패해도 데이터는 반환
            }
        }
    }

    return data;
}

async function getGameHistory(formattedUUID) {
    if (!prisma) {
        console.warn("⚠️ [GitHub API] Prisma 클라이언트가 초기화되지 않아 게임 기록을 가져올 수 없습니다.");
        throw new Error("데이터베이스 연결 오류");
    }

    try {
        // 1. Prisma 캐시에서 유저별 게임 기록 조회
        const cachedUserHistory = await prisma.userGameHistoryCache.findUnique({
            where: { uuid: formattedUUID },
        });

        if (cachedUserHistory && (!cachedUserHistory.expiresAt || cachedUserHistory.expiresAt > new Date())) {
            console.log(`✅ [GitHub API] Prisma 유저 게임 기록 캐시 히트: ${formattedUUID}`);
            return cachedUserHistory.gameRecords;
        }

        // 2. Prisma의 GameRecord 테이블에서 모든 게임 기록을 가져와 필터링
        const allGameRecordsFromDb = await prisma.gameRecord.findMany();
        const gameHistory = [];

        allGameRecordsFromDb.forEach(record => {
            if (record.content && record.content.Game && record.content.Game.joinedPlayers) {
                const players = record.content.Game.joinedPlayers.split(',').map(s => toNonHyphenatedUUID(s.trim()));
                if (players.includes(toNonHyphenatedUUID(formattedUUID))) {
                    gameHistory.push(record.content);
                }
            }
        });

        // 3. 유저별 게임 기록을 Prisma에 저장 (새로 계산된 경우)
        if (gameHistory.length > 0) {
            await prisma.userGameHistoryCache.upsert({
                where: { uuid: formattedUUID },
                update: {
                    gameRecords: gameHistory,
                    cachedAt: new Date(),
                    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)) // 7일 캐시
                },
                create: {
                    uuid: formattedUUID,
                    gameRecords: gameHistory,
                    cachedAt: new Date(),
                    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)) // 7일 캐시
                }
            });
            console.log(`✅ [GitHub API] Prisma에 유저 게임 기록 저장: ${formattedUUID}`);
        }

        if (gameHistory.length === 0) {
            throw new Error('게임 기록을 찾을 수 없습니다.');
        }

        return gameHistory;
    } catch (error) {
        console.error(`❌ [GitHub API] getGameHistory 오류: ${error}`);
        throw error; // 오류 전파
    }
}

// fetchAllGameRecords 함수는 이제 seed.js에서만 사용되므로 제거하거나 간소화합니다.
// 여기서는 API에서 직접 사용되지 않으므로 제거합니다.

// refreshAllGameRecordsCache 함수도 seed.js에서만 사용되므로 제거합니다.

module.exports = { getBadgeData, getGameHistory };
