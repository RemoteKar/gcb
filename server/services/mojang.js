const fetch = require('node-fetch');

async function getUUID(nickname) {
    if (!nickname) {
        throw new Error('닉네임을 입력하세요.');
    }

    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${nickname}`;
    console.log(`🔍 [Mojang API] 요청: ${mojangUrl}`);

    try {
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
    } catch (error) {
        console.error("❌ [Mojang API] UUID 조회 중 오류 발생:", error);
        throw new Error("UUID 조회 중 오류가 발생했습니다.");
    }
}

async function getProfileByUUID(uuid) {
    if (!uuid) {
        throw new Error('UUID를 입력하세요.');
    }

    const sessionServerUrl = `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`;
    console.log(`🔍 [Mojang API] 프로필 요청: ${sessionServerUrl}`);

    try {
        const response = await fetch(sessionServerUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Node.js Server)',
                'Accept': 'application/json'
            }
        });

        console.log(`🔍 [Mojang API] 프로필 응답 코드: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ [Mojang API] 프로필 응답 오류: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error('프로필을 찾을 수 없습니다.');
        }

        const data = await response.json();
        console.log(`✅ [Mojang API] 프로필 응답 데이터: ${JSON.stringify(data)}`);
        return data;
    } catch (error) {
        console.error("❌ [Mojang API] 프로필 조회 중 오류 발생:", error);
        throw new Error("프로필 조회 중 오류가 발생했습니다.");
    }
}

module.exports = { getUUID, getProfileByUUID };