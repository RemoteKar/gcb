const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { formatUUID, toNonHyphenatedUUID } = require('../util');
const NodeCache = require('node-cache');

const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN;
const baseDataPath = 'Data';

const badgeCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시 (초 단위)
const gameHistoryCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시 (초 단위)

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

    // 2. GitHub API에서 조회
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

    // 3. 인메모리 캐시에 저장 (데이터가 유효할 때만)
    if (data !== null) {
        badgeCache.set(formattedUUID, data);
    }

    return data;
}

async function getGameHistory(formattedUUID) {
    // 1. 인메모리 캐시에서 유저별 게임 기록 조회
    const inMemoryCachedData = gameHistoryCache.get(formattedUUID);
    if (inMemoryCachedData) {
        console.log(`✅ [GitHub API] 인메모리 유저 게임 기록 캐시 히트: ${formattedUUID}`);
        return inMemoryCachedData;
    }

    // 2. GitHub API에서 모든 게임 기록을 가져와 필터링
    const allParsedGameRecordsWithFileName = await fetchAllGameRecords();

    const gameHistory = [];
    allParsedGameRecordsWithFileName.forEach(record => {
        if (record.content && record.content.Game && record.content.Game.joinedPlayers) {
            const players = record.content.Game.joinedPlayers.split(',').map(s => toNonHyphenatedUUID(s.trim()));
            if (players.includes(toNonHyphenatedUUID(formattedUUID))) {
                gameHistory.push(record.content);
            }
        }
    });

    // 3. 인메모리 캐시에 저장 (새로 계산된 경우)
    if (gameHistory.length > 0) {
        gameHistoryCache.set(formattedUUID, gameHistory);
        console.log(`✅ [GitHub API] 인메모리에 유저 게임 기록 저장: ${formattedUUID}`);
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
    // 1. 인메모리 캐시에서 조회
    const inMemoryCachedData = gameHistoryCache.get('allGameRecords');
    if (inMemoryCachedData) {
        console.log(`✅ [GitHub API] 인메모리 게임 기록 캐시 히트: ${inMemoryCachedData.length}개`);
        return inMemoryCachedData;
    }

    // 2. GitHub API에서 모든 게임 기록 가져오기
    const filesMetadata = await getAllGameHistoryFileMetadata();
    console.log(`[DEBUG] GitHub에서 가져온 파일 메타데이터 수: ${filesMetadata.length}`);

    const allGameRecordsPromises = filesMetadata.map(async (file) => {
        const parsedData = await fetchAndParseYamlFile(file.download_url);
        return { fileName: file.name, content: parsedData };
    });
    console.log(`[DEBUG] 파싱 시도할 게임 기록 수: ${allGameRecordsPromises.length}`);

    const allParsedGameRecordsWithFileName = (await Promise.all(allGameRecordsPromises)).filter(record => record.content !== null);
    console.log(`[DEBUG] 성공적으로 파싱된 게임 기록 수 (필터링 후): ${allParsedGameRecordsWithFileName.length}`);
    
    // 3. 인메모리 캐시에 저장
    gameHistoryCache.set('allGameRecords', allParsedGameRecordsWithFileName);

    return allParsedGameRecordsWithFileName;
}

async function refreshAllGameRecordsCache() {
    console.log("🚀 [GitHub API] 모든 게임 기록 캐시 강제 새로고침 시작...");
    try {
        // GitHub에서 모든 게임 기록 가져오기
        const filesMetadata = await getAllGameHistoryFileMetadata();
        console.log(`[DEBUG] GitHub에서 가져온 파일 메타데이터 수: ${filesMetadata.length}`);

        const allGameRecordsPromises = filesMetadata.map(async (file) => {
            const parsedData = await fetchAndParseYamlFile(file.download_url);
            return { fileName: file.name, content: parsedData };
        });
        console.log(`[DEBUG] 파싱 시도할 게임 기록 수: ${allGameRecordsPromises.length}`);

        const allParsedGameRecordsWithFileName = (await Promise.all(allGameRecordsPromises)).filter(record => record.content !== null);
        console.log(`[DEBUG] 성공적으로 파싱된 게임 기록 수 (필터링 후): ${allParsedGameRecordsWithFileName.length}`);
        
        // 인메모리 캐시 업데이트
        gameHistoryCache.set('allGameRecords', allParsedGameRecordsWithFileName);

        console.log("✅ [GitHub API] 모든 게임 기록 캐시 강제 새로고침 완료.");
        return allParsedGameRecordsWithFileName; // 새로고침된 전체 기록 반환

    } catch (error) {
        console.error("❌ [GitHub API] 모든 게임 기록 캐시 강제 새로고침 오류:", error);
        throw error; // 오류 전파
    }
}

module.exports = { getBadgeData, getGameHistory, getAllGameHistoryFileMetadata, fetchAndParseYamlFile, fetchAllGameRecords, refreshAllGameRecordsCache };
