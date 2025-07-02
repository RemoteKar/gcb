const fetch = require('node-fetch');

async function getUUID(nickname) {
    if (!nickname) {
        throw new Error('닉네임을 입력하세요.');
    }

    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
    console.log(`🔍 [Mojang API] 요청: ${mojangUrl}`);

    const response = await fetch(mojangUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Node.js Server)',
            'Accept': 'application/json'
        }
    });

    console.log(`🔍 [Mojang API] 응답 코드: ${response.status}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Mojang API] 응답 오류: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error('유저를 찾을 수 없습니다.');
    }

    const data = await response.json();
    console.log(`✅ [Mojang API] UUID 응답 데이터: ${JSON.stringify(data)}`);
    return data.id;
}

module.exports = { getUUID };