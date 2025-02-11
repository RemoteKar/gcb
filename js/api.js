// api.js
const CACHE_DURATION = 1000; // 캐싱 유지 시간: 1분
const cache = {};

/**
 * Netlify Function을 호출하여 유저 데이터를 가져옵니다.
 * @param {string} nickname - 검색할 유저 닉네임
 * @returns {Promise<object|null>} - 서버로부터 받은 JSON 데이터 또는 오류 시 null
 */
export async function fetchUserData(nickname) {
    if (cache[nickname] && (Date.now() - cache[nickname].timestamp < CACHE_DURATION)) {
        console.log(`⚡ 캐싱된 데이터 반환: ${nickname}`);
        return cache[nickname].data;
    }

    // URL 경로 앞에 슬래시("/")를 포함하여 올바른 경로로 요청
    const url = `/.netlify/functions/fetch-minecraft?nickname=${encodeURIComponent(nickname)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('유저를 찾을 수 없습니다.');

        const data = await response.json();
        cache[nickname] = { data, timestamp: Date.now() };
        return data;
    } catch (error) {
        console.error('API 오류:', error);
        return null;
    }
}

/**
 * 플레이어 머리 스킨 이미지 URL 반환 함수
 * @param {string} uuid - 유저의 UUID
 * @returns {string} - 플레이어 머리 이미지 URL
 */
export function getSkinUrl(uuid) {
    return `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
}
