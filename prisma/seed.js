const { PrismaClient } = require('@prisma/client/edge');
const { withAccelerate } = require('@prisma/extension-accelerate');
const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { formatUUID, toNonHyphenatedUUID } = require('../server/util'); // util.js 경로 수정

const prisma = new PrismaClient().$extends(withAccelerate());

const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN;
const baseDataPath = 'Data';

async function retryOperation(operation, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await operation();
            if (result === null) {
                return null;
            }
            return result;
        } catch (error) {
            if (i < retries - 1) {
                console.warn(`⚠️ [Seed] 재시도 (${i + 1}/${retries}): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}

async function getAllGameHistoryFileMetadata() {
    const dirPath = `${baseDataPath}/gameHistory`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;
    console.log(`🔍 [Seed] 모든 게임 기록 파일 메타데이터 요청 URL: ${githubApiUrl}`);

    return retryOperation(async () => {
        const dirResponse = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!dirResponse.ok) {
            console.error(`❌ [Seed] 모든 게임 기록 파일 메타데이터 응답 코드: ${dirResponse.status}`);
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
            console.error(`❌ [Seed] 파일 다운로드 실패: ${response.status}`);
            throw new Error(`파일 다운로드 실패: ${response.status}`);
        }
        const text = await response.text();
        return yaml.load(text);
    });
}

async function seedDatabase() {
    console.log('🚀 [Seed] 데이터베이스 시딩 시작...');
    try {
        // 1. 기존 게임 기록 삭제
        await prisma.gameRecord.deleteMany({});
        console.log(`[Seed] 기존 게임 기록 삭제 완료.`);

        // 2. GitHub에서 모든 게임 기록 가져오기
        const filesMetadata = await getAllGameHistoryFileMetadata();
        console.log(`[Seed] GitHub에서 가져온 파일 메타데이터 수: ${filesMetadata.length}`);

        const allGameRecordsPromises = filesMetadata.map(async (file) => {
            const parsedData = await fetchAndParseYamlFile(file.download_url);
            return { fileName: file.name, content: parsedData };
        });

        const allParsedGameRecordsWithFileName = (await Promise.all(allGameRecordsPromises)).filter(record => record.content !== null);
        console.log(`[Seed] 성공적으로 파싱된 게임 기록 수: ${allParsedGameRecordsWithFileName.length}`);

        // 3. 게임 기록을 Prisma에 저장
        let successCount = 0;
        for (const record of allParsedGameRecordsWithFileName) {
            try {
                await prisma.gameRecord.upsert({
                    where: { fileName: record.fileName },
                    update: {
                        content: record.content,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 365)) // 1년 캐시
                    },
                    create: {
                        fileName: record.fileName,
                        content: record.content,
                        cachedAt: new Date(),
                        expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24 * 365)) // 1년 캐시
                    }
                });
                successCount++;
            } catch (innerError) {
                console.error(`❌ [Seed] Prisma에 게임 기록 저장 실패: ${record.fileName}`, innerError);
            }
        }
        console.log(`✅ [Seed] Prisma에 ${successCount}/${allParsedGameRecordsWithFileName.length}개 게임 기록 저장 완료.`);

        // 4. 유저별 게임 기록 캐시 (UserGameHistoryCache) 업데이트 (선택 사항: 필요하다면 여기에 추가)
        // 이 부분은 API 요청 시점에 처리하는 것이 더 효율적일 수 있습니다.
        // 현재는 랭킹 계산을 위해 모든 기록을 가져왔으므로, 유저별 캐시도 여기서 업데이트할 수 있습니다.
        const userGameHistoryMap = new Map();
        allParsedGameRecordsWithFileName.forEach(record => {
            if (record.content && record.content.Game && record.content.Game.joinedPlayers) {
                const players = record.content.Game.joinedPlayers.split(',').map(s => toNonHyphenatedUUID(s.trim()));
                players.forEach(playerUUID => {
                    if (!userGameHistoryMap.has(playerUUID)) {
                        userGameHistoryMap.set(playerUUID, []);
                    }
                    userGameHistoryMap.get(playerUUID).push(record.content);
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
        console.log(`✅ [Seed] Prisma에 ${userGameHistoryMap.size}개 유저 게임 기록 캐시 저장 완료.`);


        // 5. 배지 데이터 캐싱 (필요하다면 여기에 추가)
        // 현재 getBadgeData는 요청 시점에 GitHub에서 가져오므로, 시딩 시점에 모든 배지를 가져올 필요는 없습니다.
        // 만약 모든 유저의 배지를 미리 캐싱하고 싶다면 여기에 로직을 추가합니다.

        console.log('✅ [Seed] 데이터베이스 시딩 완료.');
    } catch (error) {
        console.error('❌ [Seed] 데이터베이스 시딩 중 오류 발생:', error);
        process.exit(1); // 오류 발생 시 프로세스 종료
    } finally {
        await prisma.$disconnect();
    }
}

seedDatabase();
