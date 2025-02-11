// fetch-minecraft.js
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * UUID 형식 변환 함수 (하이픈 추가)
 * @param {string} uuid - 하이픈 없는 원본 UUID
 * @returns {string} - 하이픈이 포함된 UUID
 */
function formatUUID(uuid) {
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;
}

/**
 * 로컬에서 게임 기록 불러오기
 * @returns {Array|null} - YAML 파일을 파싱한 게임 기록 배열 또는 null
 */
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

/**
 * 특정 유저의 UUID가 포함된 게임 기록만 필터링
 * @param {string} uuid - 유저의 UUID (하이픈 없는 원본)
 * @param {Array} gameHistory - 전체 게임 기록 배열
 * @returns {Array} - 필터링된 게임 기록 배열
 */
function filterGameHistoryByUser(uuid, gameHistory) {
    return gameHistory.filter(record => {
        // 예시: 각 기록 객체의 구조가 { Game: { joinedPlayers: "uuid1, uuid2, ..." } }로 구성되어 있다고 가정
        if (record && record.Game && record.Game.joinedPlayers) {
            // joinedPlayers가 콤마(,)로 구분된 문자열이라고 가정합니다.
            const playersArray = record.Game.joinedPlayers.split(',').map(p => p.trim());
            return playersArray.includes(uuid);
        }
        return false;
    });
}

/**
 * Netlify Function - 메인 핸들러
 */
exports.handler = async (event, context) => {
    const { nickname } = event.queryStringParameters;

    // Mojang API를 통해 UUID 가져오기
    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
    let mojangResponse;
    try {
        mojangResponse = await fetch(mojangUrl);
    } catch (error) {
        console.error('Mojang API 호출 오류:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Mojang API 호출 중 오류 발생.' }),
        };
    }
    if (!mojangResponse.ok) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: '유저를 찾을 수 없습니다.' }),
        };
    }
    const mojangData = await mojangResponse.json();
    const uuid = mojangData.id; // 하이픈 없는 원본 UUID
    uuid = formatUUID(uuid);
    console.log('받은 UUID:', uuid);

    // 로컬의 게임 기록 불러오기
    const gameHistory = await fetchGameHistory();
    if (!gameHistory) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '게임 기록을 불러오지 못했습니다.' }),
        };
    }

    // 요청한 유저의 UUID가 포함된 게임 기록만 필터링
    const filteredHistory = filterGameHistoryByUser(uuid, gameHistory);
    console.log(`✅ 유저(${uuid})가 참여한 게임 기록 수: ${filteredHistory.length}`);

    return {
        statusCode: 200,
        body: JSON.stringify({
            id: uuid,
            gameHistory: filteredHistory, // Badge 대신 gameHistory 데이터를 반환
        }),
    };
};
