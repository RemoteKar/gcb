const fetch = require('node-fetch');
const yaml = require('js-yaml');
const { isOfficialCharacter } = require('../../client/scripts/character-config');
const NodeCache = require('node-cache');

const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN;
const baseDataPath = 'Data';

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

// 캐릭터 설명 데이터 캐시
const characterDescriptionCache = new NodeCache({ stdTTL: 3600 }); // 1시간 캐시

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

    // char_XX 형식의 폴더에서 캐릭터 ID 추출 (정식 캐릭터만, 창작 캐릭터 제외)
    const characterIds = directories
        .filter(item => item.type === 'dir' && item.name.startsWith('char_'))
        .map(item => parseInt(item.name.replace('char_', ''), 10))
        .filter(id => id >= 1 && isOfficialCharacter(id))
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

// 스킬 링크 매핑 가져오기 (skillId → 이동 경로)
// 각 데이터 소스 폴더를 스캔하여 { skillId: path } 매핑을 생성
async function getSkillLinks() {
    const cacheKey = 'skillLinks';
    const cached = characterDescriptionCache.get(cacheKey);
    if (cached) {
        console.log(`✅ [GitHub API] 인메모리 스킬 링크 캐시 히트`);
        return cached;
    }

    const skillLinks = {};

    // weapons 폴더 스캔 → /weapon/{id} 경로로 매핑
    const weaponsDirPath = `${baseDataPath}/description/weapons`;
    const weaponsDirs = await retryOperation(async () => {
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${weaponsDirPath}?ref=${branch}`,
            { headers: { 'Authorization': `token ${githubToken}`, 'User-Agent': 'Your App Name' } }
        );
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`weapons 폴더를 가져올 수 없습니다: ${response.status}`);
        }
        return response.json();
    });

    if (weaponsDirs) {
        weaponsDirs
            .filter(item => item.type === 'dir')
            .forEach(item => { skillLinks[item.name] = `/weapon/${item.name}`; });
    }

    // titan 폴더 스캔 → /titan/잭4 경로로 매핑
    const titanDirPath = `${baseDataPath}/description/titan`;
    const titanContents = await retryOperation(async () => {
        const response = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${titanDirPath}?ref=${branch}`,
            { headers: { 'Authorization': `token ${githubToken}`, 'User-Agent': 'Your App Name' } }
        );
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`titan 폴더를 가져올 수 없습니다: ${response.status}`);
        }
        return response.json();
    });

    if (titanContents) {
        const titanSubfolders = titanContents.filter(item => item.type === 'dir');
        if (titanSubfolders.length > 0) {
            skillLinks['잭4'] = '/titan/잭4';
        }
    }

    characterDescriptionCache.set(cacheKey, skillLinks);
    return skillLinks;
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

// GitHub API 폴더 내용 가져오기 헬퍼
async function fetchGithubDir(dirPath) {
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;
    return retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: { 'Authorization': `token ${githubToken}`, 'User-Agent': 'Your App Name' }
        });
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`GitHub 폴더 조회 실패: ${response.status}`);
        }
        return response.json();
    });
}

// 타이탄 목록 가져오기
async function getTitanList() {
    const cacheKey = 'titanList';
    const cached = characterDescriptionCache.get(cacheKey);
    if (cached) {
        console.log(`✅ [GitHub API] 인메모리 타이탄 목록 캐시 히트`);
        return cached;
    }

    const dirPath = `${baseDataPath}/description/titan`;
    const contents = await fetchGithubDir(dirPath);
    if (!contents) return null;

    const subfolders = contents.filter(item => item.type === 'dir');
    const titans = [];

    // 각 서브폴더에서 설명 파일(index 정렬 offset 0) 가져오기
    const promises = subfolders.map(async (folder) => {
        const folderContents = await fetchGithubDir(`${dirPath}/${folder.name}`);
        if (!folderContents) return;

        const yamlFiles = folderContents.filter(f => f.name.endsWith('.yaml'));
        const parsedFiles = await Promise.all(
            yamlFiles.map(async (f) => {
                const data = await fetchAndParseYamlFile(f.download_url);
                return data;
            })
        );

        const validFiles = parsedFiles.filter(f => f && f.index !== undefined);
        validFiles.sort((a, b) => a.index - b.index);

        if (validFiles.length > 0) {
            const descFile = validFiles[0]; // offset 0 = 타이탄 설명
            titans.push({
                folderName: folder.name,
                name: descFile.name || folder.name,
                description: descFile.description || ''
            });
        }
    });

    await Promise.all(promises);
    titans.sort((a, b) => a.folderName.localeCompare(b.folderName));

    // 루트 파일에서 스마트 피스톨 데이터 가져오기
    let smartPistol = null;
    const smartPistolFile = contents.find(f => f.name === 'smartpistol.yaml');
    if (smartPistolFile) {
        smartPistol = await fetchAndParseYamlFile(smartPistolFile.download_url);
    }

    const result = { titans, smartPistol };
    characterDescriptionCache.set(cacheKey, result);
    return result;
}

// 특정 타이탄 상세 정보 가져오기
async function getTitanInfo(titanName) {
    const cacheKey = `titanInfo_${titanName}`;
    const cached = characterDescriptionCache.get(cacheKey);
    if (cached) {
        console.log(`✅ [GitHub API] 인메모리 타이탄 정보 캐시 히트: ${titanName}`);
        return cached;
    }

    const dirPath = `${baseDataPath}/description/titan`;

    // 타이탄 폴더 파일 + 공용 패시브 동시 로드
    const [folderContents, passiveData] = await Promise.all([
        fetchGithubDir(`${dirPath}/${titanName}`),
        (async () => {
            const rootContents = await fetchGithubDir(dirPath);
            if (!rootContents) return null;
            const passiveFile = rootContents.find(f => f.name === '잭0-2.yaml');
            if (!passiveFile) return null;
            return fetchAndParseYamlFile(passiveFile.download_url);
        })()
    ]);

    if (!folderContents) return null;

    const yamlFiles = folderContents.filter(f => f.name.endsWith('.yaml'));
    const parsedFiles = await Promise.all(
        yamlFiles.map(async (f) => {
            const data = await fetchAndParseYamlFile(f.download_url);
            return data;
        })
    );

    const validFiles = parsedFiles.filter(f => f && f.index !== undefined);
    validFiles.sort((a, b) => a.index - b.index);

    // offset 0=설명, 1-4=스킬, 5=무기
    const result = {
        titanName,
        description: validFiles[0] || null,
        skills: validFiles.slice(1, 5),
        weapon: validFiles[5] || null,
        passive: passiveData || null
    };

    characterDescriptionCache.set(cacheKey, result);
    return result;
}

// 증강 목록 가져오기
async function getAugmentList() {
    const cacheKey = 'augmentList';
    const cachedList = characterDescriptionCache.get(cacheKey);
    if (cachedList) {
        console.log(`✅ [GitHub API] 인메모리 증강 목록 캐시 히트`);
        return cachedList;
    }

    const dirPath = `${baseDataPath}/description/augments`;
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${dirPath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 증강 목록 요청 URL: ${githubApiUrl}`);

    const files = await retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            throw new Error(`증강 목록을 가져올 수 없습니다: ${response.status}`);
        }

        return response.json();
    });

    if (!files) {
        return [];
    }

    const augments = [];
    const parsePromises = files
        .filter(file => file.name.endsWith('.yaml'))
        .map(async (file) => {
            const parsedData = await fetchAndParseYamlFile(file.download_url);
            if (parsedData) {
                augments.push({
                    id: parsedData.id,
                    name: parsedData.name,
                    description: parsedData.description || ''
                });
            }
        });

    await Promise.all(parsePromises);

    // id 기준 정렬
    augments.sort((a, b) => a.id - b.id);

    characterDescriptionCache.set(cacheKey, augments);
    return augments;
}

// GitHub 라벨 자동 생성 (없으면 생성, 있으면 무시)
let labelsEnsured = false;
async function ensureFeedbackLabels() {
    if (labelsEnsured) return;
    const labelsToCreate = [
        { name: 'user-feedback', color: '0e8a16' },
        { name: 'bug', color: 'e74c3c' },
        { name: 'enhancement', color: '3498db' },
        { name: 'other', color: '555555' },
        { name: 'gcbc', color: '9b59b6' },
    ];
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/labels`;
    for (const label of labelsToCreate) {
        try {
            await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'User-Agent': 'Your App Name',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(label)
            });
        } catch (e) { /* 이미 존재하면 무시 */ }
    }
    labelsEnsured = true;
}

// GitHub Issue 생성 (건의/버그 제출)
async function createFeedbackIssue(title, body, labels) {
    await ensureFeedbackLabels();
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/issues`;

    return retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, body, labels })
        });

        if (!response.ok) {
            throw new Error(`GitHub Issue 생성 실패: ${response.status}`);
        }

        return response.json();
    });
}

// GitHub Issues 목록 조회 (제목 패턴으로 필터링)
async function getFeedbackIssues() {
    const cacheKey = 'feedbackIssues';
    const cached = characterDescriptionCache.get(cacheKey);
    if (cached) {
        console.log(`✅ [GitHub API] 인메모리 피드백 목록 캐시 히트`);
        return cached;
    }

    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/issues?state=open&per_page=50&sort=created&direction=desc`;

    const issues = await retryOperation(async () => {
        const response = await fetch(githubApiUrl, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub Issues 조회 실패: ${response.status}`);
        }

        return response.json();
    });

    // 제목이 [버그], [건의], [기타]로 시작하는 Issue만 필터
    const feedbackIssues = issues.filter(issue =>
        /^\[(버그|건의|기타|GCBC)\]/.test(issue.title)
    );

    const formatted = feedbackIssues.map(issue => {
        const titleMatch = issue.title.match(/^\[(버그|건의|기타|GCBC)\]/);
        let category = 'other';
        if (titleMatch) {
            if (titleMatch[1] === '버그') category = 'bug';
            else if (titleMatch[1] === '건의') category = 'enhancement';
            else if (titleMatch[1] === 'GCBC') category = 'gcbc';
        }

        // Issue body에서 작성자 추출
        const authorMatch = issue.body ? issue.body.match(/\*\*작성자\*\*: (.+?)(?:\n|$)/) : null;
        // 본문에서 실제 내용만 추출 (--- 구분선 이후)
        const contentMatch = issue.body ? issue.body.split('---\n\n') : [];
        const content = contentMatch.length > 1 ? contentMatch.slice(1).join('---\n\n').trim() : (issue.body || '');

        return {
            id: issue.number,
            title: issue.title.replace(/^\[(버그|건의|기타)\]\s*/, ''),
            body: content,
            category,
            author: authorMatch ? authorMatch[1].trim() : '익명',
            created_at: issue.created_at
        };
    });

    // 20초 캐시
    characterDescriptionCache.set(cacheKey, formatted, 20);
    return formatted;
}

function clearFeedbackCache() {
    characterDescriptionCache.del('feedbackIssues');
}

module.exports = { getCharacterList, getCharacterInfo, getSkillLinks, getWeaponList, getTitanList, getTitanInfo, getAugmentList, createFeedbackIssue, getFeedbackIssues, clearFeedbackCache };
