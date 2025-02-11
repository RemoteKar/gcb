const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

//-------------------
// 📌 UUID 형식 변환 함수 (하이픈 추가)
//-------------------
function formatUUID(uuid) {
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

//-------------------
// 📌 로컬에서 배지 데이터 가져오기 (GitHub API 제거)
//-------------------
async function fetchBadgeData(uuid) {
    const badgeFilePath = path.join(__dirname, `../../Resource/badge/${uuid}.yaml`);
    console.log("🔍 배지 데이터 파일 경로:", badgeFilePath);

    try {
        if (!fs.existsSync(badgeFilePath)) {
            console.error(`🚨 배지 데이터 없음: ${badgeFilePath}`);
            return null;
        }

        const fileContents = fs.readFileSync(badgeFilePath, 'utf8');
        return yaml.load(fileContents);
    } catch (error) {
        console.error('❌ 배지 데이터 로드 오류:', error);
        return null;
    }
}

//-------------------
// 📌 로컬에서 게임 기록 불러오기
//-------------------
async function fetchGameHistory() {
    const gameHistoryPath = path.join(__dirname, '../../Data/gameHistory');
    console.log("🔍 게임 기록 폴더 경로:", gameHistoryPath);

    try {
        if (!fs.existsSync(gameHistoryPath)) {
            console.error(`🚨 게임 기록 폴더 없음: ${gameHistoryPath}`);
            return null;
        }

        const files = fs.readdirSync(gameHistoryPath);
        const gameHistory = [];

        for (const file of files) {
            const filePath = path.join(gameHistoryPath, file);
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const parsedData = yaml.load(fileContents);
            gameHistory.push(parsedData);
        }

        console.log(`✅ 불러온 게임 기록 수: ${gameHistory.length}`);
        return gameHistory;
    } catch (error) {
        console.error('❌ 게임 기록 로드 오류:', error);
        return null;
    }
}

//-------------------
// 📌 Netlify Function - 메인 핸들러
//-------------------
exports.handler = async (event, context) => {
    const { nickname } = event.queryStringParameters;

    // Fetch UUID from Mojang API
    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
    const mojangResponse = await fetch(mojangUrl);
    if (!mojangResponse.ok) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: '유저를 찾을 수 없습니다.' }),
        };
    }
    const mojangData = await mojangResponse.json();
    const uuid = mojangData.id;

    // Format UUID with hyphens
    const formattedUUID = formatUUID(uuid);
    console.log('Formatted UUID:', formattedUUID);

    // ✅ 로컬에서 배지 데이터 가져오기
    const badgeData = await fetchBadgeData(formattedUUID);

    // ✅ 로컬에서 게임 기록 가져오기
    const gameHistory = await fetchGameHistory();
    let statistics = null;

    if (gameHistory) {
        statistics = calculateStatistics(formattedUUID, gameHistory);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            id: uuid,
            badges: badgeData?.badge || null,
            statistics: statistics || null,
        }),
    };
};
