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
                    gameHistory.push(record); // record.content 대신 전체 record 객체 푸시
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

async function fetchAllGameRecords(forceRefresh = false) {
    // 1. 캐시 확인 (강제 새로고침이 아닌 경우)
    if (!forceRefresh) {
        const inMemoryCachedData = gameHistoryCache.get('allGameRecords');
        if (inMemoryCachedData) {
            console.log(`✅ [GitHub API] 인메모리 게임 기록 캐시 히트: ${inMemoryCachedData.length}개`);
            return inMemoryCachedData;
        }
    } else {
        console.log("🚀 [GitHub API] 모든 게임 기록 캐시 강제 새로고침 시작...");
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

    if (forceRefresh) {
        console.log("✅ [GitHub API] 모든 게임 기록 캐시 강제 새로고침 완료.");
    }

    return allParsedGameRecordsWithFileName;
}

async function refreshAllGameRecordsCache() {
    return fetchAllGameRecords(true);
}

// 캐릭터 설명 데이터 캐시
const characterDescriptionCache = new NodeCache({ stdTTL: 86400 }); // 24시간 캐시

// 캐릭터 목록 가져오기 (description 폴더 기반)
async function getCharacterList() {
    // 캐시 확인
    const cachedList = characterDescriptionCache.get('characterList');
    if (cachedList) {
        console.log(`✅ [GitHub API] 인메모리 캐릭터 목록 캐시 히트`);
        return cachedList;
    }

    const dirPath = `${baseDataPath}/description`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 캐릭터 목록 요청 URL: ${githubApiUrl}`);

    const directories = await retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            console.error(`❌ [GitHub API] 캐릭터 목록 응답 코드: ${response.status}`);
            throw new Error('캐릭터 목록을 가져올 수 없습니다.');
        }

        return response.json();
    });

    // char_XX 형식의 폴더에서 캐릭터 ID 추출 (1~899 범위만)
    const characterIds = directories
        .filter(item => item.type === 'dir' && item.name.startsWith('char_'))
        .map(item => parseInt(item.name.replace('char_', ''), 10))
        .filter(id => id >= 1 && id < 900)
        .sort((a, b) => a - b);

    // 캐시에 저장
    characterDescriptionCache.set('characterList', characterIds);

    return characterIds;
}

// 특정 캐릭터의 스킬 정보 가져오기
async function getCharacterInfo(characterId) {
    // 캐시 확인
    const cacheKey = `charInfo_${characterId}`;
    const cachedInfo = characterDescriptionCache.get(cacheKey);
    if (cachedInfo) {
        console.log(`✅ [GitHub API] 인메모리 캐릭터 정보 캐시 히트: ${characterId}`);
        return cachedInfo;
    }

    const dirPath = `${baseDataPath}/description/char_${characterId}`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 캐릭터 정보 요청 URL: ${githubApiUrl}`);

    const files = await retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`캐릭터 정보를 가져올 수 없습니다: ${response.status}`);
        }

        return response.json();
    });

    if (!files) {
        return null;
    }

    // 모든 YAML 파일 파싱
    const skills = {};
    const parsePromises = files
        .filter(file => file.name.endsWith('.yaml'))
        .map(async (file) => {
            const skillKey = file.name.replace('.yaml', '');
            const parsedData = await fetchAndParseYamlFile(file.download_url);
            if (parsedData) {
                skills[skillKey] = parsedData;
            }
        });

    await Promise.all(parsePromises);

    const charInfo = { characterId, skills };

    // 캐시에 저장
    characterDescriptionCache.set(cacheKey, charInfo);

    return charInfo;
}

// 무기 카테고리 목록 가져오기 (weapons 폴더의 하위 폴더명)
async function getWeaponCategories() {
    const cacheKey = 'weaponCategories';
    const cached = characterDescriptionCache.get(cacheKey);
    if (cached) {
        console.log(`✅ [GitHub API] 인메모리 무기 카테고리 캐시 히트`);
        return cached;
    }

    const dirPath = `${baseDataPath}/description/weapons`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;

    const directories = await retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`무기 카테고리를 가져올 수 없습니다: ${response.status}`);
        }

        return response.json();
    });

    if (!directories) return [];

    const categories = directories
        .filter(item => item.type === 'dir')
        .map(item => item.name);

    characterDescriptionCache.set(cacheKey, categories);
    return categories;
}

// 무기 목록 가져오기 (weapons 폴더 기반)
async function getWeaponList(weaponId) {
    const cacheKey = `weaponList_${weaponId}`;
    const cachedInfo = characterDescriptionCache.get(cacheKey);
    if (cachedInfo) {
        console.log(`✅ [GitHub API] 인메모리 무기 목록 캐시 히트: ${weaponId}`);
        return cachedInfo;
    }

    const dirPath = `${baseDataPath}/description/weapons/${weaponId}`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 무기 목록 요청 URL: ${githubApiUrl}`);

    const files = await retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error(`무기 목록을 가져올 수 없습니다: ${response.status}`);
        }

        return response.json();
    });

    if (!files) {
        return null;
    }

    const weapons = [];
    const parsePromises = files
        .filter(file => file.name.endsWith('.yaml'))
        .map(async (file) => {
            const parsedData = await fetchAndParseYamlFile(file.download_url);
            if (parsedData) {
                weapons.push(parsedData);
            }
        });

    await Promise.all(parsePromises);

    characterDescriptionCache.set(cacheKey, weapons);

    return weapons;
}

module.exports = { getBadgeData, getGameHistory, getAllGameHistoryFileMetadata, fetchAndParseYamlFile, fetchAllGameRecords, refreshAllGameRecordsCache, getCharacterList, getCharacterInfo, getWeaponCategories, getWeaponList };
