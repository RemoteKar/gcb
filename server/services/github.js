const fetch = require('node-fetch');
const yaml = require('js-yaml');

const repoOwner = process.env.GITHUB_REPO_OWNER;
const repoName = process.env.GITHUB_REPO_NAME;
const branch = process.env.GITHUB_BRANCH;
const githubToken = process.env.GITHUB_TOKEN;
const baseDataPath = '/Data';

const MAX_RECORDS = 400;

async function getBadgeData(formattedUUID) {
    const filePath = `${baseDataPath}/player/badge/${formattedUUID}.yaml`;
    const encodedFilePath = encodeURIComponent(filePath);
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodedFilePath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 배지 데이터 요청 URL: ${githubApiUrl}`);

    const response = await fetch(githubApiUrl, {
        headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'Your App Name'
        }
    });

    if (!response.ok) {
        console.error(`❌ [GitHub API] 응답 코드: ${response.status}`);
        throw new Error('배지 데이터를 찾을 수 없습니다.');
    }

    const data = await response.json();
    if (!data.content) {
        throw new Error('배지 데이터가 없습니다.');
    }

    const buff = Buffer.from(data.content, 'base64');
    const fileContents = buff.toString('utf8');
    const badgeData = yaml.load(fileContents);
    return badgeData.badge || badgeData;
}

async function getGameHistory(formattedUUID) {
    const dirPath = `${baseDataPath}/gameHistory`;
    const encodedDirPath = encodeURIComponent(dirPath);
    const githubApiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${encodedDirPath}?ref=${branch}`;
    console.log(`🔍 [GitHub API] 게임 기록 폴더 URL: ${githubApiUrl}`);

    const dirResponse = await fetch(githubApiUrl, {
        headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'Your App Name'
        }
    });

    if (!dirResponse.ok) {
        console.error(`❌ [GitHub API] 게임 기록 폴더 응답 코드: ${dirResponse.status}`);
        throw new Error('게임 기록 폴더가 존재하지 않습니다.');
    }

    const filesList = await dirResponse.json();
    const filesToFetch = filesList.slice(0, 400); // MAX_RECORDS
    const filePromises = filesToFetch.map(file =>
        fetch(file.download_url, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'User-Agent': 'Your App Name'
            }
        })
        .then(async (response) => {
            if (!response.ok) {
                console.error(`❌ [GitHub API] 파일 ${file.name} 다운로드 실패: ${response.status}`);
                return null;
            }
            const text = await response.text();
            return { fileName: file.name, content: text };
        })
        .catch((error) => {
            console.error(`❌ [GitHub API] 파일 ${file.name} 다운로드 오류: ${error}`);
            return null;
        })
    );

    const fileResults = await Promise.all(filePromises);
    const gameHistory = [];

    fileResults.forEach(result => {
        if (!result) return;
        try {
            const parsedData = yaml.load(result.content);
            if (parsedData && parsedData.Game && parsedData.Game.joinedPlayers) {
                const players = parsedData.Game.joinedPlayers.split(',').map(s => s.trim());
                if (players.includes(formattedUUID)) {
                    parsedData.fileName = result.fileName;
                    gameHistory.push(parsedData);
                }
            }
        } catch (parseError) {
            console.error(`❌ [GitHub API] 게임 기록 파일 파싱 오류 (${result.fileName}):`, parseError);
        }
    });

    if (gameHistory.length === 0) {
        throw new Error('게임 기록을 찾을 수 없습니다.');
    }

    return gameHistory;
}

module.exports = { getBadgeData, getGameHistory };