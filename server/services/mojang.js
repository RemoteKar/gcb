const fetch = require('node-fetch');

const nicknameCache = new Map(); // 닉네임 캐시

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
            if (response.status === 404) {
                return null; // 유저를 찾을 수 없을 경우 null 반환
            }
            const errorText = await response.text();
            console.error(`❌ [Mojang API] 응답 오류: ${response.status} ${response.statusText} - ${errorText}`);
            throw new Error('Mojang API 오류가 발생했습니다.');
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

    // 캐시에서 닉네임 조회
    if (nicknameCache.has(uuid)) {
        console.log(`✅ [Mojang API] 캐시에서 프로필 조회: ${uuid}`);
        return nicknameCache.get(uuid);
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
        
        // 캐시에 닉네임 저장 (Prisma)
        try {
            await prisma.mojangProfileCache.upsert({
                where: { uuid: uuid },
                update: {
                    name: data.name,
                    profileData: data,
                    cachedAt: new Date(),
                    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24)) // 24시간 캐시
                },
                create: {
                    uuid: uuid,
                    name: data.name,
                    profileData: data,
                    cachedAt: new Date(),
                    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 24)) // 24시간 캐시
                }
            });
            console.log(`✅ [Mojang API] Prisma에 프로필 저장: ${uuid}`);
        } catch (error) {
            console.error(`❌ [Mojang API] Prisma 저장 오류: ${error}`);
            // 저장 실패해도 프로필 데이터는 반환
        }

        return data;
    } catch (error) {
        console.error("❌ [Mojang API] 프로필 조회 중 오류 발생:", error);
        throw new Error("프로필 조회 중 오류가 발생했습니다.");
    }
}

module.exports = { getUUID, getProfileByUUID };