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
const MAX_RECORDS = 400;

const badgeCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시 (초 단위)
const gameHistoryCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시 (초 단위)

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

async function getGameHistory(formattedUUID) {
    // 1. Prisma 캐시에서 유저별 게임 기록 조회
    if (prisma) {
        try {
            const cachedUserHistory = await prisma.userGameHistoryCache.findUnique({
                where: { uuid: formattedUUID },
            });

            if (cachedUserHistory && (!cachedUserHistory.expiresAt || cachedUserHistory.expiresAt > new Date())) {
                console.log(`✅ [GitHub API] Prisma 유저 게임 기록 캐시 히트: ${formattedUUID}`);
                return cachedUserHistory.gameRecords;
            }
        } catch (error) {
            console.error(`❌ [GitHub API] Prisma 유저 게임 기록 캐시 조회 오류: ${error}`);
            // 오류 발생 시 다음 로직으로 진행
        }
    }

    // 2. 전체 게임 기록을 가져와 필터링 (Prisma 또는 GitHub)
    const allParsedGameRecords = await fetchAllGameRecords(); // 이 함수는 이제 Prisma 캐시를 먼저 확인

    const gameHistory = [];
    allParsedGameRecords.forEach(parsedData => {
        if (parsedData && parsedData.Game && parsedData.Game.joinedPlayers) {
            const players = parsedData.Game.joinedPlayers.split(',').map(s => toNonHyphenatedUUID(s.trim()));
            if (players.includes(toNonHyphenatedUUID(formattedUUID))) {
                gameHistory.push(parsedData);
            }
        }
    });

    // 3. 유저별 게임 기록을 Prisma에 저장
    if (prisma && gameHistory.length > 0) {
        try {
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
        } catch (error) {
            console.error(`❌ [GitHub API] Prisma 유저 게임 기록 저장 오류: ${error}`);
        }
    }

    if (gameHistory.length === 0) {
        throw new Error('게임 기록을 찾을 수 없습니다.');
    }

    return gameHistory;
}

async function getAllGameHistoryFileMetadata() {
    const dirPath = `${baseDataPath}/gameHistory`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 모든 게임 기록 파일 메타데이터 요청 URL: ${githubApiUrl}`);

    return retryOperation(async () => {
        const dirResponse = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!dirResponse.ok) {
            console.error(`❌ [GitHub API] 모든 게임 기록 파일 메타데이터 응답 코드: ${dirResponse.status}`);
            throw new Error('게임 기록 폴더가 존재하지 않거나 접근할 수 없습니다.');
        }

        return dirResponse.json();
    });
}

async function fetchAndParseYamlFile(downloadUrl) {
    return retryOperation(async () => {
        const response = await fetch(downloadUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            console.error(`❌ [GitHub API] 파일 다운로드 실패: ${response.status}`);
            throw new Error(`파일 다운로드 실패: ${response.status}`);
        }
        const text = await response.text();
        return yaml.load(text);
    });
}

async function fetchAllGameRecords() {
    // 1. Prisma 캐시에서 모든 게임 기록 조회
    if (prisma) {
        try {
            const cachedRecords = await prisma.gameRecord.findMany();
            if (cachedRecords.length > 0) {
                console.log(`✅ [GitHub API] Prisma 게임 기록 캐시 히트: ${cachedRecords.length}개`);
                const parsedRecords = cachedRecords.map(record => record.content);
                gameHistoryCache.set('allGameRecords', parsedRecords); // 인메모리 캐시에도 저장
                return parsedRecords;
            }
        } catch (error) {
            console.error(`❌ [GitHub API] Prisma 게임 기록 캐시 조회 오류: ${error}`);
            // 오류 발생 시 다음 로직으로 진행
        }
    }

    // 2. GitHub API에서 모든 게임 기록 가져오기
    const filesMetadata = await getAllGameHistoryFileMetadata();
    const allGameRecordsPromises = filesMetadata.map(file => fetchAndParseYamlFile(file.download_url));
    const allParsedGameRecords = (await Promise.all(allGameRecordsPromises)).filter(record => record !== null);
    
    // 3. 가져온 기록을 Prisma 및 인메모리 캐시에 저장
    if (prisma) {
        try {
            const recordsToUpsert = allParsedGameRecords.map(record => ({
                fileName: record.fileName, // Assuming parsedData has fileName property
                content: record,
                cachedAt: new Date(),
                expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)) // 7일 캐시
            }));
            // 기존 레코드를 삭제하고 새로 삽입 (간단한 동기화 전략)
            await prisma.gameRecord.deleteMany({});
            await prisma.gameRecord.createMany({ data: recordsToUpsert });
            console.log(`✅ [GitHub API] Prisma에 ${recordsToUpsert.length}개 게임 기록 저장.`);
        } catch (error) {
            console.error(`❌ [GitHub API] Prisma 게임 기록 저장 오류: ${error}`);
        }
    }
    gameHistoryCache.set('allGameRecords', allParsedGameRecords); // 인메모리 캐시에 저장

    // 4. 유저별 게임 기록 캐시 (UserGameHistoryCache) 업데이트
    if (prisma) {
        try {
            const userGameHistoryMap = new Map();
            allParsedGameRecords.forEach(record => {
                if (record && record.Game && record.Game.joinedPlayers) {
                    const players = record.Game.joinedPlayers.split(',').map(s => toNonHyphenatedUUID(s.trim()));
                    players.forEach(playerUUID => {
                        if (!userGameHistoryMap.has(playerUUID)) {
                            userGameHistoryMap.set(playerUUID, []);
                        }
                        userGameHistoryMap.get(playerUUID).push(record);
                    });
                }
            });

            const userHistoryUpsertPromises = Array.from(userGameHistoryMap.entries()).map(([uuid, records]) =>
                prisma.userGameHistoryCache.upsert({
                    where: { uuid: uuid },
                    update: {
                        gameRecords: records,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)) // 7일 캐시
                    },
                    create: {
                        uuid: uuid,
                        gameRecords: records,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)) // 7일 캐시
                    }
                })
            );
            await Promise.all(userHistoryUpsertPromises);
            console.log(`✅ [GitHub API] Prisma에 ${userGameHistoryMap.size}개 유저 게임 기록 캐시 저장.`);
        } catch (error) {
            console.error(`❌ [GitHub API] Prisma 유저 게임 기록 캐시 저장 오류: ${error}`);
        }
    }

    return allParsedGameRecords;
}

module.exports = { getBadgeData, getGameHistory, getAllGameHistoryFileMetadata, fetchAndParseYamlFile, fetchAllGameRecords };