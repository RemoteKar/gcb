const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { formatUUID, toNonHyphenatedUUID } = require('../util');
const NodeCache = require('node-cache');

const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN;
const baseDataPath = 'Data';
const MAX_RECORDS = 400;

const badgeCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시 (초 단위)
const gameHistoryCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시 (초 단위)

// 재시도 로직을 위한 헬퍼 함수
async function retryOperation(operation, retries = 5, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
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
    const cachedData = badgeCache.get(formattedUUID);
    if (cachedData) {
        console.log(`✅ [GitHub API] 배지 데이터 캐시 히트: ${formattedUUID}`);
        return cachedData;
    }

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
                throw new Error('배지 데이터를 찾을 수 없습니다.');
            }
            throw new Error(`GitHub API 오류: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.content) {
            throw new Error('배지 데이터가 없습니다.');
        }

        const buff = Buffer.from(data.content, 'base64');
        const fileContents = buff.toString('utf8');
        const badgeData = yaml.load(fileContents);
        return badgeData.badge || badgeData;
    });

    badgeCache.set(formattedUUID, data); // 캐시에 저장
    return data;
}

async function getGameHistory(formattedUUID) {
    const allParsedGameRecords = await fetchAllGameRecords(); // 모든 게임 기록을 캐시에서 가져오거나 새로 가져옴

    const gameHistory = [];
    allParsedGameRecords.forEach(parsedData => {
        if (parsedData && parsedData.Game && parsedData.Game.joinedPlayers) {
            const players = parsedData.Game.joinedPlayers.split(',').map(s => toNonHyphenatedUUID(s.trim()));
            if (players.includes(toNonHyphenatedUUID(formattedUUID))) {
                gameHistory.push(parsedData);
            }
        }
    });

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
    const cachedRecords = gameHistoryCache.get('allGameRecords');
    if (cachedRecords) {
        console.log(`✅ [GitHub API] 모든 게임 기록 캐시 히트`);
        return cachedRecords;
    }

    const filesMetadata = await getAllGameHistoryFileMetadata();
    const allGameRecordsPromises = filesMetadata.map(file => fetchAndParseYamlFile(file.download_url));
    const allParsedGameRecords = (await Promise.all(allGameRecordsPromises)).filter(record => record !== null);
    
    gameHistoryCache.set('allGameRecords', allParsedGameRecords); // 캐시에 저장
    return allParsedGameRecords;
}

module.exports = { getBadgeData, getGameHistory, getAllGameHistoryFileMetadata, fetchAndParseYamlFile, fetchAllGameRecords };